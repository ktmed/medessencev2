const whisper = require('whisper-node').default || require('whisper-node');
const fs = require('fs');

async function testWhisper() {
    console.log('Testing whisper-node directly...');
    
    // Use the test file we just created
    const testFile = 'temp_audio/test.wav';
    console.log('Testing with file:', testFile);
    
    // Test 1: Basic transcription
    try {
        console.log('\nTest 1: Basic call');
        const result1 = await whisper(testFile);
        console.log('Result:', JSON.stringify(result1, null, 2));
    } catch (e) {
        console.error('Test 1 failed:', e.message);
    }
    
    // Test 2: With modelName
    try {
        console.log('\nTest 2: With modelName');
        const result2 = await whisper(testFile, {
            modelName: "small"
        });
        console.log('Result:', JSON.stringify(result2, null, 2));
    } catch (e) {
        console.error('Test 2 failed:', e.message);
    }
    
    // Test 3: With whisperOptions
    try {
        console.log('\nTest 3: With whisperOptions');
        const result3 = await whisper(testFile, {
            modelName: "small",
            whisperOptions: {
                language: 'de',
                word_timestamps: false
            }
        });
        console.log('Result:', JSON.stringify(result3, null, 2));
    } catch (e) {
        console.error('Test 3 failed:', e.message);
    }
}

testWhisper().catch(console.error);