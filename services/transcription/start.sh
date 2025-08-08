#!/bin/bash

# Transcription Service Startup Script

set -e

echo "Starting Medical Transcription Service..."

# Create necessary directories
mkdir -p uploads temp models data/medical_dictionaries logs

# Set environment variables if not already set
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Check if .env file exists, if not copy from example
if [ ! -f .env ]; then
    echo "Creating .env file from example..."
    cp .env.example .env
    echo "Please edit .env file with your configuration before running the service."
fi

# Check if Redis is running (if using local Redis)
if [ "$REDIS_HOST" = "localhost" ] || [ "$REDIS_HOST" = "127.0.0.1" ] || [ -z "$REDIS_HOST" ]; then
    if ! nc -z localhost 6379 2>/dev/null; then
        echo "Warning: Redis is not running on localhost:6379"
        echo "Please start Redis or update REDIS_HOST in .env file"
    fi
fi

# Check Python version
python_version=$(python3 --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1,2)
required_version="3.8"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo "Error: Python $required_version or higher is required. Found: $python_version"
    exit 1
fi

# Install dependencies if requirements.txt is newer than the last install
if [ ! -f .install_timestamp ] || [ requirements.txt -nt .install_timestamp ]; then
    echo "Installing/updating Python dependencies..."
    pip install -r requirements.txt
    touch .install_timestamp
fi

# Download Whisper model if not already present
if [ "$USE_LOCAL_WHISPER" = "true" ]; then
    echo "Checking Whisper model availability..."
    python3 -c "import whisper; whisper.load_model('${WHISPER_MODEL:-base}')" 2>/dev/null || {
        echo "Downloading Whisper model: ${WHISPER_MODEL:-base}"
        python3 -c "import whisper; whisper.load_model('${WHISPER_MODEL:-base}')"
    }
fi

# Initialize medical dictionaries
echo "Initializing medical dictionaries..."
python3 -c "
import asyncio
from utils.medical_terminology import MedicalTerminologyProcessor
async def init():
    processor = MedicalTerminologyProcessor()
    await processor._load_dictionaries()
asyncio.run(init())
" || echo "Warning: Could not initialize medical dictionaries"

# Check system dependencies
echo "Checking system dependencies..."

# Check for ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "Warning: ffmpeg not found. Some audio formats may not be supported."
    echo "Install with: sudo apt-get install ffmpeg (Ubuntu/Debian) or brew install ffmpeg (macOS)"
fi

# Set default values
HOST=${HOST:-0.0.0.0}
PORT=${PORT:-8003}
WORKERS=${WORKERS:-4}
LOG_LEVEL=${LOG_LEVEL:-INFO}

echo "Configuration:"
echo "  Host: $HOST"
echo "  Port: $PORT"
echo "  Workers: $WORKERS"
echo "  Log Level: $LOG_LEVEL"
echo "  Whisper Model: ${WHISPER_MODEL:-base}"
echo "  Use Local Whisper: ${USE_LOCAL_WHISPER:-true}"
echo "  Redis Host: ${REDIS_HOST:-localhost}"

# Start the service
echo "Starting transcription service..."

if [ "$1" = "dev" ]; then
    echo "Starting in development mode with auto-reload..."
    uvicorn main:app --host $HOST --port $PORT --reload --log-level $(echo $LOG_LEVEL | tr '[:upper:]' '[:lower:]')
elif [ "$1" = "prod" ]; then
    echo "Starting in production mode..."
    gunicorn main:app -w $WORKERS -k uvicorn.workers.UvicornWorker --bind $HOST:$PORT --log-level $(echo $LOG_LEVEL | tr '[:upper:]' '[:lower:]') --access-logfile - --error-logfile -
else
    echo "Starting with uvicorn..."
    uvicorn main:app --host $HOST --port $PORT --workers 1 --log-level $(echo $LOG_LEVEL | tr '[:upper:]' '[:lower:]')
fi