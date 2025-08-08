#!/usr/bin/env python3
import whisper
import numpy as np
import warnings
warnings.filterwarnings("ignore")

print("Loading Whisper model...")
model = whisper.load_model("small")
print("Model loaded successfully")

# Create a test audio signal (440Hz sine wave for 1 second)
sample_rate = 16000
duration = 1.0
t = np.linspace(0, duration, int(sample_rate * duration))
audio = 0.5 * np.sin(2 * np.pi * 440 * t).astype(np.float32)

# Add some noise to make it more realistic
noise = 0.05 * np.random.randn(len(audio))
audio = audio + noise

print(f"Test audio shape: {audio.shape}, dtype: {audio.dtype}")
print(f"Audio range: [{audio.min():.3f}, {audio.max():.3f}]")

# Try to transcribe
print("\nTesting transcription...")
try:
    result = model.transcribe(audio, language='de', fp16=False)
    print(f"Transcription result: '{result['text']}'")
    print(f"Detected language: {result.get('language', 'unknown')}")
except Exception as e:
    print(f"Transcription error: {e}")

# Test with actual speech-like pattern
print("\n\nTesting with speech-like audio...")
# This creates a more complex waveform that might be recognized as speech
audio2 = np.zeros(sample_rate * 2, dtype=np.float32)
for i in range(10):
    freq = 200 + i * 50  # Frequencies from 200-700 Hz (speech range)
    start = int(i * sample_rate * 0.2)
    end = start + int(sample_rate * 0.1)
    t_seg = np.linspace(0, 0.1, end - start)
    audio2[start:end] += 0.3 * np.sin(2 * np.pi * freq * t_seg)

# Add envelope to make it more speech-like
envelope = np.exp(-np.linspace(0, 5, len(audio2)))
audio2 = audio2 * envelope
audio2 = audio2.astype(np.float32)

print(f"Speech-like audio shape: {audio2.shape}, dtype: {audio2.dtype}")
print(f"Audio range: [{audio2.min():.3f}, {audio2.max():.3f}]")

try:
    result2 = model.transcribe(audio2, language='de', fp16=False, 
                              initial_prompt="Dies ist eine medizinische Diktation.")
    print(f"Transcription result: '{result2['text']}'")
    print(f"Detected language: {result2.get('language', 'unknown')}")
except Exception as e:
    print(f"Transcription error: {e}")