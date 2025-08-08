// Example of using Whisper directly in Node.js
// This would replace the Python transcription service

const whisper = require('whisper-node'); // or '@ggerganov/whisper.cpp'
const WebSocket = require('ws');
const express = require('express');

class TranscriptionService {
    constructor() {
        this.model = null;
        this.wss = null;
    }

    async initialize() {
        console.log('Loading Whisper model...');
        // Load the model directly in Node.js
        this.model = await whisper.loadModel('small', {
            language: 'de',
            gpu: false
        });
        console.log('Whisper model loaded successfully');
        
        // Create WebSocket server
        const app = express();
        const server = app.listen(8001);
        this.wss = new WebSocket.Server({ server, path: '/ws/transcribe' });
        
        this.wss.on('connection', (ws) => {
            console.log('Client connected');
            this.handleConnection(ws);
        });
        
        console.log('Transcription service running on ws://localhost:8001/ws/transcribe');
    }

    handleConnection(ws) {
        let audioBuffer = Buffer.alloc(0);
        let config = { language: 'de' };

        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                
                if (data.type === 'config') {
                    config = { ...config, ...data.config };
                    ws.send(JSON.stringify({
                        type: 'config_updated',
                        session_id: Math.random().toString(36).substr(2, 9)
                    }));
                } else if (data.type === 'audio') {
                    // Accumulate audio data
                    const audioData = Buffer.from(data.data, 'base64');
                    audioBuffer = Buffer.concat([audioBuffer, audioData]);
                    
                    // Process when we have enough data (e.g., 1 second)
                    if (audioBuffer.length >= 16000 * 2) { // 16kHz * 2 bytes per sample
                        const result = await this.transcribe(audioBuffer, config.language);
                        
                        ws.send(JSON.stringify({
                            type: 'transcription',
                            data: {
                                text: result.text,
                                language: result.language || config.language,
                                confidence: result.confidence || 0.9,
                                segments: result.segments || []
                            }
                        }));
                        
                        // Clear buffer
                        audioBuffer = Buffer.alloc(0);
                    }
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
            console.log('Client disconnected');
        });
    }

    async transcribe(audioBuffer, language) {
        try {
            // Transcribe using Whisper
            const result = await this.model.transcribe(audioBuffer, {
                language: language,
                word_timestamps: true
            });
            
            return {
                text: result.text,
                segments: result.segments,
                language: result.language,
                confidence: 0.9
            };
        } catch (error) {
            console.error('Transcription error:', error);
            return { text: '', segments: [], confidence: 0 };
        }
    }
}

// Start the service
const service = new TranscriptionService();
service.initialize().catch(console.error);