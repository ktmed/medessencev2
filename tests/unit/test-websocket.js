const WebSocket = require('ws');

console.log('Testing WebSocket connection to transcription service...');

const ws = new WebSocket('ws://localhost:8001/ws/transcribe');

ws.on('open', () => {
    console.log('✓ Connected to transcription service');
    
    // Send a config message
    const config = {
        type: 'config',
        config: {
            language: 'de',
            model_size: 'base',
            medical_context: true
        }
    };
    
    console.log('Sending config:', config);
    ws.send(JSON.stringify(config));
    
    // Close after 2 seconds
    setTimeout(() => {
        console.log('Closing connection...');
        ws.close();
    }, 2000);
});

ws.on('message', (data) => {
    console.log('Received message:', data.toString());
});

ws.on('error', (error) => {
    console.error('✗ WebSocket error:', error.message);
});

ws.on('close', () => {
    console.log('Connection closed');
    process.exit(0);
});

// Timeout after 5 seconds
setTimeout(() => {
    console.error('✗ Connection timeout');
    process.exit(1);
}, 5000);