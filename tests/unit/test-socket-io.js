const io = require('socket.io-client');

console.log('Connecting to Socket.IO server...');

const socket = io('http://localhost:8080', {
    transports: ['websocket'],
    reconnection: true
});

socket.on('connect', () => {
    console.log('✓ Connected! Socket ID:', socket.id);
    console.log('✓ Connected state:', socket.connected);
    
    // Test starting transcription
    console.log('Sending start_transcription...');
    socket.emit('start_transcription', { language: 'de' });
    
    // Test sending audio data
    setTimeout(() => {
        console.log('Sending test audio data...');
        const testAudio = Buffer.alloc(1000); // 1KB of zeros
        socket.emit('audio_data', {
            data: testAudio,
            language: 'de',
            timestamp: Date.now()
        });
    }, 1000);
    
    // Stop after 3 seconds
    setTimeout(() => {
        console.log('Sending stop_transcription...');
        socket.emit('stop_transcription');
        
        setTimeout(() => {
            console.log('Disconnecting...');
            socket.disconnect();
            process.exit(0);
        }, 1000);
    }, 3000);
});

socket.on('connection', (data) => {
    console.log('Received connection event:', data);
});

socket.on('transcription', (data) => {
    console.log('Received transcription:', data);
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