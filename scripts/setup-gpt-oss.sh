#!/bin/bash

# GPT-OSS-20B Setup Script for RadExtract Medical AI
# Downloads and configures GPT-OSS-20B for offline medical report processing

set -e

echo "🧠 GPT-OSS-20B Setup for RadExtract Medical AI"
echo "=============================================="
echo ""

# Configuration
GPT_OSS_VERSION="gpt-oss-20b-q4_k_m.gguf"
MODELS_DIR="./gpt-oss-models"
DOWNLOAD_URL="https://huggingface.co/lmstudio-community/gpt-oss-20b-GGUF/resolve/main/$GPT_OSS_VERSION"

# Check system requirements
echo "🔍 Checking system requirements..."

# Check available RAM
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    TOTAL_RAM_MB=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024)}')
else
    # Linux
    TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "0")
    TOTAL_RAM_MB=$((TOTAL_RAM_KB / 1024))
fi

if [ $TOTAL_RAM_MB -eq 0 ]; then
    echo "⚠️  Could not determine RAM size. Please ensure you have at least 16GB RAM."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "💾 Total RAM: ${TOTAL_RAM_MB}MB"
    if [ $TOTAL_RAM_MB -lt 12000 ]; then
        echo "❌ Insufficient RAM: ${TOTAL_RAM_MB}MB available, 12GB+ required for GPT-OSS-20B Q4"
        echo "💡 Consider using a smaller quantization (Q3) or ensure more RAM is available"
        exit 1
    elif [ $TOTAL_RAM_MB -lt 16000 ]; then
        echo "⚠️  Limited RAM: ${TOTAL_RAM_MB}MB available, 16GB+ recommended for optimal performance"
    else
        echo "✅ RAM requirements met"
    fi
fi

# Check CPU cores
CPU_CORES=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo "1")
echo "🖥️  CPU cores: $CPU_CORES"
if [ $CPU_CORES -lt 4 ]; then
    echo "⚠️  Limited CPU cores. Performance may be slower."
fi

# Check available disk space
AVAILABLE_SPACE_KB=$(df . | tail -1 | awk '{print $4}')
AVAILABLE_SPACE_GB=$((AVAILABLE_SPACE_KB / 1024 / 1024))
echo "💽 Available disk space: ${AVAILABLE_SPACE_GB}GB"

if [ $AVAILABLE_SPACE_GB -lt 15 ]; then
    echo "❌ Insufficient disk space: ${AVAILABLE_SPACE_GB}GB available, 15GB+ required"
    exit 1
else
    echo "✅ Disk space requirements met"
fi

echo ""
echo "📋 System Requirements Summary:"
echo "   RAM: $TOTAL_RAM_MB MB (12GB+ required)"
echo "   CPU: $CPU_CORES cores (4+ recommended)" 
echo "   Disk: $AVAILABLE_SPACE_GB GB (15GB+ required)"
echo ""

# Create models directory
echo "📁 Creating models directory..."
mkdir -p "$MODELS_DIR"

# Check if model already exists
MODEL_PATH="$MODELS_DIR/$GPT_OSS_VERSION"
if [ -f "$MODEL_PATH" ]; then
    echo "✅ GPT-OSS-20B model already exists: $MODEL_PATH"
    echo "📏 Model size: $(du -h "$MODEL_PATH" | cut -f1)"
    
    read -p "Re-download model? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "🚀 Skipping download. Proceeding to setup..."
        SKIP_DOWNLOAD=true
    else
        echo "🗑️  Removing existing model..."
        rm -f "$MODEL_PATH"
    fi
fi

# Download model if needed
if [ "$SKIP_DOWNLOAD" != "true" ]; then
    echo "⬇️  Downloading GPT-OSS-20B model..."
    echo "📦 Model: $GPT_OSS_VERSION"
    echo "🔗 URL: $DOWNLOAD_URL"
    echo "📍 Destination: $MODEL_PATH"
    echo ""
    echo "⏳ This may take 15-45 minutes depending on your connection..."
    echo "   Model size: ~12GB"
    echo ""

    # Download with progress
    if command -v wget >/dev/null 2>&1; then
        wget --progress=bar:force:noscroll -O "$MODEL_PATH" "$DOWNLOAD_URL"
    elif command -v curl >/dev/null 2>&1; then
        curl -L --progress-bar -o "$MODEL_PATH" "$DOWNLOAD_URL"
    else
        echo "❌ Neither wget nor curl found. Please install one of them."
        exit 1
    fi

    if [ $? -eq 0 ]; then
        echo "✅ Model downloaded successfully"
        echo "📏 Downloaded size: $(du -h "$MODEL_PATH" | cut -f1)"
    else
        echo "❌ Download failed"
        exit 1
    fi
