const io = require('socket.io-client');
const fs = require('fs');

console.log('Connecting to Socket.IO server...');

const socket = io('http://localhost:8080', {
    transports: ['websocket'],
    reconnection: true
});

// Create synthetic audio data (sine wave at 440Hz)
function createTestAudio(durationSeconds = 2) {
    const sampleRate = 16000;
    const samples = sampleRate * durationSeconds;
    const buffer = Buffer.alloc(samples * 2); // 16-bit audio
    
    // Generate a 440Hz sine wave with some variations
    for (let i = 0; i < samples; i++) {
        // Add some frequency modulation to make it more speech-like
        const t = i / sampleRate;
        const frequency = 440 + Math.sin(t * 2) * 100; // Varying frequency
        const amplitude = 0.3 * (1 + Math.sin(t * 5) * 0.5); // Varying amplitude
        
        const value = Math.sin(2 * Math.PI * frequency * t) * amplitude;
        const sample = Math.round(value * 32767);
        
        buffer.writeInt16LE(sample, i * 2);
    }
    
    return buffer;
}

socket.on('connect', () => {
    console.log('✓ Connected! Socket ID:', socket.id);
    console.log('✓ Connected state:', socket.connected);
    
    // Start transcription
    console.log('Starting transcription...');
    socket.emit('start_transcription', { language: 'de' });
    
    // Send multiple chunks of audio
    let chunkCount = 0;
    const sendAudioChunk = () => {
        if (chunkCount >= 5) {
            // Stop after 5 chunks
            console.log('Stopping transcription...');
            socket.emit('stop_transcription');
            
            setTimeout(() => {
                console.log('Disconnecting...');
                socket.disconnect();
                process.exit(0);
            }, 2000);
            return;
        }
        
        const audioData = createTestAudio(1); // 1 second chunks
        console.log(`Sending audio chunk ${chunkCount + 1} (${audioData.length} bytes)...`);
        
        socket.emit('audio_data', {
            data: audioData,
            language: 'de',
            timestamp: Date.now()
        });
        
        chunkCount++;
        setTimeout(sendAudioChunk, 1500); // Send every 1.5 seconds
    };
    
    // Start sending audio after connection is established
    setTimeout(sendAudioChunk, 500);
});

socket.on('connection', (data) => {
    console.log('Received connection event:', data);
});

socket.on('transcription', (data) => {
    console.log('📝 Received transcription:', {
        text: data.text || '[empty]',
        confidence: data.confidence,
        language: data.language
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