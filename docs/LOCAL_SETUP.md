# Local Installation Guide - Radiology AI System

This guide will help you set up the Real-Time Radiology AI System on your local machine.

## Prerequisites

### System Requirements
- **OS**: macOS 10.15+, Ubuntu 20.04+, or Windows 10+ with WSL2
- **RAM**: Minimum 8GB (16GB recommended)
- **Storage**: 10GB free space (for models and dependencies)
- **CPU**: 4+ cores recommended
- **Network**: Stable internet for initial setup

### Required Software
1. **Node.js** (v18 or later)
2. **Python** (3.9 or later)
3. **Git**
4. **Docker** (optional, for containerized deployment)

## Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Clone the repository
git clone https://github.com/your-org/radiology-ai-system.git
cd radiology-ai-system

# Run the setup script
./setup.sh

# Start the system
./start.sh
```

### Option 2: Manual Setup

Follow the step-by-step instructions below.

## Step-by-Step Installation

### 1. Install System Dependencies

#### macOS
```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install node@18 python@3.11 ffmpeg portaudio

# Install pip
curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
python3 get-pip.py
```

#### Ubuntu/Debian
```bash
# Update package list
sudo apt update

# Install dependencies
sudo apt install -y nodejs npm python3.11 python3-pip ffmpeg portaudio19-dev

# Install Node.js 18 (if needed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

#### Windows (WSL2)
```bash
# In WSL2 terminal
sudo apt update
sudo apt install -y nodejs npm python3.11 python3-pip ffmpeg portaudio19-dev
```

### 2. Clone the Repository

```bash
git clone https://github.com/your-org/radiology-ai-system.git
cd radiology-ai-system
```

### 3. Download Vosk Model

```bash
# Create models directory
mkdir -p vosk-models

# Download German large model (1.8GB)
cd vosk-models
wget https://alphacephei.com/vosk/models/vosk-model-de-0.21.zip
unzip vosk-model-de-0.21.zip
rm vosk-model-de-0.21.zip
cd ..

# For faster setup, use small model instead (45MB):
# wget https://alphacephei.com/vosk/models/vosk-model-small-de-0.15.zip
```

### 4. Set Up Environment Variables

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your API keys
nano .env  # or use your preferred editor
```

Add your API keys to `.env`:
```
# Required API Keys
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_claude_api_key_here
GOOGLE_API_KEY=your_gemini_api_key_here

# Optional Configuration
PORT=3000
WEBSOCKET_PORT=8080
VOSK_PORT=8002
NODE_ENV=development
LOG_LEVEL=info
```

### 5. Install Frontend Dependencies

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Build the frontend
npm run build

# Return to root
cd ..
```

### 6. Install Backend Dependencies

```bash
# Install Node.js dependencies for websocket proxy
cd websocket-proxy
npm install
cd ..

# Install Python dependencies for Vosk
pip3 install -r requirements.txt
```

### 7. Initialize Database (Optional)

If you want to persist reports locally:

```bash
# Install PostgreSQL (macOS)
brew install postgresql@15
brew services start postgresql@15

# Install PostgreSQL (Ubuntu)
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Create database
createdb radiology_reports

# Run migrations (if available)
# psql radiology_reports < database/schema.sql
```

### 8. Start the Services

#### Option A: Using the start script
```bash
./start.sh
```

#### Option B: Manual start
```bash
# Terminal 1: Start Vosk transcription service
python3 transcription-service-vosk.py

# Terminal 2: Start WebSocket proxy
cd websocket-proxy
node server.js

# Terminal 3: Start frontend (development mode)
cd frontend
npm run dev
```

### 9. Access the Application

Open your browser and navigate to:
- Frontend: http://localhost:3000
- WebSocket health check: http://localhost:8080/health
- Vosk health check: http://localhost:8003/health

## Troubleshooting

### Common Issues and Solutions

#### 1. Vosk Model Not Found
```
Error: Model not found at path vosk-models/vosk-model-de-0.21
```
**Solution**: Ensure you've downloaded and extracted the model to the correct directory.

#### 2. Port Already in Use
```
Error: Port 8080 is already in use
```
**Solution**: Either kill the process using the port or change the port in `.env`:
```bash
# Find process using port
lsof -i :8080  # macOS/Linux
netstat -ano | findstr :8080  # Windows

# Kill the process
kill -9 <PID>
```

#### 3. Microphone Permission Denied
**Solution**: 
- **macOS**: System Preferences → Security & Privacy → Microphone → Allow browser
- **Ubuntu**: Check browser permissions in settings
- **Windows**: Settings → Privacy → Microphone → Allow apps

#### 4. WebSocket Connection Failed
**Solution**: 
- Check if all services are running
- Verify firewall settings allow WebSocket connections
- Try using `ws://localhost:8080` instead of `wss://`

#### 5. Python Module Import Errors
```
ModuleNotFoundError: No module named 'vosk'
```
**Solution**: 
```bash
pip3 install --upgrade vosk websockets numpy aiohttp
```

## Docker Setup (Alternative)

For easier deployment, use Docker:

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Performance Optimization

### 1. Use Smaller Vosk Model for Testing
```python
# In transcription-service-vosk.py
self.model_path = "vosk-models/vosk-model-small-de-0.15"  # 45MB vs 1.8GB
```

### 2. Adjust Audio Buffer Size
```javascript
// In vad-processor.js
this.chunkSize = 4800;  // Reduce for lower latency
```

### 3. Limit Concurrent Connections
```javascript
// In websocket-proxy.js
const MAX_CONCURRENT_SESSIONS = 5;  // Adjust based on system resources
```

## Development Mode Features

When running locally, you have access to:
- Hot reload for frontend changes
- Debug logging in all services
- Performance profiling endpoints
- Mock data for testing without API keys

## Health Checks

Verify all services are running:
```bash
# Check all services
curl http://localhost:8080/health
curl http://localhost:8003/health
curl http://localhost:3000/api/health
```

## Stopping the System

### Using the stop script
```bash
./stop.sh
```

### Manual stop
```bash
# Find and kill processes
pkill -f "transcription-service-vosk"
pkill -f "node.*websocket-proxy"
pkill -f "npm.*dev"
```

## Next Steps

1. **Test the system**: Try recording and generating a report
2. **Configure integrations**: Set up EMR/PACS connections if needed
3. **Customize agents**: Modify agents for your specific use cases
4. **Optimize performance**: Adjust settings based on your hardware

## Getting Help

- Check the logs in `logs/` directory
- Review the technical documentation in `docs/`
- Open an issue on GitHub
- Contact support at support@radiology-ai.com

## License

This software is proprietary. See LICENSE file for details.