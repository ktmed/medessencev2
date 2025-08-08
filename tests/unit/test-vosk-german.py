#!/usr/bin/env python3
import asyncio
import websockets
import json
import base64
import numpy as np
import time

async def test_vosk():
    """Test Vosk with German audio"""
    uri = "ws://localhost:8002/ws/transcribe"
    
    # Generate test audio with German speech pattern
    # This is a simple sine wave modulated to simulate speech
    sample_rate = 16000
    duration = 5  # seconds
    t = np.linspace(0, duration, sample_rate * duration)
    
    # Create a more complex audio signal that mimics speech patterns
    # Multiple frequency components
    f1, f2, f3 = 200, 400, 800  # Fundamental frequencies for vowel sounds
    
    # Generate formants (typical for German vowels)
    signal = (
        0.3 * np.sin(2 * np.pi * f1 * t) +  # First formant
        0.2 * np.sin(2 * np.pi * f2 * t) +  # Second formant
        0.1 * np.sin(2 * np.pi * f3 * t)    # Third formant
    )
    
    # Add amplitude modulation to simulate speech rhythm
    modulation = 0.5 + 0.5 * np.sin(2 * np.pi * 4 * t)  # 4 Hz modulation
    signal = signal * modulation
    
    # Add some noise
    signal += 0.05 * np.random.randn(len(signal))
    
    # Normalize and convert to int16
    signal = signal / np.max(np.abs(signal)) * 0.8  # Normalize to 80% to avoid clipping
    audio_data = (signal * 32767).astype(np.int16)
    
    print(f"Generated {len(audio_data)} samples of test audio")
    print(f"RMS: {np.sqrt(np.mean((audio_data / 32768.0)**2)):.4f}")
    print(f"Max: {np.max(np.abs(audio_data))}")
    
    async with websockets.connect(uri) as websocket:
        print(f"Connected to Vosk at {uri}")
        
        # Send config
        config = {
            "type": "config",
            "config": {
                "language": "de",
                "model_size": "base",
                "medical_context": True,
                "quality_threshold": 0.7
            }
        }
        await websocket.send(json.dumps(config))
        print("Sent config")
        
        # Send audio in chunks
        chunk_size = 16000  # 1 second chunks
        for i in range(0, len(audio_data), chunk_size):
            chunk = audio_data[i:i+chunk_size]
            chunk_bytes = chunk.tobytes()
            
            message = {
                "type": "audio",
                "data": base64.b64encode(chunk_bytes).decode('ascii'),
                "language": "de"
            }
            
            await websocket.send(json.dumps(message))
            print(f"Sent audio chunk {i//chunk_size + 1}/{(len(audio_data) + chunk_size - 1)//chunk_size}")
            
            # Wait a bit to simulate real-time
            await asyncio.sleep(0.5)
        
        # Send end session
        await websocket.send(json.dumps({"type": "end_session"}))
        print("Sent end_session")
        
        # Wait for responses
        timeout = time.time() + 10  # 10 second timeout
        transcriptions = []
        
        while time.time() < timeout:
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                data = json.loads(response)
                print(f"Received: {data['type']}")
                
                if data['type'] == 'transcription':
                    transcriptions.append(data['data'])
                    print(f"Transcription: {data['data'].get('text', 'NO TEXT')}")
                elif data['type'] == 'session_ended':
                    print(f"Session ended, total transcriptions: {data['total_transcriptions']}")
                    break
                    
            except asyncio.TimeoutError:
                continue
        
        print(f"\nTotal transcriptions received: {len(transcriptions)}")
        for i, trans in enumerate(transcriptions):
            print(f"{i+1}. {trans.get('text', 'NO TEXT')} (confidence: {trans.get('confidence', 0):.2f})")

if __name__ == "__main__":
    asyncio.run(test_vosk())