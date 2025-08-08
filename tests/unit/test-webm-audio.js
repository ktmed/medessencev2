const io = require('socket.io-client');
const fs = require('fs');
const { spawn } = require('child_process');

console.log('Connecting to Socket.IO server...');

const socket = io('http://localhost:8080', {
    transports: ['websocket'],
    reconnection: true
});

// Generate a simple WebM file with Opus audio using FFmpeg
function generateWebMAudio(callback) {
    console.log('Generating WebM audio data...');
    
    // Create a simple tone using FFmpeg
    const ffmpeg = spawn('ffmpeg', [
        '-f', 'lavfi',
        '-i', 'sine=frequency=440:duration=2',
        '-c:a', 'libopus',
        '-b:a', '48k',
        '-f', 'webm',
        '-'
    ]);
    
    const chunks = [];
    
    ffmpeg.stdout.on('data', (chunk) => {
        chunks.push(chunk);
    });
    
    ffmpeg.on('close', () => {
        const webmData = Buffer.concat(chunks);
        console.log(`Generated WebM data: ${webmData.length} bytes`);
        callback(webmData);
    });
    
    ffmpeg.stderr.on('data', (data) => {
        console.log('FFmpeg:', data.toString());
    });
}

socket.on('connect', () => {
    console.log('✓ Connected! Socket ID:', socket.id);
    
    // Start transcription
    console.log('Starting transcription...');
    socket.emit('start_transcription', { language: 'de' });
    
    // Generate and send WebM audio
    setTimeout(() => {
        generateWebMAudio((webmData) => {
            // Send in chunks like a real browser would
            const chunkSize = 4096;
            let offset = 0;
            
            const sendChunk = () => {
                if (offset >= webmData.length) {
                    console.log('All chunks sent, stopping transcription...');
                    setTimeout(() => {
                        socket.emit('stop_transcription');
                        setTimeout(() => {
                            socket.disconnect();
                            process.exit(0);
                        }, 2000);
                    }, 1000);
                    return;
                }
                
                const chunk = webmData.slice(offset, offset + chunkSize);
                console.log(`Sending chunk ${Math.floor(offset/chunkSize) + 1}, size: ${chunk.length}`);
                
                socket.emit('audio_data', {
                    data: chunk,
                    language: 'de',
                    timestamp: Date.now()
                });
                
                offset += chunkSize;
                setTimeout(sendChunk, 100); // Send chunks with slight delay
            };
            
            sendChunk();
        });
    }, 500);
});

socket.on('transcription', (data) => {
    console.log('📝 Received transcription:', {
        text: data.text || '[empty]',
        confidence: data.confidence,
        language: data.language,
        medical_terms: data.medical_terms
    });
});

socket.on('transcription_connected', (data) => {
    console.log('Transcription service connected:', data);
});

socket.on('error', (error) => {
    console.error('Socket error:', error);
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error.message);
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
});