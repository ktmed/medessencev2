#!/bin/bash

# Start only the Ontology Service for development/testing
# Use this when the main app is already running

echo "🧠 Starting Ontology Service Only..."
echo "===================================="

# Navigate to semantic service directory
cd "$(dirname "$0")/services/semantic"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing Python dependencies..."
pip install -q -r requirements.txt

# Download spaCy German model if needed
if ! python -c "import spacy; spacy.load('de_core_news_sm')" 2>/dev/null; then
    echo "Downloading German language model..."
    python -m spacy download de_core_news_sm
fi

# Start the ontology service
echo ""
echo "Starting Ontology Service on http://localhost:8001"
echo "API Documentation: http://localhost:8001/docs"
echo ""
echo "Press Ctrl+C to stop"
echo "===================================="

# Run the service
python api_server.py