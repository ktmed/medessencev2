const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');

class WhisperCppTranscriptionService {
    constructor() {
        this.wss = null;
        this.sessions = new Map();
        this.tempDir = path.join(__dirname, 'temp_audio');
        this.whisperPath = path.join(__dirname, 'node_modules/whisper-node/lib/whisper.cpp/main');
        
        // Use the best available model: large-v2 > large-v3 > medium > small
        const largeV2ModelPath = path.join(__dirname, 'node_modules/whisper-node/lib/whisper.cpp/models/ggml-large-v2.bin');
        const largeV3ModelPath = path.join(__dirname, 'node_modules/whisper-node/lib/whisper.cpp/models/ggml-large-v3.bin');
        const mediumModelPath = path.join(__dirname, 'node_modules/whisper-node/lib/whisper.cpp/models/ggml-medium.bin');
        const smallModelPath = path.join(__dirname, 'node_modules/whisper-node/lib/whisper.cpp/models/ggml-small.bin');
        
        // Check which model is available (prioritize v2 for non-English)
        if (require('fs').existsSync(largeV2ModelPath)) {
            this.modelPath = largeV2ModelPath;
            console.log('Using large-v2 model (better for non-English)');
        } else if (require('fs').existsSync(largeV3ModelPath)) {
            this.modelPath = largeV3ModelPath;
            console.log('Using large-v3 model for best accuracy');
        } else if (require('fs').existsSync(mediumModelPath)) {
            this.modelPath = mediumModelPath;
            console.log('Using medium model for better accuracy');
        } else {
            this.modelPath = smallModelPath;
            console.log('Using small model');
        }
    }

    async initialize() {
        console.log('Initializing Whisper.cpp Transcription Service...');
        
        // Ensure temp directory exists
        await fs.mkdir(this.tempDir, { recursive: true });
        
        // Check if whisper binary exists
        try {
            await fs.access(this.whisperPath);
            console.log('Whisper binary found at:', this.whisperPath);
        } catch (e) {
            console.error('Whisper binary not found! Building...');
            await this.buildWhisper();
        }
        
        // Check if model exists
        try {
            await fs.access(this.modelPath);
            console.log('Model found at:', this.modelPath);
        } catch (e) {
            console.error('Model not found at:', this.modelPath);
            throw new Error('Whisper model not found. Please download it first.');
        }
        
        // Create HTTP server for health checks
        const app = express();
        app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                service: 'whisper-cpp',
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

    async buildWhisper() {
        console.log('Building whisper.cpp...');
        const whisperDir = path.join(__dirname, 'node_modules/whisper-node/lib/whisper.cpp');
        
        return new Promise((resolve, reject) => {
            const make = spawn('make', [], { cwd: whisperDir });
            
            make.stdout.on('data', (data) => {
                console.log('Build:', data.toString());
            });
            
            make.stderr.on('data', (data) => {
                console.error('Build error:', data.toString());
            });
            
            make.on('close', (code) => {
                if (code === 0) {
                    console.log('Whisper.cpp built successfully');
                    resolve();
                } else {
                    reject(new Error(`Build failed with code ${code}`));
                }
            });
        });
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
        
        // Process when we have enough data (2 seconds at 16kHz for better context)
        const minBufferSize = 64000; // 2 seconds of 16-bit PCM at 16kHz
        
        if (session.audioBuffer.length >= minBufferSize) {
            // Check if audio is too quiet
            const rms = this.calculateRMS(session.audioBuffer);
            console.log(`Audio RMS: ${rms}`);
            
            // Increased threshold to avoid processing near-silence which causes hallucinations
            if (rms < 0.001) {
                console.log('Audio too quiet, skipping transcription');
                // Clear buffer but don't transcribe
                session.audioBuffer = Buffer.alloc(0);
                return;
            }
            
            // Save audio to temporary WAV file
            const timestamp = Date.now();
            const wavFile = path.join(this.tempDir, `audio_${sessionId}_${timestamp}.wav`);
            
            try {
                // Convert PCM to WAV
                await this.saveAsWav(session.audioBuffer, wavFile, 16000);
                
                // Transcribe using whisper.cpp directly
                const startTime = Date.now();
                
                console.log(`Transcribing ${wavFile}...`);
                const text = await this.transcribeWithWhisperCpp(wavFile, session.config.language);
                
                const processingTime = (Date.now() - startTime) / 1000;
                
                console.log(`Transcription result: "${text}"`);
                
                // Only send if we have any content
                if (text && text.trim().length > 0) {
                    // Send transcription result
                    ws.send(JSON.stringify({
                        type: 'transcription',
                        data: {
                            text: text,
                            language: session.config.language,
                            confidence: 0.8,
                            processing_time: processingTime,
                            medical_terms: this.extractMedicalTerms(text),
                            quality_score: rms,
                            segments: []
                        }
                    }));
                    
                    session.totalTranscriptions++;
                } else {
                    console.log('Empty transcription, not sending');
                }
                
                // Clean up WAV file
                try {
                    await fs.unlink(wavFile);
                } catch (e) {
                    // File might already be deleted
                }
                
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

    async transcribeWithWhisperCpp(wavFile, language) {
        return new Promise(async (resolve, reject) => {
            const args = [
                '-m', this.modelPath,
                '-f', wavFile,
                '-l', language || 'de',  // German language
                '--no-timestamps',
                '--print-colors',
                '--beam-size', '5',
                '--best-of', '2',
                '--max-len', '0',
                '--word-thold', '0.01',
                '--entropy-thold', '2.4',
                '--logprob-thold', '-1.0'
            ];
            
            console.log('Running whisper with args:', args.join(' '));
            
            const whisper = spawn(this.whisperPath, args);
            
            let output = '';
            let error = '';
            
            whisper.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            whisper.stderr.on('data', (data) => {
                error += data.toString();
            });
            
            whisper.on('close', async (code) => {
                if (code === 0) {
                    // Parse the output to extract just the transcription
                    // Remove ANSI color codes
                    const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
                    const lines = cleanOutput.split('\n');
                    const transcription = lines
                        .map(line => line.trim())
                        .filter(line => {
                            // Skip empty lines, timestamps, and whisper system messages
                            return line && 
                                   !line.includes('[') && 
                                   !line.includes('whisper') &&
                                   !line.includes('system_info') &&
                                   !line.includes('main:') &&
                                   !line.includes('output_txt:') &&
                                   !line.startsWith('ggml_') &&
                                   !line.includes('-->') &&
                                   line.length > 0;
                        })
                        .join(' ')
                        .trim();
                    
                    console.log('Raw output:', output);
                    console.log('Clean output:', cleanOutput);
                    console.log('Parsed transcription:', transcription);
                    resolve(transcription);
                } else {
                    console.error('Whisper error:', error);
                    reject(new Error(`Whisper failed with code ${code}: ${error}`));
                }
            });
        });
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

    async saveAsWav(pcmBuffer, outputPath, sampleRate = 16000) {
        // Create WAV header
        const header = Buffer.alloc(44);
        const dataSize = pcmBuffer.length;
        
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
        
        // Write WAV file
        const wavData = Buffer.concat([header, pcmBuffer]);
        await fs.writeFile(outputPath, wavData);
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
    const service = new WhisperCppTranscriptionService();
    service.initialize().catch(error => {
        console.error('Failed to start transcription service:', error);
        process.exit(1);
    });
}

module.exports = WhisperCppTranscriptionService;