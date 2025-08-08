#!/bin/bash

#==============================================================================
# Radiology AI System - Stop Script
# Gracefully stop all services with proper shutdown sequence
#==============================================================================

set -euo pipefail

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
GRACEFUL_SHUTDOWN_TIMEOUT=30

# Logging functions
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

# Check if system is running
check_system_status() {
    log_info "Checking system status..."
    
    cd "$PROJECT_ROOT"
    
    local running_services=$(docker-compose ps --services --filter "status=running" 2>/dev/null | wc -l || echo "0")
    
    if [[ "$running_services" -eq 0 ]]; then
        log_warning "No services are currently running"
        return 1
    fi
    
    log_info "Found $running_services running services"
    return 0
}

# Create shutdown backup
create_shutdown_backup() {
    log_info "Creating shutdown backup..."
    
    local backup_dir="$PROJECT_ROOT/backups/shutdowns/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    cd "$PROJECT_ROOT"
    
    # Save service states
    docker-compose ps > "$backup_dir/services-state.txt" 2>/dev/null || true
    
    # Save container logs before shutdown
    local services=$(docker-compose ps --services 2>/dev/null || true)
    if [[ -n "$services" ]]; then
        while IFS= read -r service; do
            if docker-compose ps "$service" | grep -q "Up"; then
                log_info "Backing up logs for $service..."
                docker-compose logs --tail=1000 "$service" > "$backup_dir/${service}-logs.txt" 2>/dev/null || true
            fi
        done <<< "$services"
    fi
    
    # Create shutdown info
    cat > "$backup_dir/shutdown-info.txt" <<EOF
Shutdown Backup Created: $(date)
Reason: Manual shutdown via stop.sh
User: $(whoami)
System Load: $(uptime)
Docker Version: $(docker --version)
EOF
    
    log_success "Shutdown backup created at: $backup_dir"
}

# Graceful service shutdown with proper order
graceful_shutdown() {
    log_info "Initiating graceful shutdown..."
    
    cd "$PROJECT_ROOT"
    
    # Step 1: Stop accepting new requests (reverse proxy)
    log_info "Step 1/6: Stopping reverse proxy..."
    docker-compose stop nginx || true
    
    # Step 2: Stop frontend (user interface)
    log_info "Step 2/6: Stopping frontend..."
    docker-compose stop frontend || true
    
    # Step 3: Stop application services (give them time to finish current requests)
    log_info "Step 3/6: Stopping application services..."
    
    # Send graceful shutdown signals
    local app_services=("backend" "transcription-service" "report-generation" "summary-generation")
    for service in "${app_services[@]}"; do
        if docker-compose ps "$service" | grep -q "Up"; then
            log_info "Sending graceful shutdown to $service..."
            docker-compose kill -s SIGTERM "$service" || true
        fi
    done
    
    # Wait for graceful shutdown
    log_info "Waiting for application services to shutdown gracefully..."
    local shutdown_start=$(date +%s)
    local all_stopped=false
    
    while [[ $(($(date +%s) - shutdown_start)) -lt $GRACEFUL_SHUTDOWN_TIMEOUT ]]; do
        local still_running=false
        for service in "${app_services[@]}"; do
            if docker-compose ps "$service" | grep -q "Up"; then
                still_running=true
                break
            fi
        done
        
        if [[ "$still_running" == "false" ]]; then
            all_stopped=true
            break
        fi
        
        sleep 2
    done
    
    if [[ "$all_stopped" == "true" ]]; then
        log_success "Application services stopped gracefully"
    else
        log_warning "Some services didn't stop gracefully, forcing shutdown..."
        for service in "${app_services[@]}"; do
            docker-compose stop "$service" || true
        done
    fi
    
    # Step 4: Stop monitoring services
    log_info "Step 4/6: Stopping monitoring services..."
    local monitoring_services=("grafana" "prometheus" "loki" "promtail" "node-exporter" "cadvisor")
    for service in "${monitoring_services[@]}"; do
        docker-compose stop "$service" || true
    done
    
    # Step 5: Stop backup services
    log_info "Step 5/6: Stopping backup services..."
    docker-compose stop postgres-backup || true
    
    # Step 6: Stop infrastructure services last
    log_info "Step 6/6: Stopping infrastructure services..."
    
    # Flush Redis data if needed
    if docker-compose ps redis | grep -q "Up"; then
        log_info "Flushing Redis cache before shutdown..."
        docker-compose exec -T redis redis-cli BGSAVE || true
        sleep 2
    fi
    
    # Stop database services
    docker-compose stop redis || true
    docker-compose stop postgres || true
    
    log_success "All services stopped"
}

