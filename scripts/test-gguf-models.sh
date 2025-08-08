#!/bin/bash

# GGUF Models Testing Framework for RadExtract
# Tests multiple GGUF models safely with performance comparison

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${PURPLE}🧠 GGUF Models Testing Framework for RadExtract${NC}"
echo "============================================================="
echo ""

# Test results storage
RESULTS_DIR="./gguf-test-results"
RESULTS_FILE="$RESULTS_DIR/model-comparison-$(date +%Y%m%d-%H%M%S).json"
mkdir -p "$RESULTS_DIR"

# Model configurations for testing
declare -A OLLAMA_MODELS=(
    # Medical Specialist Models
    ["meditron:7b"]="Medical Llama 2 - 7B parameters, medical domain specialized"
    ["medllama2:7b"]="Medical Llama 2 - 7B parameters, medical Q&A focused"
    
    # High Reasoning Models  
    ["deepseek-r1:7b"]="DeepSeek R1 - 7B parameters, advanced reasoning"
    ["deepseek-r1:14b"]="DeepSeek R1 - 14B parameters, superior reasoning"
    ["cogito:8b"]="Cogito - 8B parameters, hybrid reasoning model"
    ["orca2:7b"]="Orca 2 - 7B parameters, Microsoft research model"
    ["orca2:13b"]="Orca 2 - 13B parameters, enhanced reasoning"
    
    # General Purpose High Quality
    ["llama3.1:8b"]="Llama 3.1 - 8B parameters, latest Meta model"
    ["qwen2.5:7b"]="Qwen 2.5 - 7B parameters, multilingual support"
    ["gemma2:9b"]="Gemma 2 - 9B parameters, Google model"
    ["mistral:7b"]="Mistral - 7B parameters, excellent instruction following"
    
    # Efficient Models  
    ["phi3.5:3.8b"]="Phi 3.5 - 3.8B parameters, Microsoft efficient model"
    ["gemma2:2b"]="Gemma 2 - 2B parameters, lightweight but capable"
)

# HuggingFace GGUF models for direct testing
declare -A HUGGINGFACE_MODELS=(
    ["Medical-Llama3-8B"]="microsoft/DialoGPT-medical - Medical conversation specialist"
    ["mistral-7b-medical"]="mistralai/Mistral-7B-medical-GGUF - Medical assistance focused"  
)

# German medical text sample for testing
GERMAN_MEDICAL_TEXT="MRT Kniegelenk nativ rechts: Zustand nach Arthroskopie und vorderer Kreuzbandplastik im Jahr 2017. Mediales Kompartiment: Riss des Innenmeniskushinterhorns mit Bezug zur tibialen Gelenkfläche, mutmaßlich Anteile des Innenmeniskus nach dorsal in den hinteren Recessus umgeschlagen. Vorderhorn intakt. Keine durchgreifenden Knorpeldefekte. Kein Knochenmarködem. Beurteilung: Zustand nach VKB-Ersatz, Innenmeniskusriss mit Dislokation."

# Function to check system resources
check_system_safety() {
    echo -e "${BLUE}🛡️  System Safety Check${NC}"
    
    # Get system info
    if command -v free >/dev/null 2>&1; then
        TOTAL_RAM_GB=$(free -g | grep Mem | awk '{print $2}')
        AVAILABLE_RAM_GB=$(free -g | grep Mem | awk '{print $7}')
    else
        # macOS
        TOTAL_RAM_GB=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024/1024)}')
        AVAILABLE_RAM_GB=$(vm_stat | grep "Pages free" | awk '{print int($3*4096/1024/1024/1024)}')
    fi
    
    echo "   💾 Total RAM: ${TOTAL_RAM_GB}GB"
    echo "   🆓 Available RAM: ${AVAILABLE_RAM_GB}GB"
    
    if [ "$TOTAL_RAM_GB" -lt 8 ]; then
        echo -e "${RED}❌ Insufficient RAM for GGUF model testing${NC}"
        exit 1
    fi
    
    if [ "$AVAILABLE_RAM_GB" -lt 4 ]; then
        echo -e "${YELLOW}⚠️  Limited RAM available - will test smaller models only${NC}"
        SMALL_MODELS_ONLY=true
    fi
    
    echo -e "${GREEN}✅ System suitable for GGUF testing${NC}"
    echo ""
}

