#!/bin/bash

# Radiology AI System - Automated Setup Script
# This script sets up the complete system on your local machine

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# ASCII Art Banner
echo "
╔═══════════════════════════════════════════════════════════════╗
║                 RADIOLOGY AI SYSTEM SETUP                     ║
║                    Real-Time Medical Transcription            ║
╚═══════════════════════════════════════════════════════════════╝
"

# Check OS
OS="Unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macOS"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="Linux"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    OS="Windows"
fi

echo "Detected OS: $OS"
echo "Starting setup process..."
echo

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "Checking prerequisites..."

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node -v)
    print_status "Node.js installed: $NODE_VERSION"
else
    print_error "Node.js not found. Please install Node.js 18 or later."
    if [[ "$OS" == "macOS" ]]; then
        echo "Run: brew install node@18"
    elif [[ "$OS" == "Linux" ]]; then
        echo "Run: sudo apt install nodejs npm"
    fi
    exit 1
fi

# Check Python
if command_exists python3; then
    PYTHON_VERSION=$(python3 --version)
    print_status "Python installed: $PYTHON_VERSION"
else
    print_error "Python 3 not found. Please install Python 3.9 or later."
    exit 1
fi

# Check pip
if command_exists pip3; then
    print_status "pip3 installed"
else
    print_error "pip3 not found. Installing pip..."
    curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
    python3 get-pip.py
    rm get-pip.py
fi

# Create necessary directories
echo
echo "Creating directory structure..."
mkdir -p logs
mkdir -p data
mkdir -p vosk-models
mkdir -p frontend/dist
print_status "Directories created"

# Download Vosk model
echo
echo "Downloading Vosk speech recognition model..."
if [ -d "vosk-models/vosk-model-de-0.21" ]; then
    print_status "Vosk model already exists, skipping download"
else
    print_warning "This will download a 1.8GB model. For faster setup, you can use the small model."
    read -p "Download large model? (y/n, default: y): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        # Download small model
        echo "Downloading small model (45MB)..."
        cd vosk-models
        wget -q --show-progress https://alphacephei.com/vosk/models/vosk-model-small-de-0.15.zip
        unzip -q vosk-model-small-de-0.15.zip
        rm vosk-model-small-de-0.15.zip
        cd ..
        print_status "Small Vosk model downloaded"
        
        # Update configuration to use small model
        sed -i.bak 's/vosk-model-de-0.21/vosk-model-small-de-0.15/g' transcription-service-vosk.py
    else
        # Download large model
        echo "Downloading large model (1.8GB)..."
        cd vosk-models
        wget -q --show-progress https://alphacephei.com/vosk/models/vosk-model-de-0.21.zip
        unzip -q vosk-model-de-0.21.zip
        rm vosk-model-de-0.21.zip
        cd ..
        print_status "Large Vosk model downloaded"
    fi
fi

# Setup environment file
echo
echo "Setting up environment configuration..."
if [ -f ".env" ]; then
    print_warning ".env file already exists"
    read -p "Overwrite existing .env file? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cp .env .env.backup
        print_status "Existing .env backed up to .env.backup"
    else
        print_status "Keeping existing .env file"
    fi
else
    # Create .env from template
    cat > .env << 'EOF'
# Radiology AI System Configuration

# API Keys (Required for AI features)
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_claude_api_key_here
GOOGLE_API_KEY=your_gemini_api_key_here

# Server Configuration
PORT=3000
WEBSOCKET_PORT=8080
VOSK_PORT=8002
VOSK_HEALTH_PORT=8003

# Environment
NODE_ENV=development
LOG_LEVEL=info

# Feature Flags
ENABLE_MULTI_LLM=true
ENABLE_VAD=true
ENABLE_AUDIO_PREPROCESSING=true

# Performance Settings
MAX_CONCURRENT_SESSIONS=10
AUDIO_CHUNK_SIZE=3200
TRANSCRIPTION_BUFFER_SIZE=64000

# Transcription Service
USE_VOSK=true
VOSK_MODEL_PATH=./vosk-models/vosk-model-de-0.21

# Security
ENABLE_CORS=true
CORS_ORIGIN=http://localhost:3000
EOF
    print_status ".env file created"
    print_warning "Please edit .env file to add your API keys"
fi

# Install Python dependencies
echo
echo "Installing Python dependencies..."
pip3 install -q --upgrade pip
pip3 install -q vosk websockets numpy aiohttp python-dotenv
print_status "Python dependencies installed"

# Install Node.js dependencies
echo
echo "Installing Node.js dependencies..."

# WebSocket proxy dependencies
if [ -d "websocket-proxy" ]; then
    cd websocket-proxy
    npm install --silent
    cd ..
    print_status "WebSocket proxy dependencies installed"
else
    print_error "websocket-proxy directory not found"
fi

