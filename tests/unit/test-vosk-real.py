#!/usr/bin/env python3
import asyncio
import websockets
import json
import base64
import numpy as np
import wave
import os

async def test_vosk_with_audio():
    """Test Vosk with a real audio file"""
    
    # First, let's create a test audio file with some speech-like patterns
    sample_rate = 16000
    duration = 3  # seconds
    
    # Create a more complex audio signal that might trigger recognition
    t = np.linspace(0, duration, int(sample_rate * duration))
    
    # Mix of frequencies to simulate speech
    audio = np.zeros_like(t)
    
    # Add multiple frequency components
    for freq in [200, 300, 500, 800, 1200, 2000]:
        audio += 0.1 * np.sin(2 * np.pi * freq * t)
    
    # Add some noise
    audio += 0.05 * np.random.randn(len(t))
    
    # Modulate amplitude to simulate speech patterns
    envelope = 0.5 + 0.5 * np.sin(2 * np.pi * 2 * t)  # 2 Hz modulation
    audio *= envelope
    
    # Convert to 16-bit PCM
    audio_data = (audio * 16384).astype(np.int16)
    
    # Save as WAV file for reference
    with wave.open('test_audio.wav', 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_data.tobytes())
    
    print("Created test audio file: test_audio.wav")
    
    # Connect to Vosk
    uri = "ws://localhost:8002/ws/transcribe"
    
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected to Vosk service!")
            
            # Send configuration
            config = {
                "type": "config",
                "config": {
                    "language": "de",
                    "medical_context": True
                }
            }
            await websocket.send(json.dumps(config))
            print("Sent configuration")
            
            # Send audio in chunks
            chunk_size = sample_rate // 2  # 0.5 second chunks
            for i in range(0, len(audio_data), chunk_size):
                chunk = audio_data[i:i+chunk_size]
                audio_bytes = chunk.tobytes()
                
                # Send audio data
                audio_msg = {
                    "type": "audio",
                    "data": base64.b64encode(audio_bytes).decode('utf-8')
                }
                await websocket.send(json.dumps(audio_msg))
                print(f"Sent audio chunk {i//chunk_size + 1}/{len(audio_data)//chunk_size}")
                
                # Check for immediate responses
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=0.1)
                    data = json.loads(response)
                    if data['type'] == 'transcription':
                        print(f"Got transcription: {data['data']['text']}")
                except asyncio.TimeoutError:
                    pass
                
                await asyncio.sleep(0.1)
            
            # End session
            await websocket.send(json.dumps({"type": "end_session"}))
            print("Sent end_session")
            
            # Wait for final responses
            timeout = 3
            start_time = asyncio.get_event_loop().time()
            
            while asyncio.get_event_loop().time() - start_time < timeout:
                try:
                    message = await asyncio.wait_for(websocket.recv(), timeout=0.5)
                    data = json.loads(message)
                    print(f"Received: {data['type']}")
                    
                    if data['type'] == 'transcription':
                        print(f"Final transcription: {data['data']['text']}")
                        print(f"Language: {data['data']['language']}")
                        print(f"Confidence: {data['data']['confidence']}")
                    elif data['type'] == 'session_ended':
                        print(f"Session ended. Total transcriptions: {data['total_transcriptions']}")
                        break
                except asyncio.TimeoutError:
                    continue
                    
            print("\nTest completed!")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_vosk_with_audio())