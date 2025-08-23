#!/bin/bash

# MedEssence AI - Start All Services with Ontology Support
# This script starts both the Python ontology service and the main application

echo "🚀 Starting MedEssence AI with Ontology Support..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    
    # Kill the ontology service
    if [ ! -z "$ONTOLOGY_PID" ]; then
        echo "Stopping ontology service (PID: $ONTOLOGY_PID)..."
        kill $ONTOLOGY_PID 2>/dev/null
    fi
    
    # Kill the backend service
    if [ ! -z "$BACKEND_PID" ]; then
        echo "Stopping backend service (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null
    fi
    
    # Kill the frontend service
    if [ ! -z "$FRONTEND_PID" ]; then
        echo "Stopping frontend service (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null
    fi
    
    exit 0
}

# Set trap for cleanup on script exit
trap cleanup EXIT INT TERM

# Check Python installation
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed. Please install Python 3.9+ first.${NC}"
    exit 1
fi

# Check Node.js installation
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
    exit 1
fi

# Navigate to project root
cd "$(dirname "$0")"

echo -e "${GREEN}📦 Installing Python dependencies for ontology service...${NC}"
cd services/semantic

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install Python dependencies
pip install -q -r requirements.txt

# Download spaCy German model if not already installed
if ! python -c "import spacy; spacy.load('de_core_news_sm')" 2>/dev/null; then
    echo -e "${YELLOW}Downloading German language model for NLP...${NC}"
    python -m spacy download de_core_news_sm
fi

# Start the ontology service
echo -e "${GREEN}🧠 Starting Ontology Service on port 8001...${NC}"
python api_server.py &
ONTOLOGY_PID=$!

# Wait for ontology service to start
echo "Waiting for ontology service to be ready..."
sleep 5

# Check if ontology service is running
if check_port 8001; then
    echo -e "${GREEN}✅ Ontology service is running on http://localhost:8001${NC}"
else
    echo -e "${YELLOW}⚠️ Ontology service may not be fully started. Continuing anyway...${NC}"
fi

# Navigate back to project root
cd ../..

# Set environment variable to use ontology enhancement
export USE_ONTOLOGY_ENHANCEMENT=true
export ONTOLOGY_SERVICE_URL=http://localhost:8001

# Check if backend dependencies are installed
if [ ! -d "backend/node_modules" ]; then
    echo -e "${GREEN}📦 Installing backend dependencies...${NC}"
    cd backend
    npm install
    cd ..
fi

# Check if frontend dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${GREEN}📦 Installing frontend dependencies...${NC}"
    cd frontend
    npm install
    cd ..
fi

# Start the backend service
echo -e "${GREEN}🔧 Starting Backend Service on port 5000...${NC}"
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Check if backend is running
if check_port 5000; then
    echo -e "${GREEN}✅ Backend service is running on http://localhost:5000${NC}"
else
    echo -e "${YELLOW}⚠️ Backend service may not be fully started. Continuing anyway...${NC}"
fi

# Start the frontend service
echo -e "${GREEN}🎨 Starting Frontend Service on port 3000...${NC}"
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
sleep 5

# Check if frontend is running
if check_port 3000; then
    echo -e "${GREEN}✅ Frontend service is running on http://localhost:3000${NC}"
else
    echo -e "${YELLOW}⚠️ Frontend service may not be fully started.${NC}"
fi

echo ""
echo "================================================"
echo -e "${GREEN}🎉 MedEssence AI is running with Ontology Support!${NC}"
echo ""
echo "Services:"
echo "  📱 Frontend: http://localhost:3000"
echo "  🔧 Backend:  http://localhost:5000"
echo "  🧠 Ontology: http://localhost:8001"
echo "  📚 Ontology Docs: http://localhost:8001/docs"
echo ""
echo "Features enabled:"
echo "  ✅ Semantic enhancement of transcriptions"
echo "  ✅ Ontology-based ICD code suggestions"
echo "  ✅ Medical entity extraction"
echo "  ✅ Knowledge graph generation"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo "================================================"

# Keep the script running
wait