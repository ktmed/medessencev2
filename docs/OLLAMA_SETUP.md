# Ollama Integration Setup Guide

This guide walks you through setting up Ollama for local medical AI inference, replacing the complex llama.cpp bindings with a much simpler REST API approach.

## Overview

The Ollama integration provides:
- **Simple REST API** instead of complex native bindings
- **Built-in model management** with automatic downloading and caching
- **Better resource management** with automatic GPU utilization
- **Easier deployment** without native dependencies
- **Model versioning** and easy switching between models
- **Production-ready** with health checks and monitoring

## Prerequisites

### System Requirements
- **Memory**: Minimum 4GB RAM (8GB+ recommended for better models)
- **Storage**: 5-10GB free space for models
- **OS**: Linux, macOS, or Windows with WSL2
- **Network**: Internet connection for initial model downloads

### Dependencies
- Node.js 18+ (for the main application)
- curl (for API testing)

## Installation Steps

### 1. Install Ollama

#### Automated Installation (Recommended)
```bash
# Run the automated setup script
./scripts/setup-ollama.sh
```

This script will:
- Install Ollama for your operating system
- Start the Ollama service
- Download recommended medical models
- Create custom medical model configurations
- Test the installation

#### Manual Installation

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**macOS:**
```bash
# Using Homebrew
brew install ollama

# Or download from https://ollama.ai/download
```

