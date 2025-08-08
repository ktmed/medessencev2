#!/bin/bash

echo "Downloading German Vosk model..."

# Create models directory
mkdir -p vosk-models

cd vosk-models

# Download German model (smaller model for real-time performance)
echo "Downloading vosk-model-small-de-0.15 (45MB)..."
curl -L -o vosk-model-small-de-0.15.zip https://alphacephei.com/vosk/models/vosk-model-small-de-0.15.zip

echo "Extracting model..."
unzip vosk-model-small-de-0.15.zip

# Also download the larger German model for better accuracy
echo "Downloading vosk-model-de-0.21 (1.4GB) for better accuracy..."
curl -L -o vosk-model-de-0.21.zip https://alphacephei.com/vosk/models/vosk-model-de-0.21.zip

echo "Extracting large model..."
unzip vosk-model-de-0.21.zip

cd ..

echo "Vosk models downloaded successfully!"
echo "Available models:"
echo "  - vosk-models/vosk-model-small-de-0.15 (fast, real-time, 45MB)"
echo "  - vosk-models/vosk-model-de-0.21 (DEFAULT - high accuracy medical transcription, 1.4GB)"
echo ""
echo "System configured to use the large model (vosk-model-de-0.21) by default."
echo "For development/testing, you can switch to the small model in .env file."