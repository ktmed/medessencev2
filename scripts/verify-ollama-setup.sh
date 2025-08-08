#!/bin/bash

# Ollama Setup Verification Script
# Quick verification that Ollama integration is working correctly

set -e

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

# Configuration
OLLAMA_HOST=${OLLAMA_HOST:-localhost}
OLLAMA_PORT=${OLLAMA_PORT:-11434}
OLLAMA_URL="http://${OLLAMA_HOST}:${OLLAMA_PORT}"

# Check functions
check_ollama_installed() {
    log_info "Checking if Ollama is installed..."
    
    if command -v ollama &> /dev/null; then
        local version=$(ollama --version 2>/dev/null || echo "unknown")
        log_success "Ollama is installed: $version"
        return 0
    else
        log_error "Ollama is not installed"
        log_info "Please run: ./scripts/setup-ollama.sh"
        return 1
    fi
}

check_ollama_service() {
    log_info "Checking if Ollama service is running..."
    
    if curl -s "$OLLAMA_URL/api/version" &> /dev/null; then
        local version_info=$(curl -s "$OLLAMA_URL/api/version" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
        log_success "Ollama service is running (version: ${version_info:-unknown})"
        return 0
    else
        log_error "Ollama service is not running at $OLLAMA_URL"
        log_info "Please start with: ollama serve"
        return 1
    fi
}

check_models_available() {
    log_info "Checking available models..."
    
    local models_response=$(curl -s "$OLLAMA_URL/api/tags" 2>/dev/null)
    if [[ $? -ne 0 ]]; then
        log_error "Cannot retrieve models list"
        return 1
    fi
    
    local model_count=$(echo "$models_response" | grep -o '"name"' | wc -l)
    
    if [[ $model_count -gt 0 ]]; then
        log_success "Found $model_count models:"
        echo "$models_response" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | while read model; do
            echo "  - $model"
        done
        return 0
    else
        log_warning "No models are installed"
        log_info "Install models with: ollama pull gemma2:2b"
        return 1
    fi
}

check_model_generation() {
    log_info "Testing model generation..."
    
    # Get first available model
    local first_model=$(curl -s "$OLLAMA_URL/api/tags" | grep -o '"name":"[^"]*"' | head -n1 | cut -d'"' -f4)
    
    if [[ -z "$first_model" ]]; then
        log_error "No models available for testing"
        return 1
    fi
    
    log_info "Testing with model: $first_model"
    
    local test_prompt='Generate a JSON response with "status": "ok"'
    local request_body=$(cat << EOF
{
  "model": "$first_model",
  "prompt": "$test_prompt",
  "stream": false,
  "options": {
    "temperature": 0.1,
    "num_predict": 50
  }
}
EOF
)
    
    local response=$(curl -s -X POST "$OLLAMA_URL/api/generate" \
        -H "Content-Type: application/json" \
        -d "$request_body" \
        --max-time 30)
    
    if [[ $? -eq 0 && -n "$response" ]]; then
        log_success "Model generation test completed"
        local response_preview=$(echo "$response" | head -c 100)
        log_info "Response preview: ${response_preview}..."
        return 0
    else
        log_error "Model generation test failed"
        return 1
    fi
}

check_node_integration() {
    log_info "Checking Node.js integration..."
    
    if [[ ! -f "test-ollama-integration.js" ]]; then
        log_warning "Integration test script not found"
        return 1
    fi
    
    if command -v node &> /dev/null; then
        log_info "Running integration test..."
        if timeout 60s node test-ollama-integration.js --quick &> /tmp/ollama-test.log; then
            log_success "Node.js integration test passed"
            return 0
        else
            log_warning "Node.js integration test failed (check /tmp/ollama-test.log)"
            return 1
        fi
    else
        log_warning "Node.js not found, skipping integration test"
        return 1
    fi
}

check_environment_config() {
    log_info "Checking environment configuration..."
    
    if [[ ! -f ".env" ]]; then
        log_warning ".env file not found"
        log_info "Copy .env.example to .env and configure Ollama settings"
        return 1
    fi
    
    if grep -q "OLLAMA_HOST" .env && grep -q "OLLAMA_PORT" .env; then
        log_success "Ollama configuration found in .env"
        return 0
    else
        log_warning "Ollama configuration not found in .env"
        log_info "Add Ollama settings to your .env file"
        return 1
    fi
}

check_system_resources() {
    log_info "Checking system resources..."
    
    # Check memory
    if command -v free &> /dev/null; then
        local total_mem=$(free -m | awk 'NR==2{printf "%.0f", $2}')
        local free_mem=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    elif command -v vm_stat &> /dev/null; then
        local page_size=$(vm_stat | grep "page size" | awk '{print $8}')
        local pages_free=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
        local total_mem=$(echo "scale=0; $(sysctl -n hw.memsize) / 1024 / 1024" | bc)
        local free_mem=$(echo "scale=0; $pages_free * $page_size / 1024 / 1024" | bc)
    else
        log_warning "Cannot determine memory usage"
        return 1
    fi
    
    log_info "System memory: ${total_mem}MB total, ${free_mem}MB free"
    
    if [[ $total_mem -lt 4000 ]]; then
        log_warning "Limited memory detected (${total_mem}MB). Consider using smaller models."
    else
        log_success "Sufficient memory available"
    fi
    
    # Check disk space
    local disk_available=$(df . | tail -1 | awk '{print $4}')
    local disk_available_gb=$(echo "scale=1; $disk_available / 1024 / 1024" | bc 2>/dev/null || echo "unknown")
    
    log_info "Available disk space: ${disk_available_gb}GB"
    
    if [[ "$disk_available_gb" != "unknown" ]] && (( $(echo "$disk_available_gb < 5" | bc -l) )); then
        log_warning "Low disk space (${disk_available_gb}GB). Models require 1-5GB each."
    else
        log_success "Sufficient disk space available"
    fi
    
    return 0
}

generate_health_report() {
    log_info "Generating health report..."
    
    local report_file="/tmp/ollama-health-report.txt"
    
    cat > "$report_file" << EOF
Ollama Setup Health Report
Generated: $(date)
========================================

System Information:
- OS: $(uname -s) $(uname -r)
- Architecture: $(uname -m)
- Hostname: $(hostname)

Ollama Status:
- Installation: $(command -v ollama &> /dev/null && echo "✅ Installed" || echo "❌ Not installed")
- Service: $(curl -s "$OLLAMA_URL/api/version" &> /dev/null && echo "✅ Running" || echo "❌ Not running")
- URL: $OLLAMA_URL

Models:
$(curl -s "$OLLAMA_URL/api/tags" 2>/dev/null | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | sed 's/^/- /' || echo "- No models found")

System Resources:
$(check_system_resources 2>&1 | grep -E "(memory|disk)" | sed 's/^/- /')

Configuration:
- Environment file: $([[ -f ".env" ]] && echo "✅ Found" || echo "❌ Not found")
- Ollama config: $(grep -q "OLLAMA_HOST" .env 2>/dev/null && echo "✅ Configured" || echo "❌ Not configured")

Integration:
- Test script: $([[ -f "test-ollama-integration.js" ]] && echo "✅ Available" || echo "❌ Not available")
- Node.js: $(command -v node &> /dev/null && echo "✅ Available" || echo "❌ Not available")

Next Steps:
$(if ! command -v ollama &> /dev/null; then echo "1. Install Ollama: ./scripts/setup-ollama.sh"; fi)
$(if ! curl -s "$OLLAMA_URL/api/version" &> /dev/null; then echo "2. Start Ollama: ollama serve"; fi)
$(if [[ $(curl -s "$OLLAMA_URL/api/tags" 2>/dev/null | grep -o '"name"' | wc -l) -eq 0 ]]; then echo "3. Install models: ollama pull gemma2:2b"; fi)
$(if [[ ! -f ".env" ]]; then echo "4. Configure environment: cp .env.example .env"; fi)
$(if [[ -f "test-ollama-integration.js" ]]; then echo "5. Run tests: node test-ollama-integration.js"; fi)

========================================
EOF
    
    cat "$report_file"
    log_success "Health report saved to: $report_file"
}

# Main execution
main() {
    log_info "Starting Ollama setup verification...\n"
    
    local checks_passed=0
    local total_checks=6
    
    # Run all checks
    check_ollama_installed && ((checks_passed++))
    echo
    
    check_ollama_service && ((checks_passed++))
    echo
    
    check_models_available && ((checks_passed++))
    echo
    
    check_model_generation && ((checks_passed++))
    echo
    
    check_environment_config && ((checks_passed++))
    echo
    
    check_node_integration && ((checks_passed++))
    echo
    
    check_system_resources
    echo
    
    # Generate summary
    log_info "Verification Summary:"
    log_info "Passed: $checks_passed/$total_checks checks"
    
    if [[ $checks_passed -eq $total_checks ]]; then
        log_success "✅ Ollama setup is fully functional!"
        log_info "You can now use Ollama with your RadExtract application."
    elif [[ $checks_passed -ge 4 ]]; then
        log_warning "⚠️  Ollama setup is mostly functional with minor issues."
        log_info "Address the warnings above for optimal performance."
    else
        log_error "❌ Ollama setup has significant issues."
        log_info "Please address the errors above before proceeding."
    fi
    
    echo
    generate_health_report
    
    return $(( total_checks - checks_passed ))
}

# Show usage if help requested
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    cat << EOF
Ollama Setup Verification Script

Usage:
  $0 [options]

Options:
  --help, -h       Show this help message
  --report-only    Generate health report only
  --quick          Skip integration tests

Environment Variables:
  OLLAMA_HOST      Ollama server host (default: localhost)
  OLLAMA_PORT      Ollama server port (default: 11434)

Examples:
  $0                        # Full verification
  $0 --quick               # Skip slow tests
  OLLAMA_HOST=remote $0    # Check remote Ollama

This script verifies:
  ✓ Ollama installation
  ✓ Service status
  ✓ Available models
  ✓ Model generation
  ✓ Environment config
  ✓ Node.js integration
  ✓ System resources

EOF
    exit 0
fi

# Handle special options
if [[ "$1" == "--report-only" ]]; then
    generate_health_report
    exit 0
fi

if [[ "$1" == "--quick" ]]; then
    log_info "Running quick verification (skipping slow tests)..."
    check_ollama_installed
    check_ollama_service
    check_models_available
    check_environment_config
    generate_health_report
    exit 0
fi

# Run main function
main "$@"