#!/bin/bash

# MedEssence AI with Ontology Service Startup Script
# This script starts both the frontend and the ontology service

echo "🚀 Starting MedEssence AI with Ontology Enhancement..."
echo "================================================"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $ONTOLOGY_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Services stopped"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not installed"
    exit 1
fi

# Start Ontology Service
echo ""
echo "🧬 Starting Medical Ontology Service..."
echo "----------------------------------------"
cd ontology/service

# Start ontology service in background
python3 realtime_ontology_service.py &
ONTOLOGY_PID=$!
echo "✅ Ontology service starting on http://localhost:8002"

# Wait a moment for ontology service to start
sleep 3

# Check if ontology service is running
if ! curl -s http://localhost:8002/health > /dev/null 2>&1; then
    echo "⚠️  Ontology service may not be fully operational"
    echo "   The frontend will still work but without real-time corrections"
else
    echo "✅ Ontology service is healthy"
fi

# Start Frontend
echo ""
echo "🎨 Starting MedEssence Frontend..."
echo "----------------------------------------"
cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Start frontend in foreground (this will show the output)
echo ""
echo "================================================"
echo "✅ Services are starting..."
echo ""
echo "📍 Frontend: http://localhost:3010"
echo "📍 Ontology API: http://localhost:8002"
echo "📍 Ontology Docs: http://localhost:8002/docs"
echo ""
echo "Press Ctrl+C to stop all services"
echo "================================================"
echo ""

npm run dev &
FRONTEND_PID=$!

# Wait for frontend process
wait $FRONTEND_PID