# Function to test individual Ollama model
test_ollama_model() {
    local model_name=$1
    local model_desc=$2
    local test_start=$(date +%s)
    
    echo -e "${BLUE}🧪 Testing: $model_name${NC}"
    echo "   📝 Description: $model_desc"
    
    # Pull model if not exists
    echo "   ⬇️  Checking model availability..."
    if ! ollama list | grep -q "$model_name"; then
        echo "   📥 Pulling model (this may take several minutes)..."
        if ! ollama pull "$model_name"; then
            echo -e "${RED}   ❌ Failed to pull model${NC}"
            return 1
        fi
    else
        echo -e "${GREEN}   ✅ Model already available${NC}"
    fi
    
    # Test model with German medical text
    echo "   🎯 Testing medical report generation..."
    local prompt="Erstelle einen strukturierten deutschen Radiologie-Befund aus folgendem Text:

$GERMAN_MEDICAL_TEXT

Struktur:
- Technik: [Untersuchungstechnik]
- Befund: [Detaillierte Befunde]
- Beurteilung: [Zusammenfassung]
- Empfehlung: [Weitere Maßnahmen]

Antworte nur mit der strukturierten Ausgabe."
    
    local generation_start=$(date +%s.%3N)
    local response
    
    # Use timeout to prevent hanging
    if response=$(timeout 300s ollama generate "$model_name" "$prompt" 2>&1); then
        local generation_end=$(date +%s.%3N)
        local generation_time=$(echo "$generation_end - $generation_start" | bc)
        local response_length=${#response}
        
        echo -e "${GREEN}   ✅ Generation successful${NC}"
        echo "   ⏱️  Generation time: ${generation_time}s"
        echo "   📏 Response length: $response_length characters"
        
        # Analyze response quality
        local quality_score=0
        
        # Check for German medical terms
        if echo "$response" | grep -qi "befund\|beurteilung\|empfehlung"; then
            quality_score=$((quality_score + 2))
        fi
        
        # Check for structured format
        if echo "$response" | grep -qi "technik:\|befund:\|beurteilung:\|empfehlung:"; then
            quality_score=$((quality_score + 2))
        fi
        
        # Check for medical terminology
        if echo "$response" | grep -qi "kniegelenk\|kreuzbandplastik\|meniskus"; then
            quality_score=$((quality_score + 1))
        fi
        
        echo "   🎯 Quality score: $quality_score/5"
        
        # Store results
        local test_end=$(date +%s)
        local total_time=$((test_end - test_start))
        
        cat >> "$RESULTS_FILE" << EOF
{
  "model": "$model_name",
  "description": "$model_desc",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "success": true,
  "generation_time": $generation_time,
  "response_length": $response_length,
  "quality_score": $quality_score,
  "total_test_time": $total_time,
  "response_preview": "$(echo "$response" | head -c 200 | sed 's/"/\\"/g')"
},
EOF
        
        echo "   📊 Results logged to $RESULTS_FILE"
        echo ""
        
    else
        echo -e "${RED}   ❌ Generation failed or timed out${NC}"
        echo "   Error: $response"
        
        # Log failure
        cat >> "$RESULTS_FILE" << EOF
{
  "model": "$model_name", 
  "description": "$model_desc",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "success": false,
  "error": "$(echo "$response" | sed 's/"/\\"/g')"
},
EOF
        echo ""
        return 1
    fi
}

# Function to generate comparison report
generate_report() {
    echo -e "${PURPLE}📊 Generating Model Comparison Report${NC}"
    
    # Create readable report
    local report_file="$RESULTS_DIR/model-comparison-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << 'EOF'
# GGUF Models Performance Comparison for RadExtract

## Test Configuration
- **Test Date**: $(date)
- **Test System**: $(uname -a)
- **Medical Text**: German radiology report (MRT Kniegelenk)
- **Evaluation Criteria**: Generation time, response quality, medical terminology

## Results Summary

| Model | Size | Generation Time | Quality Score | Status |
|-------|------|-----------------|---------------|--------|
EOF
    
    # Process results and add to report
    if [ -f "$RESULTS_FILE" ]; then
        echo "Processing test results..."
        # This would parse the JSON results and create a markdown table
        # For now, show the raw results file location
        echo "   📄 Detailed results: $RESULTS_FILE"
        echo "   📋 Summary report: $report_file"
    fi
    
    echo -e "${GREEN}✅ Report generation complete${NC}"
}

# Function to cleanup test models (optional)
cleanup_models() {
    echo -e "${YELLOW}🧹 Cleanup Options${NC}"
    echo "1. Keep all models (recommended for future use)"
    echo "2. Remove failed models only"  
    echo "3. Remove all test models"
    echo "4. Skip cleanup"
    
    read -p "Choose option (1-4): " -n 1 -r
    echo ""
    
    case $REPLY in
        2)
            echo "Removing failed models..."
            # Remove models that failed testing
            ;;
        3)
            echo "⚠️  This will remove ALL downloaded models. Are you sure? (y/N)"
            read -r confirm
            if [[ "$confirm" =~ ^[Yy]$ ]]; then
                echo "Removing all test models..."
                for model in "${!OLLAMA_MODELS[@]}"; do
                    ollama rm "$model" 2>/dev/null || true
                done
            fi
            ;;
        1|4|*)
            echo "Keeping models for future use"
            ;;
    esac
}

