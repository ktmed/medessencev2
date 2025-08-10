#!/bin/bash
# MedEssence AI - Quick System Startup Script
# Use this after laptop crash to resume immediately

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 MedEssence AI - System Startup${NC}"
echo "=================================================="

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill process on port
kill_port() {
    echo -e "${YELLOW}⚠️  Killing existing process on port $1${NC}"
    lsof -ti:$1 | xargs kill -9 2>/dev/null || true
    sleep 2
}

# Step 1: Check Ollama
echo -e "\n${BLUE}1️⃣ Checking Ollama...${NC}"
if curl -s http://localhost:11434/api/version > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Ollama is running${NC}"
    OLLAMA_VERSION=$(curl -s http://localhost:11434/api/version | jq -r '.version' 2>/dev/null || echo "unknown")
    echo "   Version: $OLLAMA_VERSION"
else
    echo -e "${RED}❌ Ollama not running - starting it...${NC}"
    echo "Please run: ollama serve"
    echo "Then run this script again"
    exit 1
fi

# Check available models
MODEL_COUNT=$(ollama list | wc -l)
if [ "$MODEL_COUNT" -gt 1 ]; then
    echo -e "${GREEN}✅ Found $(($MODEL_COUNT - 1)) models available${NC}"
else
    echo -e "${YELLOW}⚠️  No models found - you may need to pull models${NC}"
fi

# Step 2: Start Backend
echo -e "\n${BLUE}2️⃣ Starting Backend (WebSocket Proxy)...${NC}"
if check_port 8080; then
    kill_port 8080
fi

cd services/core
echo "Starting backend service..."
nohup npm start > ../../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ../..

# Wait for backend to start
echo "Waiting for backend to initialize..."
for i in {1..30}; do
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend running on http://localhost:8080${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Backend failed to start${NC}"
        exit 1
    fi
    sleep 1
done

# Step 3: Start Frontend  
echo -e "\n${BLUE}3️⃣ Starting Frontend (Next.js)...${NC}"
if check_port 3010; then
    kill_port 3010
fi

cd frontend
echo "Starting frontend service..."
nohup npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
echo "Waiting for frontend to initialize..."
for i in {1..30}; do
    if curl -s http://localhost:3010 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend running on http://localhost:3010${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Frontend failed to start${NC}"
        exit 1
    fi
    sleep 1
done

# Step 4: System Health Check
echo -e "\n${BLUE}4️⃣ System Health Check...${NC}"

# Check WebSocket connection
sleep 3
echo "Checking WebSocket connection..."
if grep -q "Frontend connected via Socket.IO" logs/backend.log 2>/dev/null; then
    echo -e "${GREEN}✅ WebSocket connection established${NC}"
else
    echo -e "${YELLOW}⚠️  WebSocket connection pending (may take a few more seconds)${NC}"
fi

# Check Ollama integration
if grep -q "Ollama service initialized successfully" logs/backend.log 2>/dev/null; then
    echo -e "${GREEN}✅ Ollama integration working${NC}"
else
    echo -e "${YELLOW}⚠️  Ollama integration still initializing${NC}"
fi

# Final Status
echo -e "\n${GREEN}🎉 SYSTEM STARTUP COMPLETE!${NC}"
echo "=================================================="
echo -e "📊 ${BLUE}Service Status:${NC}"
echo "   🖥️  Backend:  http://localhost:8080 (PID: $BACKEND_PID)"
echo "   🌐 Frontend: http://localhost:3010 (PID: $FRONTEND_PID)"  
echo "   🤖 Ollama:   http://localhost:11434"
echo ""
echo -e "📋 ${BLUE}Next Steps:${NC}"
echo "   1. Open browser: http://localhost:3010"
echo "   2. Check connection status (should show 'Connected')"
echo "   3. Test speech recognition with German medical text"
echo "   4. Generate medical reports using local Ollama models"
echo ""
echo -e "📝 ${BLUE}Logs Location:${NC}"
echo "   Backend:  logs/backend.log"
echo "   Frontend: logs/frontend.log"
echo ""
echo -e "🛑 ${BLUE}To Stop System:${NC}"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo "   or run: pkill -f \"npm\""
echo ""
echo -e "${GREEN}System is ready for development! 🚀${NC}"