fi

# Install Node.js dependencies
echo ""
echo "📦 Installing Node.js dependencies..."
cd services/core

# Check if node-llama-cpp is available
if npm list node-llama-cpp >/dev/null 2>&1; then
    echo "✅ node-llama-cpp already installed"
else
    echo "📥 Installing node-llama-cpp..."
    npm install node-llama-cpp@latest || {
        echo "⚠️  node-llama-cpp installation failed, trying alternative..."
        npm install @node-llama/node-llama-cpp@latest || {
            echo "❌ Failed to install llama.cpp bindings"
            echo "💡 You may need to install build tools: npm install -g node-gyp"
            exit 1
        }
    }
fi

cd ../..

# Create environment configuration
echo ""
echo "⚙️  Creating environment configuration..."

# Add GPT-OSS configuration to .env
ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
    echo "📄 Creating .env file..."
    cp .env.example "$ENV_FILE" || touch "$ENV_FILE"
fi

# Check if GPT-OSS config already exists
if grep -q "GPT_OSS_MODEL" "$ENV_FILE"; then
    echo "✅ GPT-OSS configuration already exists in .env"
else
    echo "📝 Adding GPT-OSS configuration to .env..."
    cat >> "$ENV_FILE" << EOF

# GPT-OSS-20B Configuration
GPT_OSS_MODEL=gpt-oss-20b-q4
GPT_OSS_MODELS_PATH=./gpt-oss-models
GPT_OSS_THREADS=auto
GPT_OSS_GPU_LAYERS=20
# GPT_OSS_GPU_MEMORY=8192  # Uncomment and set GPU memory in MB if you have a GPU

EOF
    echo "✅ GPT-OSS configuration added"
fi

# Test the installation
echo ""
echo "🧪 Testing GPT-OSS-20B installation..."

# Create test script
cat > test-gpt-oss.js << 'EOF'
const GPTOSSModelService = require('./services/core/llm/gpt-oss-service');

async function testGPTOSS() {
    console.log('🔧 Testing GPT-OSS-20B Model Service...');
    
    const service = new GPTOSSModelService();
    
    try {
        // Health check before initialization
        const preHealth = await service.healthCheck();
        console.log('📊 Pre-initialization health:', preHealth);
        
        // Initialize
        console.log('🚀 Initializing GPT-OSS-20B...');
        const initialized = await service.initialize();
        
        if (initialized) {
            console.log('✅ GPT-OSS-20B initialized successfully!');
            
            // Health check after initialization
            const postHealth = await service.healthCheck();
            console.log('📊 Post-initialization health:', postHealth);
            
            // Quick test generation
            console.log('🧪 Running quick test...');
            const testPrompt = 'Generate a brief medical report structure in German.';
            const result = await service.generateReport(testPrompt, 'de');
            
            console.log('✅ Test generation successful!');
            console.log('📈 Performance:', {
                model: result.modelUsed,
                inference_time: result.inferenceTime + 'ms',
                tokens_generated: result.tokensGenerated
            });
            
            // Cleanup
            await service.cleanup();
            console.log('🎉 GPT-OSS-20B test completed successfully!');
            
        } else {
            console.log('❌ GPT-OSS-20B initialization failed');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

testGPTOSS();
EOF

echo "🏃 Running integration test..."
node test-gpt-oss.js

# Clean up test file
rm test-gpt-oss.js

echo ""
echo "🎉 GPT-OSS-20B Setup Complete!"
echo "================================"
echo ""
echo "📋 Installation Summary:"
echo "   ✅ Model downloaded: $MODEL_PATH"
echo "   ✅ Dependencies installed: node-llama-cpp"
echo "   ✅ Environment configured: .env"
echo "   ✅ Integration test passed"
echo ""
echo "🚀 GPT-OSS-20B is now ready for offline medical report processing!"
echo ""
echo "🔧 Configuration:"
echo "   Model: GPT-OSS-20B MXFP4 (Recommended)"
echo "   RAM Usage: ~12-16GB during inference"
echo "   Performance: Medium speed, excellent quality"
echo "   Location: $MODEL_PATH"
echo ""
echo "💡 Usage Tips:"
echo "   - GPT-OSS-20B has highest priority in local model fallback"
echo "   - Will be automatically used when available"
echo "   - Fallback: Ollama → Claude → Gemini → OpenAI"
echo ""
echo "🖥️  To start the system:"
echo "   docker-compose up -d"
echo ""
echo "📊 Monitor GPT-OSS-20B:"
echo "   docker logs radiology-ai-system-websocket-proxy-1 | grep GPT-OSS"