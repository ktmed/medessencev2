#!/bin/bash

# GGUF Model Import Script for Ollama
# This script helps import existing GGUF model files into Ollama

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

# Default GGUF models directory
DEFAULT_GGUF_DIR="./portable_models"
GGUF_DIR="${1:-$DEFAULT_GGUF_DIR}"

# Check if Ollama is running
check_ollama() {
    log_info "Checking Ollama service..."
    
    if ! command -v ollama &> /dev/null; then
        log_error "Ollama is not installed. Please run ./scripts/setup-ollama.sh first"
        exit 1
    fi
    
    if ! curl -s http://localhost:11434/api/version &> /dev/null; then
        log_error "Ollama service is not running. Please start it with: ollama serve"
        exit 1
    fi
    
    log_success "Ollama service is running"
}

# Find GGUF files
find_gguf_files() {
    log_info "Searching for GGUF files in: $GGUF_DIR"
    
    if [[ ! -d "$GGUF_DIR" ]]; then
        log_error "Directory $GGUF_DIR does not exist"
        log_info "Please specify the correct path to your GGUF models directory:"
        log_info "  ./scripts/import-gguf-models.sh /path/to/your/gguf/models"
        exit 1
    fi
    
    # Find all .gguf files
    GGUF_FILES=($(find "$GGUF_DIR" -name "*.gguf" -type f))
    
    if [[ ${#GGUF_FILES[@]} -eq 0 ]]; then
        log_warning "No GGUF files found in $GGUF_DIR"
        log_info "Please ensure your GGUF model files are in the correct location"
        exit 1
    fi
    
    log_info "Found ${#GGUF_FILES[@]} GGUF files:"
    for file in "${GGUF_FILES[@]}"; do
        local basename=$(basename "$file")
        local size=$(du -h "$file" | cut -f1)
        log_info "  - $basename ($size)"
    done
}

# Create Ollama modelfile for a GGUF file
create_modelfile() {
    local gguf_file="$1"
    local model_name="$2"
    local display_name="$3"
    local modelfile_path="$4"
    
    cat > "$modelfile_path" << EOF
FROM $gguf_file

# Custom medical model based on $(basename "$gguf_file")
SYSTEM """You are a specialized medical AI assistant for German radiology reports. You generate structured, accurate medical reports based on transcribed medical dictations.

IMPORTANT GUIDELINES:
- Use precise medical terminology in German
- Generate structured JSON responses
- Focus on medical content only
- Ignore administrative information (addresses, letterheads, signatures)
- Extract ALL relevant medical information completely
- Maintain professional medical language
- Follow the exact JSON schema provided in prompts

RESPONSE FORMAT:
Always respond with valid JSON containing these sections:
- technicalDetails: Technical examination details
- findings: Medical findings with structured data
- impression: Clinical interpretation and assessment
- recommendations: Further recommendations and follow-up
"""

# Optimized parameters for medical text generation
PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER repeat_penalty 1.1
PARAMETER num_predict 2048
PARAMETER num_ctx 2048
PARAMETER stop "<|im_end|>"
PARAMETER stop "</s>"

# Medical-focused prompt template
TEMPLATE """<|im_start|>system
{{ .System }}<|im_end|>
<|im_start|>user
{{ .Prompt }}<|im_end|>
<|im_start|>assistant
"""
EOF
}

# Import a GGUF file into Ollama
import_gguf_file() {
    local gguf_file="$1"
    local basename=$(basename "$gguf_file" .gguf)
    
    # Generate model name from filename
    local model_name=$(echo "$basename" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9.-]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')
    
    # Create display name
    local display_name="Medical $(echo "$basename" | sed 's/-/ /g' | sed 's/\b\w/\U&/g')"
    
    log_info "Importing: $basename -> $model_name"
    
    # Check if model already exists
    if ollama list | grep -q "^$model_name"; then
        log_warning "Model $model_name already exists, skipping"
        return 0
    fi
    
    # Create temporary modelfile
    local temp_modelfile=$(mktemp)
    create_modelfile "$gguf_file" "$model_name" "$display_name" "$temp_modelfile"
    
    # Import the model
    log_info "Creating Ollama model: $model_name"
    if ollama create "$model_name" -f "$temp_modelfile"; then
        log_success "Successfully imported $model_name"
        
        # Test the model with a simple prompt
        log_info "Testing model $model_name..."
        local test_response=$(timeout 30s ollama run "$model_name" 'Generate a JSON response with "status": "ready"' 2>/dev/null || echo "")
        
        if [[ -n "$test_response" ]]; then
            log_success "Model $model_name is working correctly"
        else
            log_warning "Model $model_name created but test failed"
        fi
    else
        log_error "Failed to import $model_name"
        rm -f "$temp_modelfile"
        return 1
    fi
    
    # Clean up
    rm -f "$temp_modelfile"
    return 0
}

# Create model variants with different quantization levels
create_model_variants() {
    local base_model="$1"
    
    log_info "Creating model variants for $base_model..."
    
    # List of variant configurations
    declare -A VARIANTS=(
        ["q8_0"]="temperature 0.2,top_p 0.8,repeat_penalty 1.05"
        ["q5_k_s"]="temperature 0.3,top_p 0.9,repeat_penalty 1.1"
        ["q4_k_s"]="temperature 0.35,top_p 0.95,repeat_penalty 1.15"
    )
    
    for variant in "${!VARIANTS[@]}"; do
        local variant_name="${base_model}-${variant}"
        
        # Skip if variant already exists
        if ollama list | grep -q "^$variant_name"; then
            log_info "Variant $variant_name already exists, skipping"
            continue
        fi
        
        log_info "Creating variant: $variant_name"
        
        # Create modelfile for variant
        local temp_modelfile=$(mktemp)
        cat > "$temp_modelfile" << EOF
FROM $base_model

# Optimized variant: $variant
PARAMETER ${VARIANTS[$variant]//,/$'\nPARAMETER '}
EOF
        
        if ollama create "$variant_name" -f "$temp_modelfile"; then
            log_success "Created variant $variant_name"
        else
            log_warning "Failed to create variant $variant_name"
        fi
        
        rm -f "$temp_modelfile"
    done
}

# Generate model usage guide
generate_usage_guide() {
    local imported_models=($(ollama list | tail -n +2 | grep -E "(medical|gemma)" | awk '{print $1}'))
    
    if [[ ${#imported_models[@]} -eq 0 ]]; then
        log_warning "No medical models found for usage guide"
        return
    fi
    
    cat << EOF

============================================
GGUF Model Import Complete
============================================

Imported Models:
$(for model in "${imported_models[@]}"; do
    local size=$(ollama list | grep "^$model" | awk '{print $2}')
    echo "  ✅ $model ($size)"
done)

Usage Examples:

1. Test a model directly:
   ollama run ${imported_models[0]} "Generate a test response"

2. Use in your application:
   The models are now available via the Ollama API at http://localhost:11434

3. Check model details:
   ollama show ${imported_models[0]}

4. Update environment configuration:
   Add to your .env file:
   OLLAMA_DEFAULT_MODEL=${imported_models[0]}

Model Performance Tips:
- Smaller quantized models (q4, q5) are faster but less accurate
- Larger models (f16, q8) are more accurate but slower
- Use temperature 0.3 or lower for consistent medical reports
- Set context length appropriately for your documents

Integration with RadExtract:
Your models are now available in the multi-LLM service with automatic fallback.
The system will prioritize local Ollama models over cloud APIs for privacy and cost efficiency.

============================================

EOF
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    # Remove any temporary modelfiles that might be left
    find /tmp -name "tmp.*" -name "*modelfile*" -mtime +1 -delete 2>/dev/null || true
}

# Main execution
main() {
    log_info "Starting GGUF model import for Ollama..."
    echo
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    check_ollama
    echo
    
    find_gguf_files
    echo
    
    local imported_count=0
    local failed_count=0
    
    log_info "Importing GGUF files into Ollama..."
    for gguf_file in "${GGUF_FILES[@]}"; do
        if import_gguf_file "$gguf_file"; then
            ((imported_count++))
        else
            ((failed_count++))
        fi
        echo
    done
    
    log_info "Import summary: $imported_count successful, $failed_count failed"
    
    # Create variants for successfully imported models if requested
    if [[ "$2" == "--create-variants" && $imported_count -gt 0 ]]; then
        log_info "Creating model variants..."
        local base_models=($(ollama list | tail -n +2 | grep -v ":" | awk '{print $1}'))
        for model in "${base_models[@]}"; do
            create_model_variants "$model"
        done
    fi
    
    echo
    generate_usage_guide
    
    if [[ $imported_count -gt 0 ]]; then
        log_success "GGUF model import completed! Imported $imported_count models."
    else
        log_error "No models were successfully imported."
        exit 1
    fi
}

# Show usage if help requested
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    cat << EOF
GGUF Model Import Script for Ollama

Usage:
  $0 [GGUF_DIRECTORY] [OPTIONS]

Arguments:
  GGUF_DIRECTORY    Path to directory containing GGUF files (default: ./portable_models)

Options:
  --create-variants Create additional model variants with different parameters
  --help, -h       Show this help message

Examples:
  $0                                    # Import from ./portable_models
  $0 /path/to/gguf/models              # Import from custom directory
  $0 ./models --create-variants        # Import and create variants

Prerequisites:
  - Ollama must be installed and running
  - GGUF model files must be accessible
  - Sufficient disk space for model storage

EOF
    exit 0
fi

# Run main function
main "$@"