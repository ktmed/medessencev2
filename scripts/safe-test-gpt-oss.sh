#!/bin/bash

# Safe GPT-OSS-20B Testing Script with Resource Monitoring
# Monitors system resources and provides safe abort options

set -e

echo "🛡️  Safe GPT-OSS-20B Testing with Resource Monitoring"
echo "====================================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check system resources
check_system_resources() {
    echo -e "${BLUE}📊 Current System Resources:${NC}"
    
    # Memory check
    if command -v free >/dev/null 2>&1; then
        TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        AVAILABLE_RAM_KB=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
        TOTAL_RAM_GB=$((TOTAL_RAM_KB / 1024 / 1024))
        AVAILABLE_RAM_GB=$((AVAILABLE_RAM_KB / 1024 / 1024))
    elif command -v vm_stat >/dev/null 2>&1; then
        # macOS
        PAGE_SIZE=$(vm_stat | grep "page size" | awk '{print $8}' | tr -d '.')
        FREE_PAGES=$(vm_stat | grep "Pages free" | awk '{print $3}' | tr -d '.')
        TOTAL_RAM_GB=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024/1024)}')
        AVAILABLE_RAM_GB=$(echo "scale=1; $FREE_PAGES * $PAGE_SIZE / 1024 / 1024 / 1024" | bc)
    else
        echo "⚠️  Cannot determine RAM usage on this system"
        TOTAL_RAM_GB=0
        AVAILABLE_RAM_GB=0
    fi
    
    # CPU info
    CPU_CORES=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo "unknown")
    
    # Disk space
    AVAILABLE_SPACE_GB=$(df . | tail -1 | awk '{print int($4/1024/1024)}')
    
    echo "   💾 Total RAM: ${TOTAL_RAM_GB}GB"
    echo "   🆓 Available RAM: ${AVAILABLE_RAM_GB}GB"
    echo "   🖥️  CPU Cores: $CPU_CORES"
    echo "   💽 Available Disk: ${AVAILABLE_SPACE_GB}GB"
    echo ""
    
    # Safety checks
    SAFE_TO_PROCEED=true
    
    if (( $(echo "$TOTAL_RAM_GB < 12" | bc -l) )) && (( $(echo "$TOTAL_RAM_GB > 0" | bc -l) )); then
        echo -e "${RED}❌ SAFETY CHECK FAILED: Insufficient total RAM (${TOTAL_RAM_GB}GB < 12GB required)${NC}"
        SAFE_TO_PROCEED=false
    fi
    
    if (( $(echo "$AVAILABLE_RAM_GB < 8" | bc -l) )) && (( $(echo "$AVAILABLE_RAM_GB > 0" | bc -l) )); then
        echo -e "${YELLOW}⚠️  WARNING: Limited available RAM (${AVAILABLE_RAM_GB}GB < 8GB recommended)${NC}"
    fi
    
    if [ "$AVAILABLE_SPACE_GB" -lt 15 ]; then
        echo -e "${RED}❌ SAFETY CHECK FAILED: Insufficient disk space (${AVAILABLE_SPACE_GB}GB < 15GB required)${NC}"
        SAFE_TO_PROCEED=false
    fi
    
    if [ "$SAFE_TO_PROCEED" = false ]; then
        echo ""
        echo -e "${RED}🚨 ABORTING: System does not meet minimum requirements${NC}"
        echo -e "${YELLOW}💡 Recommendations:${NC}"
        echo "   - Close other applications to free RAM"
        echo "   - Free up disk space"
        echo "   - Consider using cloud APIs instead (Claude/OpenAI)"
        exit 1
    fi
    
    if (( $(echo "$AVAILABLE_RAM_GB < 12" | bc -l) )) && (( $(echo "$AVAILABLE_RAM_GB > 0" | bc -l) )); then
        echo -e "${YELLOW}⚠️  PROCEEDING WITH CAUTION: Limited RAM available${NC}"
        echo "   Will use smaller model variant and monitor closely"
        USE_SMALLER_MODEL=true
    fi
    
    echo -e "${GREEN}✅ Safety checks passed - proceeding with testing${NC}"
    echo ""
}

# Function to monitor resources during operation
monitor_resources() {
    echo -e "${BLUE}📈 Monitoring system resources...${NC}"
    
    # Background resource monitoring
    (
        for i in {1..30}; do
            if command -v free >/dev/null 2>&1; then
                MEM_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3*100/$2}')
                LOAD_AVG=$(uptime | awk '{print $10}' | tr -d ',')
            else
                # macOS
                MEM_PRESSURE=$(memory_pressure | grep "System-wide memory free percentage" | awk '{print 100-$5}' | tr -d '%' || echo "unknown")
                LOAD_AVG=$(uptime | awk '{print $8}' | tr -d ',' || echo "unknown")
            fi
            
            echo "$(date '+%H:%M:%S') - Memory: ${MEM_USAGE:-$MEM_PRESSURE}%, Load: $LOAD_AVG"
            sleep 2
        done
    ) &
    
    MONITOR_PID=$!
}

