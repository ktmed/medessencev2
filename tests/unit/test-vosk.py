#!/usr/bin/env python3
import asyncio
import websockets
import json
import base64
import wave
import numpy as np

async def test_vosk():
    """Test Vosk transcription service with synthetic audio"""
    
    # Connect to Vosk service
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
            
            # Generate synthetic audio (16kHz, 16-bit PCM)
            # This is just silence but it tests the connection
            sample_rate = 16000
            duration = 2  # seconds
            samples = int(sample_rate * duration)
            
            # Create a simple tone (440 Hz)
            t = np.linspace(0, duration, samples)
            frequency = 440  # A4 note
            amplitude = 0.3
            audio_data = (amplitude * 32767 * np.sin(2 * np.pi * frequency * t)).astype(np.int16)
            
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
                print(f"Sent audio chunk {i//chunk_size + 1}")
                
                # Wait a bit to simulate real-time audio
                await asyncio.sleep(0.5)
            
            # End session
            await websocket.send(json.dumps({"type": "end_session"}))
            print("Sent end_session")
            
            # Wait for responses
            timeout = 5
            start_time = asyncio.get_event_loop().time()
            
            while asyncio.get_event_loop().time() - start_time < timeout:
                try:
                    message = await asyncio.wait_for(websocket.recv(), timeout=1)
                    data = json.loads(message)
                    print(f"Received: {data['type']}")
                    
                    if data['type'] == 'transcription':
                        print(f"Transcription: {data['data']['text']}")
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

if __name__ == "__main__":
    asyncio.run(test_vosk())