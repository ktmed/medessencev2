#!/usr/bin/env python3
"""
Test script for the transcription service
"""

import asyncio
import json
import time
from pathlib import Path

import aiohttp
import websockets

# Service configuration
SERVICE_URL = "http://localhost:8003"
WS_URL = "ws://localhost:8003/ws/transcribe"

async def test_health_check():
    """Test health check endpoint"""
    print("Testing health check...")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{SERVICE_URL}/health") as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✓ Health check passed: {data['status']}")
                    return True
                else:
                    print(f"✗ Health check failed: {response.status}")
                    return False
    except Exception as e:
        print(f"✗ Health check error: {e}")
        return False

async def test_languages_endpoint():
    """Test languages endpoint"""
    print("Testing languages endpoint...")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{SERVICE_URL}/languages") as response:
                if response.status == 200:
                    languages = await response.json()
                    print(f"✓ Languages endpoint: {len(languages)} languages supported")
                    for lang in languages[:3]:  # Show first 3
                        print(f"  - {lang['name']} ({lang['code']})")
                    return True
                else:
                    print(f"✗ Languages endpoint failed: {response.status}")
                    return False
    except Exception as e:
        print(f"✗ Languages endpoint error: {e}")
        return False

async def test_websocket_connection():
    """Test WebSocket connection"""
    print("Testing WebSocket connection...")
    
    try:
        async with websockets.connect(WS_URL) as websocket:
            # Send configuration
            config_message = {
                "type": "config",
                "config": {
                    "language": "en",
                    "medical_context": True,
                    "quality_threshold": 0.7
                }
            }
            
            await websocket.send(json.dumps(config_message))
            
            # Wait for response
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            data = json.loads(response)
            
            if data.get("type") == "config_updated":
                print("✓ WebSocket connection and configuration successful")
                
                # End session
                await websocket.send(json.dumps({"type": "end_session"}))
                return True
            else:
                print(f"✗ Unexpected WebSocket response: {data}")
                return False
                
    except asyncio.TimeoutError:
        print("✗ WebSocket connection timeout")
        return False
    except Exception as e:
        print(f"✗ WebSocket connection error: {e}")
        return False

async def create_test_audio():
    """Create a simple test audio file"""
    try:
        import numpy as np
        import soundfile as sf
        
        # Generate a simple sine wave (440 Hz for 2 seconds)
        sample_rate = 16000
        duration = 2.0
        frequency = 440.0
        
        t = np.linspace(0, duration, int(sample_rate * duration))
        audio = 0.3 * np.sin(2 * np.pi * frequency * t)
        
        # Save as WAV file
        test_file = Path("test_audio.wav")
        sf.write(test_file, audio, sample_rate)
        
        print(f"✓ Generated test audio file: {test_file}")
        return test_file
        
    except ImportError:
        print("✗ Cannot generate test audio: numpy/soundfile not available")
        return None
    except Exception as e:
        print(f"✗ Error generating test audio: {e}")
        return None

async def test_file_transcription():
    """Test file transcription endpoint"""
    print("Testing file transcription...")
    
    # Create test audio file
    test_file = await create_test_audio()
    if not test_file:
        print("✗ Skipping file transcription test (no test audio)")
        return False
    
    try:
        async with aiohttp.ClientSession() as session:
            with open(test_file, 'rb') as f:
                form_data = aiohttp.FormData()
                form_data.add_field('file', f, filename='test_audio.wav')
                form_data.add_field('language', 'en')
                form_data.add_field('medical_context', 'true')
                
                async with session.post(f"{SERVICE_URL}/transcribe", data=form_data) as response:
                    if response.status == 200:
                        result = await response.json()
                        print(f"✓ File transcription successful")
                        print(f"  Text: '{result.get('text', 'No text')}'")
                        print(f"  Confidence: {result.get('confidence', 0):.2f}")
                        print(f"  Processing time: {result.get('processing_time', 0):.2f}s")
                        return True
                    else:
                        error_text = await response.text()
                        print(f"✗ File transcription failed: {response.status}")
                        print(f"  Error: {error_text}")
                        return False
                        
    except Exception as e:
        print(f"✗ File transcription error: {e}")
        return False
    finally:
        # Clean up test file
        if test_file and test_file.exists():
            test_file.unlink()

async def test_metrics_endpoint():
    """Test metrics endpoint"""
    print("Testing metrics endpoint...")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{SERVICE_URL}/metrics") as response:
                if response.status == 200:
                    metrics = await response.json()
                    print(f"✓ Metrics endpoint successful")
                    print(f"  Transcription count: {metrics.get('transcription_count', 0)}")
                    print(f"  Error count: {metrics.get('error_count', 0)}")
                    return True
                else:
                    print(f"✗ Metrics endpoint failed: {response.status}")
                    return False
    except Exception as e:
        print(f"✗ Metrics endpoint error: {e}")
        return False

async def run_all_tests():
    """Run all tests"""
    print("=" * 50)
    print("TRANSCRIPTION SERVICE TEST SUITE")
    print("=" * 50)
    
    tests = [
        ("Health Check", test_health_check),
        ("Languages Endpoint", test_languages_endpoint),
        ("WebSocket Connection", test_websocket_connection),
        ("File Transcription", test_file_transcription),
        ("Metrics Endpoint", test_metrics_endpoint),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n--- {test_name} ---")
        start_time = time.time()
        
        try:
            success = await test_func()
            duration = time.time() - start_time
            results.append((test_name, success, duration))
            
            if success:
                print(f"✓ {test_name} completed in {duration:.2f}s")
            else:
                print(f"✗ {test_name} failed after {duration:.2f}s")
                
        except Exception as e:
            duration = time.time() - start_time
            results.append((test_name, False, duration))
            print(f"✗ {test_name} error after {duration:.2f}s: {e}")
    
    # Summary
    print("\n" + "=" * 50)
    print("TEST SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for _, success, _ in results if success)
    total = len(results)
    
    print(f"Tests passed: {passed}/{total}")
    print(f"Success rate: {passed/total*100:.1f}%")
    
    print("\nDetailed results:")
    for test_name, success, duration in results:
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"  {status} {test_name} ({duration:.2f}s)")
    
    if passed == total:
        print("\n🎉 All tests passed! Service is working correctly.")
        return True
    else:
        print(f"\n⚠️  {total - passed} tests failed. Check service configuration.")
        return False

async def main():
    """Main test function"""
    print("Transcription Service Test Script")
    print(f"Testing service at: {SERVICE_URL}")
    print(f"WebSocket endpoint: {WS_URL}")
    
    # Wait a moment for service to be ready
    await asyncio.sleep(1)
    
    success = await run_all_tests()
    
    if success:
        exit(0)
    else:
        exit(1)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        exit(1)
    except Exception as e:
        print(f"\n\nUnexpected error: {e}")
        exit(1)