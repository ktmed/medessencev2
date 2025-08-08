#!/bin/bash

# Ollama Setup Script for Medical AI System
# This script installs Ollama and sets up medical models for local inference

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Log functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check system requirements
check_system() {
    log_info "Checking system requirements..."
    
    # Check OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    else
        log_error "Unsupported operating system: $OSTYPE"
        log_info "Ollama supports Linux and macOS"
        exit 1
    fi
    
    # Check available memory
    if [[ "$OS" == "linux" ]]; then
        TOTAL_MEM=$(free -m | awk 'NR==2{printf "%.0f", $2}')
    elif [[ "$OS" == "macos" ]]; then
        TOTAL_MEM=$(sysctl -n hw.memsize | awk '{printf "%.0f", $1/1024/1024}')
    fi
    
    log_info "Detected OS: $OS"
    log_info "Total memory: ${TOTAL_MEM}MB"
    
    if [[ $TOTAL_MEM -lt 4000 ]]; then
        log_warning "Limited memory detected (${TOTAL_MEM}MB). Consider using smaller quantized models."
    fi
}

# Install Ollama
install_ollama() {
    log_info "Installing Ollama..."
    
    if command -v ollama &> /dev/null; then
        log_info "Ollama is already installed"
        OLLAMA_VERSION=$(ollama --version 2>/dev/null || echo "unknown")
        log_info "Current version: $OLLAMA_VERSION"
    else
        log_info "Downloading and installing Ollama..."
        
        if [[ "$OS" == "linux" ]]; then
            curl -fsSL https://ollama.ai/install.sh | sh
        elif [[ "$OS" == "macos" ]]; then
            # For macOS, we'll use the installer
            log_info "Please download and install Ollama from: https://ollama.ai/download"
            log_info "Or use Homebrew: brew install ollama"
            log_warning "After installation, please run this script again."
            return 1
        fi
        
        log_success "Ollama installed successfully"
    fi
}

# Start Ollama service
start_ollama() {
    log_info "Starting Ollama service..."
    
    # Check if Ollama is already running
    if curl -s http://localhost:11434/api/version &> /dev/null; then
        log_info "Ollama service is already running"
        return 0
    fi
    
    # Start Ollama service in background
    if [[ "$OS" == "linux" ]]; then
        # On Linux, start as systemd service if available, otherwise as background process
        if systemctl --user is-enabled ollama &> /dev/null; then
            systemctl --user start ollama
        else
            nohup ollama serve > /tmp/ollama.log 2>&1 &
            log_info "Started Ollama service in background (PID: $!)"
        fi
    elif [[ "$OS" == "macos" ]]; then
        # On macOS, start as background process
        nohup ollama serve > /tmp/ollama.log 2>&1 &
        log_info "Started Ollama service in background (PID: $!)"
    fi
    
    # Wait for service to be ready
    log_info "Waiting for Ollama service to be ready..."
    for i in {1..30}; do
        if curl -s http://localhost:11434/api/version &> /dev/null; then
            log_success "Ollama service is ready"
            return 0
        fi
        sleep 1
    done
    
    log_error "Failed to start Ollama service"
    return 1
}

# Pull a model with progress and error handling
pull_model() {
    local model_name="$1"
    local display_name="$2"
    
    log_info "Pulling model: $display_name ($model_name)..."
    
    # Check if model already exists
    if ollama list | grep -q "^$model_name"; then
        log_info "Model $model_name already exists, skipping download"
        return 0
    fi
    
    # Pull the model with progress
    if ollama pull "$model_name"; then
        log_success "Successfully pulled $display_name"
        return 0
    else
        log_error "Failed to pull $display_name"
        return 1
    fi
}

# Setup medical models
setup_medical_models() {
    log_info "Setting up medical models..."
    
    # List of models to install (in order of preference)
    declare -a MODELS=(
        "gemma2:2b|Gemma 2 2B (Fallback model)"
        "llama3.1:8b|Llama 3.1 8B (High quality, requires more RAM)"
        "mistral|Mistral 7B (Alternative medical model)"
    )
    
    local installed_count=0
    
    for model_info in "${MODELS[@]}"; do
        IFS='|' read -r model_name display_name <<< "$model_info"
        
        # Check memory requirements
        if [[ "$model_name" == "llama3.1:8b" && $TOTAL_MEM -lt 8000 ]]; then
            log_warning "Skipping $display_name due to insufficient memory (${TOTAL_MEM}MB < 8000MB)"
            continue
        fi
        
        if pull_model "$model_name" "$display_name"; then
            ((installed_count++))
        fi
    done
    
    if [[ $installed_count -eq 0 ]]; then
        log_error "No models were successfully installed"
        return 1
    fi
    
    log_success "Installed $installed_count models"
}