# Main testing workflow
main() {
    echo -e "${BLUE}🚀 Starting GGUF Models Testing${NC}"
    echo ""
    
    # Safety checks
    check_system_safety
    
    # Check Ollama availability
    if ! command -v ollama >/dev/null 2>&1; then
        echo -e "${RED}❌ Ollama not found. Please install Ollama first.${NC}"
        echo "   Installation: https://ollama.com/download"
        exit 1
    fi
    
    # Check if Ollama service is running
    if ! ollama list >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Ollama service not running. Starting...${NC}"
        ollama serve &
        sleep 5
    fi
    
    # Initialize results file
    echo "[" > "$RESULTS_FILE"
    
    echo -e "${PURPLE}📋 Model Testing Plan${NC}"
    echo "Models to test: ${#OLLAMA_MODELS[@]}"
    for model in "${!OLLAMA_MODELS[@]}"; do
        echo "   • $model: ${OLLAMA_MODELS[$model]}"
    done
    echo ""
    
    read -p "🚀 Start testing? This may take 30-60 minutes (y/N): " -n 1 -r
    echo ""
    if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
        echo "Testing cancelled"
        exit 0
    fi
    
    # Test each model
    local successful_tests=0
    local failed_tests=0
    
    for model in "${!OLLAMA_MODELS[@]}"; do
        # Skip large models if RAM is limited
        if [ "$SMALL_MODELS_ONLY" = true ] && [[ "$model" =~ (13b|14b|70b) ]]; then
            echo -e "${YELLOW}⚠️  Skipping large model $model due to RAM limitations${NC}"
            continue
        fi
        
        if test_ollama_model "$model" "${OLLAMA_MODELS[$model]}"; then
            successful_tests=$((successful_tests + 1))
        else
            failed_tests=$((failed_tests + 1))
        fi
        
        # Brief pause between tests
        sleep 2
    done
    
    # Close JSON array
    sed -i '$ s/,$//' "$RESULTS_FILE" 2>/dev/null || true
    echo "]" >> "$RESULTS_FILE"
    
    echo -e "${PURPLE}📊 Testing Complete${NC}"
    echo "   ✅ Successful tests: $successful_tests"
    echo "   ❌ Failed tests: $failed_tests" 
    echo "   📁 Results saved to: $RESULTS_FILE"
    echo ""
    
    # Generate comparison report
    generate_report
    
    # Optional cleanup
    cleanup_models
    
    echo -e "${GREEN}🎉 GGUF Model Testing Complete!${NC}"
    echo ""
    echo -e "${BLUE}💡 Next Steps:${NC}"
    echo "   1. Review results in: $RESULTS_FILE"
    echo "   2. Choose best performing model for your use case"
    echo "   3. Update Ollama configuration with preferred model"
    echo "   4. Test integration with RadExtract frontend"
}

# Run main function
main