# Frontend dependencies
if [ -d "frontend" ]; then
    cd frontend
    npm install --silent
    
    # Build frontend
    echo "Building frontend..."
    npm run build --silent
    cd ..
    print_status "Frontend built successfully"
else
    print_error "frontend directory not found"
fi

# Create start script
echo
echo "Creating start/stop scripts..."
cat > start.sh << 'EOF'
#!/bin/bash

# Start all services for Radiology AI System

echo "Starting Radiology AI System..."

# Function to cleanup on exit
cleanup() {
    echo "Stopping services..."
    pkill -f "transcription-service-vosk.py"
    pkill -f "node.*server.js"
    if [ -f "frontend.pid" ]; then
        kill $(cat frontend.pid) 2>/dev/null
        rm frontend.pid
    fi
    echo "Services stopped."
}

trap cleanup EXIT

# Start Vosk transcription service
echo "Starting Vosk transcription service..."
python3 transcription-service-vosk.py > logs/vosk.log 2>&1 &
VOSK_PID=$!
echo "Vosk service started (PID: $VOSK_PID)"

# Wait for Vosk to initialize
sleep 5

# Start WebSocket proxy
echo "Starting WebSocket proxy..."
cd websocket-proxy
node server.js > ../logs/websocket.log 2>&1 &
WEBSOCKET_PID=$!
cd ..
echo "WebSocket proxy started (PID: $WEBSOCKET_PID)"

# Start frontend in production mode
echo "Starting frontend server..."
cd frontend
npm run preview > ../logs/frontend.log 2>&1 &
echo $! > ../frontend.pid
cd ..
echo "Frontend started"

echo
echo "All services started successfully!"
echo
echo "Access the application at:"
echo "  → http://localhost:3000"
echo
echo "Service health checks:"
echo "  → WebSocket: http://localhost:8080/health"
echo "  → Vosk: http://localhost:8003/health"
echo
echo "Logs are available in the logs/ directory"
echo "Press Ctrl+C to stop all services"
echo

# Keep script running
wait $VOSK_PID
EOF

chmod +x start.sh
print_status "start.sh created"

# Create stop script
cat > stop.sh << 'EOF'
#!/bin/bash

echo "Stopping Radiology AI System..."

# Kill Python processes
pkill -f "transcription-service-vosk.py"

# Kill Node processes
pkill -f "node.*server.js"

# Kill frontend process
if [ -f "frontend.pid" ]; then
    kill $(cat frontend.pid) 2>/dev/null
    rm frontend.pid
fi

echo "All services stopped."
EOF

chmod +x stop.sh
print_status "stop.sh created"

# Create development start script
cat > start-dev.sh << 'EOF'
#!/bin/bash

# Start all services in development mode with live reload

echo "Starting Radiology AI System in development mode..."

# Start services in separate terminals if available
if command -v gnome-terminal >/dev/null 2>&1; then
    # Linux with gnome-terminal
    gnome-terminal --tab --title="Vosk" -- bash -c "python3 transcription-service-vosk.py; exec bash"
    gnome-terminal --tab --title="WebSocket" -- bash -c "cd websocket-proxy && npm run dev; exec bash"
    gnome-terminal --tab --title="Frontend" -- bash -c "cd frontend && npm run dev; exec bash"
elif command -v osascript >/dev/null 2>&1; then
    # macOS with Terminal app
    osascript -e 'tell app "Terminal" to do script "cd '$PWD' && python3 transcription-service-vosk.py"'
    osascript -e 'tell app "Terminal" to do script "cd '$PWD'/websocket-proxy && npm run dev"'
    osascript -e 'tell app "Terminal" to do script "cd '$PWD'/frontend && npm run dev"'
else
    # Fallback: instructions for manual start
    echo "Please start the following commands in separate terminals:"
    echo
    echo "Terminal 1: python3 transcription-service-vosk.py"
    echo "Terminal 2: cd websocket-proxy && npm run dev"
    echo "Terminal 3: cd frontend && npm run dev"
fi

echo
echo "Development servers starting..."
echo "Frontend will be available at http://localhost:3000"
EOF

chmod +x start-dev.sh
print_status "start-dev.sh created"

# Final setup summary
echo
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    SETUP COMPLETE! 🎉                         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo
echo "Next steps:"
echo "1. Add your API keys to the .env file:"
echo "   → OPENAI_API_KEY"
echo "   → ANTHROPIC_API_KEY" 
echo "   → GOOGLE_API_KEY"
echo
echo "2. Start the system:"
echo "   → Production mode: ./start.sh"
echo "   → Development mode: ./start-dev.sh"
echo
echo "3. Access the application:"
echo "   → http://localhost:3000"
echo
echo "For help, see LOCAL_SETUP.md or run ./start.sh --help"
echo

# Verify setup
read -p "Would you like to start the system now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ./start.sh
fi