# Function to stop monitoring
stop_monitoring() {
    if [ ! -z "$MONITOR_PID" ]; then
        kill $MONITOR_PID 2>/dev/null || true
    fi
}

# Cleanup function
cleanup() {
    echo ""
    echo -e "${BLUE}🧹 Cleaning up...${NC}"
    stop_monitoring
    
    # Stop Docker containers if they were started
    if [ "$CONTAINERS_STARTED" = true ]; then
        echo "Stopping Docker containers..."
        docker-compose down 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✅ Cleanup completed${NC}"
}

# Set trap for cleanup on exit
trap cleanup EXIT INT TERM

# Main testing process
main() {
    echo -e "${BLUE}🔍 Step 1: Pre-flight System Check${NC}"
    check_system_resources
    
    echo -e "${BLUE}📥 Step 2: Checking GPT-OSS Model Availability${NC}"
    
    # Check if setup script exists
    if [ ! -f "./scripts/setup-gpt-oss.sh" ]; then
        echo -e "${RED}❌ GPT-OSS setup script not found${NC}"
        exit 1
    fi
    
    # Check if model is already downloaded
    if [ -f "./gpt-oss-models/gpt-oss-20b-q4_k_m.gguf" ]; then
        echo -e "${GREEN}✅ GPT-OSS model already downloaded${NC}"
        MODEL_SIZE=$(du -h "./gpt-oss-models/gpt-oss-20b-q4_k_m.gguf" | cut -f1)
        echo "   📏 Model size: $MODEL_SIZE"
    else
        echo -e "${YELLOW}⬇️  GPT-OSS model needs to be downloaded${NC}"
        echo "   This will download ~12GB. Continue? (y/N)"
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            echo "Download cancelled by user"
            exit 0
        fi
        
        echo -e "${BLUE}🚀 Running GPT-OSS setup script...${NC}"
        chmod +x ./scripts/setup-gpt-oss.sh
        
        # Run setup with monitoring
        monitor_resources
        ./scripts/setup-gpt-oss.sh || {
            echo -e "${RED}❌ GPT-OSS setup failed${NC}"
            stop_monitoring
            exit 1
        }
        stop_monitoring
    fi
    
    echo ""
    echo -e "${BLUE}🐳 Step 3: Testing with Docker Container${NC}"
    
    # Check if containers are running
    if docker-compose ps | grep -q "websocket-proxy.*Up"; then
        echo -e "${GREEN}✅ Containers already running${NC}"
    else
        echo "Starting containers with resource monitoring..."
        monitor_resources
        
        # Start containers
        docker-compose up -d websocket-proxy redis
        CONTAINERS_STARTED=true
        
        # Wait for initialization
        echo "⏳ Waiting for services to initialize (60 seconds)..."
        sleep 60
        
        stop_monitoring
    fi
    
    echo ""
    echo -e "${BLUE}🧪 Step 4: Testing GPT-OSS Integration${NC}"
    
    # Monitor during testing
    monitor_resources
    
    # Check logs for GPT-OSS initialization
    echo "Checking GPT-OSS initialization in logs..."
    if docker logs radiology-ai-system-websocket-proxy-1 --tail 100 | grep -q "GPT-OSS.*initialized"; then
        echo -e "${GREEN}✅ GPT-OSS initialized successfully${NC}"
    elif docker logs radiology-ai-system-websocket-proxy-1 --tail 100 | grep -q "GPT-OSS.*failed"; then
        echo -e "${YELLOW}⚠️  GPT-OSS initialization failed - will fallback to cloud APIs${NC}"
        echo "Last 20 lines of logs:"
        docker logs radiology-ai-system-websocket-proxy-1 --tail 20
    else
        echo -e "${YELLOW}⚠️  GPT-OSS initialization status unclear${NC}"
        echo "Recent logs:"
        docker logs radiology-ai-system-websocket-proxy-1 --tail 10 | grep -i gpt || echo "No GPT-OSS logs found"
    fi
    
    stop_monitoring
    
    echo ""
    echo -e "${BLUE}🌐 Step 5: Frontend Testing Instructions${NC}"
    echo "1. Open your browser to: http://localhost:3000"
    echo "2. Paste a medical text and generate a report"
    echo "3. Watch the console for: 'MultiLLMService: Using GPT-OSS-20B model...'"
    echo "4. If you see crashes or extreme slowness, press Ctrl+C immediately"
    echo ""
    echo -e "${GREEN}🎉 GPT-OSS testing setup complete!${NC}"
    echo ""
    echo -e "${YELLOW}💡 Monitoring Tips:${NC}"
    echo "   - Watch memory usage: docker stats"
    echo "   - Monitor logs: docker logs radiology-ai-system-websocket-proxy-1 -f"
    echo "   - Check generation time: should be < 10 seconds"
    echo ""
    echo -e "${RED}🚨 Emergency Stop:${NC}"
    echo "   If system becomes unresponsive: docker-compose down && killall node"
}

# Run main function
main

echo ""
echo -e "${BLUE}📊 Final Resource Check:${NC}"
check_system_resources