# Create Ollama model files for custom medical models
create_medical_modelfiles() {
    log_info "Creating custom medical model configurations..."
    
    # Create directory for custom modelfiles
    MODELFILE_DIR="$HOME/.ollama/modelfiles"
    mkdir -p "$MODELFILE_DIR"
    
    # Medical Gemma 2B configuration
    cat > "$MODELFILE_DIR/medical-gemma-2b.Modelfile" << EOF
FROM gemma2:2b

# Medical-specific system prompt
SYSTEM """You are a specialized medical AI assistant for German radiology reports. You generate structured, accurate medical reports based on transcribed medical dictations.

IMPORTANT GUIDELINES:
- Use precise medical terminology
- Generate structured JSON responses
- Focus on medical content only
- Ignore administrative information
- Extract ALL relevant medical information
- Maintain professional medical language
"""

# Optimized parameters for medical text generation
PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER repeat_penalty 1.1
PARAMETER num_predict 2048
PARAMETER num_ctx 2048

# Medical-focused prompt template
TEMPLATE """<|im_start|>system
{{ .System }}<|im_end|>
<|im_start|>user
{{ .Prompt }}<|im_end|>
<|im_start|>assistant
"""
EOF

    log_success "Created medical model configuration files"
}

# Create custom medical models from modelfiles
create_medical_models() {
    log_info "Creating custom medical models..."
    
    MODELFILE_DIR="$HOME/.ollama/modelfiles"
    
    # Create medical-gemma-2b model if base model exists
    if ollama list | grep -q "gemma2:2b"; then
        log_info "Creating medical-gemma-2b model..."
        if ollama create medical-gemma-2b -f "$MODELFILE_DIR/medical-gemma-2b.Modelfile"; then
            log_success "Created medical-gemma-2b model"
        else
            log_warning "Failed to create medical-gemma-2b model"
        fi
    else
        log_warning "Base model gemma2:2b not found, skipping medical-gemma-2b creation"
    fi
}

# Test Ollama installation
test_ollama() {
    log_info "Testing Ollama installation..."
    
    # Test API connectivity
    if ! curl -s http://localhost:11434/api/version &> /dev/null; then
        log_error "Cannot connect to Ollama API"
        return 1
    fi
    
    # Get available models
    local model_count=$(ollama list | tail -n +2 | wc -l)
    log_info "Available models: $model_count"
    
    if [[ $model_count -eq 0 ]]; then
        log_warning "No models are available"
        return 1
    fi
    
    # Test a simple generation with the first available model
    local test_model=$(ollama list | tail -n +2 | head -n 1 | awk '{print $1}')
    log_info "Testing model: $test_model"
    
    local test_response=$(ollama run "$test_model" "Generate a simple JSON response with 'status': 'ok'" --timeout 30s 2>/dev/null || echo "")
    
    if [[ -n "$test_response" ]]; then
        log_success "Model test completed successfully"
        log_info "Test response preview: ${test_response:0:100}..."
    else
        log_warning "Model test failed, but installation appears successful"
    fi
}

# Generate setup summary
generate_summary() {
    log_info "Generating setup summary..."
    
    cat << EOF

============================================
Ollama Setup Complete
============================================

Installation Status: $([[ -x "$(command -v ollama)" ]] && echo "✅ Installed" || echo "❌ Not installed")
Service Status: $(curl -s http://localhost:11434/api/version &> /dev/null && echo "✅ Running" || echo "❌ Not running")
Available Models: $(ollama list | tail -n +2 | wc -l)

Models Installed:
$(ollama list | tail -n +2 | awk '{printf "  - %s (Size: %s)\n", $1, $2}')

Configuration:
  - API Endpoint: http://localhost:11434
  - Model Files: $HOME/.ollama/modelfiles/
  - Service Logs: /tmp/ollama.log

Next Steps:
1. Update your .env file with Ollama settings:
   OLLAMA_HOST=localhost
   OLLAMA_PORT=11434

2. Test the integration:
   npm test -- --grep "ollama"

3. Import your custom GGUF models (if any):
   ./scripts/import-gguf-models.sh

For troubleshooting:
  - Check service: curl http://localhost:11434/api/version
  - View logs: tail -f /tmp/ollama.log
  - Restart service: pkill ollama && ollama serve

============================================

EOF
}

# Main execution
main() {
    log_info "Starting Ollama setup for Medical AI System..."
    echo
    
    check_system
    echo
    
    install_ollama || {
        log_error "Failed to install Ollama"
        exit 1
    }
    echo
    
    start_ollama || {
        log_error "Failed to start Ollama service"
        exit 1
    }
    echo
    
    setup_medical_models || {
        log_warning "Some models failed to install"
    }
    echo
    
    create_medical_modelfiles
    echo
    
    create_medical_models
    echo
    
    test_ollama || {
        log_warning "Model testing failed"
    }
    echo
    
    generate_summary
    
    log_success "Ollama setup completed!"
}

# Run main function
main "$@"