**Windows:**
Download and install from [ollama.ai/download](https://ollama.ai/download)

### 2. Start Ollama Service

```bash
# Start Ollama server
ollama serve
```

The service will run on `http://localhost:11434`

### 3. Install Medical Models

#### Option A: Use Recommended Models
```bash
# Install Gemma 2B (good balance of quality and performance)
ollama pull gemma2:2b

# Install Llama 3.1 8B (higher quality, requires more RAM)
ollama pull llama3.1:8b

# Install Mistral 7B (alternative option)
ollama pull mistral
```

#### Option B: Import Your Existing GGUF Models
If you have existing GGUF models:
```bash
# Import your GGUF files into Ollama
./scripts/import-gguf-models.sh /path/to/your/gguf/models

# Or use default location
./scripts/import-gguf-models.sh
```

### 4. Update Environment Configuration

Add to your `.env` file:
```bash
# Ollama Configuration
OLLAMA_HOST=localhost
OLLAMA_PORT=11434
OLLAMA_DEFAULT_MODEL=gemma2:2b

# Optional: Enable Ollama as priority provider
AI_PROVIDER_PRIORITY=ollama,claude,gemini,openai
```

### 5. Test the Integration

```bash
# Test Ollama API directly
curl http://localhost:11434/api/version

# Test model generation
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemma2:2b",
    "prompt": "Generate a JSON response with status: ok",
    "stream": false
  }'

# Test with your application
npm run test:ollama
```

## Model Management

### Available Models

The system supports several model types:

| Model | Size | RAM Required | Quality | Speed | Use Case |
|-------|------|--------------|---------|-------|----------|
| `gemma2:2b` | ~1.6GB | 3GB | Good | Fast | General medical reports |
| `llama3.1:8b` | ~4.7GB | 8GB | Excellent | Medium | High-quality reports |
| `mistral` | ~4.1GB | 6GB | Very Good | Medium | Alternative option |
| Custom Medical | Varies | Varies | Optimized | Varies | Your GGUF models |

### Model Operations

```bash
# List installed models
ollama list

# Pull a new model
ollama pull llama3.1:8b

# Remove a model
ollama rm old-model

# Show model details
ollama show gemma2:2b

# Run interactive chat
ollama run gemma2:2b
```

### Creating Custom Medical Models

You can create specialized medical models with custom system prompts:

```bash
# Create a modelfile
cat > medical-gemma.Modelfile << EOF
FROM gemma2:2b

SYSTEM "You are a specialized German medical AI assistant for radiology reports..."

PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER repeat_penalty 1.1
EOF

# Create the custom model
ollama create medical-gemma -f medical-gemma.Modelfile
```

## Integration Architecture

### Service Layer
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │───▶│  Multi-LLM       │───▶│  Ollama Model   │
│   Application   │    │  Service         │    │  Service        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                          │
                              ▼                          ▼
                       ┌──────────────┐         ┌───────────────┐
                       │  Cloud APIs  │         │  Ollama API   │
                       │  (Fallback)  │         │ localhost:11434│
                       └──────────────┘         └───────────────┘
```

### Fallback Chain
1. **Ollama Models** (highest priority) - Local, private, fast
2. **Claude API** - High quality, cloud-based
3. **Gemini API** - Good performance, cost-effective
4. **OpenAI API** - Reliable fallback
5. **Rule-based Parser** - Last resort

## Configuration Options

### Environment Variables

```bash
# Ollama Service Configuration
OLLAMA_HOST=localhost          # Ollama server host
OLLAMA_PORT=11434             # Ollama server port
OLLAMA_DEFAULT_MODEL=gemma2:2b # Default model to use

# Model Selection Strategy
OLLAMA_AUTO_SELECT=true       # Automatically select best available model
OLLAMA_FALLBACK_ENABLED=true  # Enable fallback to cloud APIs
OLLAMA_HEALTH_CHECK_INTERVAL=300000  # Health check interval (5 minutes)

# Performance Tuning
OLLAMA_MAX_CONCURRENT=3       # Maximum concurrent requests
OLLAMA_REQUEST_TIMEOUT=60000  # Request timeout in milliseconds
OLLAMA_CONTEXT_LENGTH=2048    # Context window size
```

### Model Parameters

Optimize these parameters in your model configurations:

```javascript
{
  temperature: 0.3,     // Lower = more consistent (medical reports)
  top_p: 0.9,          // Nucleus sampling threshold
  repeat_penalty: 1.1,  // Prevent repetitive text
  num_predict: 2048,    // Maximum tokens to generate
  num_ctx: 2048,       // Context window size
  seed: -1             // Random seed (-1 for random)
}
```

## Troubleshooting

### Common Issues

#### 1. Ollama Service Not Running
```bash
# Check if service is running
curl http://localhost:11434/api/version

# If not running, start it
ollama serve

# Check for port conflicts
lsof -i :11434
```

#### 2. Model Not Found
```bash
# List available models
ollama list

# Pull missing model
ollama pull gemma2:2b

# Check model exists
ollama show gemma2:2b
```

#### 3. Out of Memory Errors
```bash
# Check system memory
free -h  # Linux
vm_stat  # macOS

# Use smaller quantized models
ollama pull gemma2:2b-q4_0  # 4-bit quantization
```

#### 4. Slow Generation
```bash
# Check CPU usage
top -p $(pgrep ollama)

# Enable GPU acceleration (if available)
ollama pull gemma2:2b  # Will use GPU automatically

# Adjust model parameters
# Lower num_predict, increase temperature slightly
```

### Logging and Monitoring

#### Enable Debug Logging
```bash
# Set environment variable
export OLLAMA_DEBUG=1

# Or in .env file
OLLAMA_DEBUG=1
LOG_LEVEL=debug
```

#### Check Service Logs
```bash
# View service logs
tail -f /tmp/ollama.log

# Check system logs
journalctl -u ollama  # Linux with systemd
```

#### Health Monitoring
```bash
# Health check endpoint
curl http://localhost:11434/api/version

# Model status
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model": "gemma2:2b", "prompt": "test", "stream": false}'
```

## Performance Optimization

### Hardware Recommendations

**Minimum Configuration:**
- 4GB RAM
- 2 CPU cores
- 10GB storage

**Recommended Configuration:**
- 8GB+ RAM
- 4+ CPU cores
- 20GB+ SSD storage
- GPU (optional, for acceleration)

**Production Configuration:**
- 16GB+ RAM
- 8+ CPU cores
- 50GB+ NVMe SSD
- Dedicated GPU (RTX 3060 or better)

### Model Selection Strategy

1. **Development**: `gemma2:2b` - Fast, good enough for testing
2. **Production**: `llama3.1:8b` - High quality, worth the resources
3. **Resource-Constrained**: Custom quantized models
4. **High-Volume**: Multiple model instances with load balancing

### Deployment Considerations

#### Docker Deployment
```yaml
version: '3.8'
services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_HOST=0.0.0.0
    restart: unless-stopped

volumes:
  ollama_data:
```

#### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ollama
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ollama
  template:
    metadata:
      labels:
        app: ollama
    spec:
      containers:
      - name: ollama
        image: ollama/ollama:latest
        ports:
        - containerPort: 11434
        resources:
          requests:
            memory: "4Gi"
            cpu: "2"
          limits:
            memory: "8Gi"
            cpu: "4"
```

## API Reference

### Generate Text
```bash
POST /api/generate
Content-Type: application/json

{
  "model": "gemma2:2b",
  "prompt": "Your medical report prompt here",
  "stream": false,
  "options": {
    "temperature": 0.3,
    "top_p": 0.9,
    "repeat_penalty": 1.1,
    "num_predict": 2048
  }
}
```

### List Models
```bash
GET /api/tags
```

### Model Information
```bash
POST /api/show
Content-Type: application/json

{
  "name": "gemma2:2b"
}
```

### Health Check
```bash
GET /api/version
```

## Migration from llama.cpp

If migrating from the old llama.cpp integration:

### 1. Update Dependencies
```bash
# Remove old llama.cpp bindings (optional)
npm uninstall llama-node node-llama-cpp

# No new Node.js dependencies needed - uses HTTP API
```

### 2. Replace Service
- Old: `LocalModelService` with complex native bindings
- New: `OllamaModelService` with simple HTTP requests

### 3. Model Conversion
```bash
# Convert existing GGUF models
./scripts/import-gguf-models.sh ./portable_models
```

### 4. Update Configuration
- Remove llama.cpp specific settings
- Add Ollama configuration to `.env`

### 5. Test Migration
```bash
# Run migration tests
npm run test:migration

# Compare outputs
npm run test:compare-outputs
```

## Best Practices

### Security
1. **Local-First**: Keep sensitive data on-premises
2. **API Security**: Use localhost only in development
3. **Model Validation**: Verify model integrity after download
4. **Access Control**: Restrict API access in production

### Performance
1. **Model Caching**: Keep frequently used models loaded
2. **Request Batching**: Batch multiple requests when possible  
3. **Context Management**: Optimize context window usage
4. **Resource Monitoring**: Monitor RAM and CPU usage

### Reliability
1. **Health Checks**: Implement regular health monitoring
2. **Fallback Strategy**: Always have cloud API fallback
3. **Error Handling**: Graceful degradation on failures
4. **Logging**: Comprehensive logging for troubleshooting

## Support and Resources

### Documentation
- [Ollama Official Docs](https://ollama.ai/docs)
- [Model Library](https://ollama.ai/library)
- [API Reference](https://github.com/ollama/ollama/blob/main/docs/api.md)

### Community
- [Ollama GitHub](https://github.com/ollama/ollama)
- [Discord Community](https://discord.gg/ollama)
- [Reddit r/ollama](https://reddit.com/r/ollama)

### Troubleshooting
If you encounter issues:
1. Check the [troubleshooting section](#troubleshooting) above
2. Review service logs: `tail -f /tmp/ollama.log`
3. Test API connectivity: `curl http://localhost:11434/api/version`
4. Verify model availability: `ollama list`
5. Check system resources: `htop` or Activity Monitor

For RadExtract-specific issues, check the application logs and ensure the multi-LLM service is properly configured to use the Ollama provider.