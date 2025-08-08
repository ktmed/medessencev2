#!/bin/bash

echo "Installing Vosk and dependencies..."

# Create Python virtual environment
python3 -m venv vosk-env

# Activate virtual environment
source vosk-env/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install Vosk
pip install vosk

# Install additional dependencies
pip install websockets
pip install numpy
pip install soundfile
pip install aiohttp

echo "Vosk installation complete!"
echo "To use Vosk, activate the virtual environment with: source vosk-env/bin/activate"