# Force shutdown (emergency stop)
force_shutdown() {
    log_warning "Initiating force shutdown..."
    
    cd "$PROJECT_ROOT"
    
    # Kill all containers immediately
    docker-compose kill
    
    # Remove containers
    docker-compose down --remove-orphans
    
    log_success "Force shutdown completed"
}

# Cleanup after shutdown
cleanup_after_shutdown() {
    log_info "Performing post-shutdown cleanup..."
    
    cd "$PROJECT_ROOT"
    
    # Remove stopped containers
    docker-compose rm -f || true
    
    # Clean up orphaned containers
    docker container prune -f --filter "label=com.docker.compose.project=radiology-ai-system" || true
    
    # Clean up networks
    docker network prune -f --filter "label=com.docker.compose.project=radiology-ai-system" || true
    
    log_success "Cleanup completed"
}

# Verify shutdown
verify_shutdown() {
    log_info "Verifying shutdown..."
    
    cd "$PROJECT_ROOT"
    
    local running_services=$(docker-compose ps --services --filter "status=running" 2>/dev/null | wc -l || echo "0")
    
    if [[ "$running_services" -eq 0 ]]; then
        log_success "All services stopped successfully"
        return 0
    else
        log_error "$running_services services are still running"
        docker-compose ps
        return 1
    fi
}

# Show system status after shutdown
show_shutdown_status() {
    log_info "System Status After Shutdown:"
    echo
    
    cd "$PROJECT_ROOT"
    
    # Show container states
    docker-compose ps
    
    echo
    
    # Show system resources
    log_info "System Resources:"
    echo "  • Memory: $(free -h | grep '^Mem:' | awk '{print $3 "/" $2}')"
    echo "  • Disk: $(df -h "$PROJECT_ROOT" | awk 'NR==2 {print $3 "/" $2 " (" $5 " used)"}')"
    echo "  • Load: $(uptime | awk -F'load average:' '{print $2}')"
}

# Main function
main() {
    local start_time=$(date +%s)
    local force_mode=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force|-f)
                force_mode=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --force, -f    Force immediate shutdown without graceful period"
                echo "  --help, -h     Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    log_info "Starting Radiology AI System shutdown..."
    log_info "Shutdown started at: $(date)"
    
    if [[ "$force_mode" == "true" ]]; then
        log_warning "Force mode enabled - immediate shutdown"
    fi
    
    # Check if system is running
    if ! check_system_status && [[ "$force_mode" == "false" ]]; then
        log_info "System is already stopped"
        exit 0
    fi
    
    # Create backup before shutdown
    create_shutdown_backup
    
    # Perform shutdown
    if [[ "$force_mode" == "true" ]]; then
        force_shutdown
    else
        graceful_shutdown
    fi
    
    # Cleanup and verify
    cleanup_after_shutdown
    
    if verify_shutdown; then
        show_shutdown_status
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_success "System shutdown completed successfully in ${duration} seconds!"
        
        echo
        log_info "To start the system again, run:"
        echo "  ./scripts/deploy.sh"
        echo
        log_info "To view shutdown logs and backups:"
        echo "  ls -la backups/shutdowns/"
        
    else
        log_error "Shutdown verification failed"
        exit 1
    fi
}

# Handle script interruption
trap 'log_error "Shutdown interrupted"; force_shutdown; exit 1' INT TERM

# Run main function
main "$@"