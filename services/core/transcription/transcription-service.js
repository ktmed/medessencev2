const express = require('express');
const WebSocket = require('ws');
const whisperNode = require('whisper-node').default || require('whisper-node');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

class TranscriptionService {
    constructor() {
        this.model = null;
        this.wss = null;
        this.sessions = new Map();
        this.modelPath = path.join(__dirname, 'models');
    }

    async initialize() {
        console.log('Initializing Node.js Transcription Service...');
        
        // Ensure models directory exists
        await fs.mkdir(this.modelPath, { recursive: true });
        
        // Initialize Whisper model
        console.log('Loading Whisper model...');
        try {
            const options = {
                modelName: "small",
                modelPath: this.modelPath,
                whisperOptions: {
                    language: 'de',
                    word_timestamps: true,
                    output_txt: false,
                    output_vtt: false,
                    output_srt: false,
                    output_csv: false,
                    translate: false,
                    print_colors: false,
                    print_progress: false
                }
            };
            
            this.model = new whisper(this.modelPath, options);
            
            // Download model if not exists
            const modelFile = path.join(this.modelPath, 'ggml-small.bin');
            if (!await this.fileExists(modelFile)) {
                console.log('Downloading Whisper model...');
                await this.model.download();
            }
            
            console.log('Whisper model ready');
        } catch (error) {
            console.error('Failed to initialize Whisper:', error);
            throw error;
        }
        
        // Create HTTP server for health checks
        const app = express();
        app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                model: 'whisper-small',
                sessions: this.sessions.size 
            });
        });
        
        const server = app.listen(8001, () => {
            console.log('HTTP server listening on port 8001');
        });
        
        // Create WebSocket server
        this.wss = new WebSocket.Server({ 
            server, 
            path: '/ws/transcribe' 
        });
        
        this.wss.on('connection', (ws) => {
            const sessionId = uuidv4();
            console.log(`New WebSocket connection: ${sessionId}`);
            this.handleConnection(ws, sessionId);
        });
        
        console.log('Transcription service ready on ws://localhost:8001/ws/transcribe');
        
        // Send heartbeat to all connected clients
        setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'heartbeat',
                        timestamp: Date.now() / 1000
                    }));
                }
            });
        }, 30000);
    }

    async fileExists(path) {
        try {
            await fs.access(path);
            return true;
        } catch {
            return false;
        }
    }

    handleConnection(ws, sessionId) {
        // Initialize session
        const session = {
            id: sessionId,
            config: {
                language: 'de',
                medical_context: true
            },
            audioBuffer: Buffer.alloc(0),
            lastProcessTime: Date.now(),
            totalTranscriptions: 0,
            startTime: Date.now()
        };
        
        this.sessions.set(sessionId, session);
        
        // Send initial heartbeat
        ws.send(JSON.stringify({
            type: 'heartbeat',
            timestamp: Date.now() / 1000
        }));

        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message.toString());
                
                switch (data.type) {
                    case 'config':
                        await this.handleConfig(ws, sessionId, data.config);
                        break;
                        
                    case 'audio':
                        await this.handleAudio(ws, sessionId, data);
                        break;
                        
                    case 'end_session':
                        await this.handleEndSession(ws, sessionId);
                        break;
                        
                    default:
                        console.log(`Unknown message type: ${data.type}`);
                }
            } catch (error) {
                console.error('Error processing message:', error);
                ws.send(JSON.stringify({
                    type: 'error',
                    message: error.message
                }));
            }
        });

        ws.on('close', () => {
            console.log(`WebSocket disconnected: ${sessionId}`);
            this.sessions.delete(sessionId);
        });
        
        ws.on('error', (error) => {
            console.error(`WebSocket error for ${sessionId}:`, error);
        });
    }

    async handleConfig(ws, sessionId, config) {
        const session = this.sessions.get(sessionId);
        if (!session) return;
        
        session.config = { ...session.config, ...config };
        console.log(`Config updated for ${sessionId}:`, session.config);
        
        ws.send(JSON.stringify({
            type: 'config_updated',
            session_id: sessionId
        }));
    }

    async handleAudio(ws, sessionId, data) {
        const session = this.sessions.get(sessionId);
        if (!session) return;
        
        // Decode base64 audio data
        const audioData = Buffer.from(data.data, 'base64');
        console.log(`Received audio chunk: ${audioData.length} bytes`);
        
        // Accumulate audio
        session.audioBuffer = Buffer.concat([session.audioBuffer, audioData]);
        
        // Process when we have enough data (0.5 seconds at 16kHz)
        const minBufferSize = 16000; // 0.5 seconds of 16-bit PCM at 16kHz
        
        if (session.audioBuffer.length >= minBufferSize) {
            // Check if audio is too quiet
            const rms = this.calculateRMS(session.audioBuffer);
            console.log(`Audio RMS: ${rms}`);
            
            if (rms < 0.001) {
                console.log('Audio too quiet, skipping transcription');
                // Clear buffer but don't transcribe
                session.audioBuffer = Buffer.alloc(0);
                
                ws.send(JSON.stringify({
                    type: 'transcription',
                    data: {
                        text: '',
                        language: session.config.language,
                        confidence: 0,
                        processing_time: 0,
                        medical_terms: [],
                        quality_score: rms,
                        segments: []
                    }
                }));
                return;
            }
            
            // Save audio to temporary file
            const tempFile = path.join(this.modelPath, `temp_${sessionId}_${Date.now()}.pcm`);
            
            try {
                // Write PCM data to file
                await fs.writeFile(tempFile, session.audioBuffer);
                
                // Convert PCM to WAV (Whisper needs WAV format)
                const wavFile = tempFile.replace('.pcm', '.wav');
                await this.pcmToWav(tempFile, wavFile, 16000);
                
                // Transcribe
                const startTime = Date.now();
                const result = await this.transcribe(wavFile, session.config.language);
                const processingTime = (Date.now() - startTime) / 1000;
                
                console.log(`Transcription result: "${result.text}"`);
                
                // Send transcription result
                ws.send(JSON.stringify({
                    type: 'transcription',
                    data: {
                        text: result.text || '',
                        language: result.language || session.config.language,
                        confidence: result.confidence || 0.8,
                        processing_time: processingTime,
                        medical_terms: this.extractMedicalTerms(result.text),
                        quality_score: rms,
                        segments: result.segments || []
                    }
                }));
                
                session.totalTranscriptions++;
                
                // Clean up files
                await fs.unlink(tempFile).catch(() => {});
                await fs.unlink(wavFile).catch(() => {});
                
            } catch (error) {
                console.error('Transcription error:', error);
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Transcription failed: ' + error.message
                }));
            }
            
            // Clear buffer
            session.audioBuffer = Buffer.alloc(0);
        }
    }

    async handleEndSession(ws, sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;
        
        const duration = (Date.now() - session.startTime) / 1000;
        
        ws.send(JSON.stringify({
            type: 'session_ended',
            session_id: sessionId,
            total_transcriptions: session.totalTranscriptions,
            session_duration: duration
        }));
        
        this.sessions.delete(sessionId);
    }

    calculateRMS(buffer) {
        let sum = 0;
        // Treat as 16-bit PCM
        for (let i = 0; i < buffer.length - 1; i += 2) {
            const sample = buffer.readInt16LE(i) / 32768.0;
            sum += sample * sample;
        }
        return Math.sqrt(sum / (buffer.length / 2));
    }

    async pcmToWav(inputFile, outputFile, sampleRate = 16000) {
        const pcmData = await fs.readFile(inputFile);
        const wavHeader = this.createWavHeader(pcmData.length, sampleRate);
        const wavData = Buffer.concat([wavHeader, pcmData]);
        await fs.writeFile(outputFile, wavData);
    }

    createWavHeader(dataSize, sampleRate = 16000) {
        const header = Buffer.alloc(44);
        
        // RIFF chunk descriptor
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + dataSize, 4);
        header.write('WAVE', 8);
        
        // fmt sub-chunk
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16); // Subchunk size
        header.writeUInt16LE(1, 20); // Audio format (PCM)
        header.writeUInt16LE(1, 22); // Number of channels
        header.writeUInt32LE(sampleRate, 24); // Sample rate
        header.writeUInt32LE(sampleRate * 2, 28); // Byte rate
        header.writeUInt16LE(2, 32); // Block align
        header.writeUInt16LE(16, 34); // Bits per sample
        
        // data sub-chunk
        header.write('data', 36);
        header.writeUInt32LE(dataSize, 40);
        
        return header;
    }

    async transcribe(audioFile, language) {
        try {
            const options = {
                language: language || 'de',
                word_timestamps: true,
                output_txt: false,
                output_vtt: false,
                output_srt: false,
                output_csv: false
            };
            
            const transcript = await this.model.transcribe(audioFile, options);
            
            // Parse the result
            if (typeof transcript === 'string') {
                return {
                    text: transcript.trim(),
                    language: language,
                    confidence: 0.8
                };
            } else if (transcript && transcript.length > 0) {
                // Handle array of segments
                const text = transcript.map(s => s.text || s).join(' ').trim();
                return {
                    text: text,
                    language: language,
                    confidence: 0.8,
                    segments: transcript
                };
            }
            
            return { text: '', language: language, confidence: 0 };
            
        } catch (error) {
            console.error('Whisper transcription error:', error);
            throw error;
        }
    }

    extractMedicalTerms(text) {
        if (!text) return [];
        
        // Common German medical terms
        const medicalTerms = [
            'Befund', 'Diagnose', 'Patient', 'Untersuchung', 'Behandlung',
            'Therapie', 'Medikament', 'Symptom', 'Anamnese', 'Labor',
            'Röntgen', 'MRT', 'CT', 'Ultraschall', 'EKG', 'Blutdruck',
            'Herzfrequenz', 'Temperatur', 'Schmerz', 'Entzündung',
            'Infektion', 'Allergie', 'Operation', 'Eingriff', 'Narkose',
            'Wirbelsäule', 'Lendenwirbelsäule', 'Bandscheibe', 'Fraktur',
            'Arthrose', 'Osteoporose', 'Stenose', 'Protrusion', 'Prolaps'
        ];
        
        const found = [];
        const lowerText = text.toLowerCase();
        
        for (const term of medicalTerms) {
            if (lowerText.includes(term.toLowerCase())) {
                found.push(term);
            }
        }
        
        return [...new Set(found)];
    }
}

// Start the service
if (require.main === module) {
    const service = new TranscriptionService();
    service.initialize().catch(error => {
        console.error('Failed to start transcription service:', error);
        process.exit(1);
    });
}

module.exports = TranscriptionService;