#!/bin/bash

echo "Installing WhisperX and dependencies..."

# Create Python virtual environment
python3 -m venv whisperx-env

# Activate virtual environment
source whisperx-env/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install PyTorch (CPU version for Mac)
pip install torch torchvision torchaudio

# Install WhisperX
pip install git+https://github.com/m-bain/whisperx.git

# Install additional dependencies
pip install websockets
pip install numpy
pip install soundfile

echo "WhisperX installation complete!"
echo "To use WhisperX, activate the virtual environment with: source whisperx-env/bin/activate"