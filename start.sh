#!/bin/bash

# MedEssence AI - Local Development Server
# This starts the ONLY working version - frontend on port 3010

echo "🚀 Starting MedEssence AI Local Development Server..."
echo "=================================================="
echo ""

# Check if we're in the right directory
if [ ! -d "frontend" ]; then
    echo "❌ Error: frontend directory not found!"
    echo "Please run this script from the project root directory."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing dependencies..."
    cd frontend && npm install && cd ..
fi

# Start the frontend server
echo "✅ Starting frontend server on http://localhost:3010"
echo ""
echo "📝 Features available:"
echo "  • Medical transcription using WebSpeech API (browser-native)"
echo "  • AI-powered report generation (Claude, Gemini, OpenAI)"
echo "  • ICD code generation"
echo "  • Enhanced findings extraction"
echo ""
echo "🌐 Also deployed at: https://medessencev3.vercel.app"
echo ""
echo "Press Ctrl+C to stop the server"
echo "=================================================="
echo ""

cd frontend && npm run dev