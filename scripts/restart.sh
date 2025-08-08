#!/bin/bash

#==============================================================================
# Radiology AI System - Restart Script
# Restart services with minimal downtime and health verification
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
RESTART_TIMEOUT=180
HEALTH_CHECK_RETRIES=20

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

# Parse command line arguments
parse_arguments() {
    local services=()
    local rolling_restart=false
    local force_rebuild=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --service|-s)
                services+=("$2")
                shift 2
                ;;
            --rolling|-r)
                rolling_restart=true
                shift
                ;;
            --rebuild|-b)
                force_rebuild=true
                shift
                ;;
            --all|-a)
                services=()  # Empty means all services
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    echo "${services[*]:-all}"
    echo "$rolling_restart"
    echo "$force_rebuild"
}

# Show help
show_help() {
    cat <<EOF
Usage: $0 [OPTIONS]

Restart Radiology AI System services with minimal downtime.

Options:
  --service, -s SERVICE   Restart specific service (can be used multiple times)
  --rolling, -r          Perform rolling restart (one service at a time)
  --rebuild, -b          Force rebuild of images before restart
  --all, -a              Restart all services (default)
  --help, -h             Show this help message

Examples:
  $0                     # Restart all services
  $0 --service backend   # Restart only backend service
  $0 -s frontend -s backend -r  # Rolling restart of frontend and backend
  $0 --rebuild --all     # Rebuild and restart all services

Available services:
  - nginx (reverse proxy)
  - frontend (web interface)
  - backend (API gateway)
  - transcription-service
  - report-generation
  - summary-generation
  - postgres (database)
  - redis (cache)
  - prometheus (monitoring)
  - grafana (dashboards)
  - loki (logs)
  - promtail (log collector)
EOF
}

# Check system status
check_system_status() {
    log_info "Checking current system status..."
    
    cd "$PROJECT_ROOT"
    
    local total_services=$(docker-compose config --services | wc -l)
    local running_services=$(docker-compose ps --services --filter "status=running" 2>/dev/null | wc -l || echo "0")
    
    log_info "Services status: $running_services/$total_services running"
    
    if [[ "$running_services" -eq 0 ]]; then
        log_warning "No services are currently running. Consider using deploy.sh instead."
        return 1
    fi
    
    return 0
}

# Create restart backup
create_restart_backup() {
    log_info "Creating restart backup..."
    
    local backup_dir="$PROJECT_ROOT/backups/restarts/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    cd "$PROJECT_ROOT"
    
    # Save current service states
    docker-compose ps > "$backup_dir/services-before-restart.txt" 2>/dev/null || true
    
    # Save resource usage
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" $(docker-compose ps -q) > "$backup_dir/resource-usage.txt" 2>/dev/null || true
    
    # Create restart info
    cat > "$backup_dir/restart-info.txt" <<EOF
Restart Backup Created: $(date)
Restart Type: $1
Services: $2
User: $(whoami)
System Load: $(uptime)
EOF
    
    log_success "Restart backup created at: $backup_dir"
}

# Rebuild images if requested
rebuild_images() {
    local services=("$@")
    
    log_info "Rebuilding Docker images..."
    
    cd "$PROJECT_ROOT"
    
    if [[ ${#services[@]} -eq 0 ]]; then
        # Rebuild all custom images
        docker-compose build --parallel --no-cache
    else
        # Rebuild specific services
        for service in "${services[@]}"; do
            if docker-compose config --services | grep -q "^$service$"; then
                log_info "Rebuilding $service..."
                docker-compose build --no-cache "$service"
            fi
        done
    fi
    
    log_success "Images rebuilt successfully"
}

# Standard restart (stop all, start all)
standard_restart() {
    local services=("$@")
    
    log_info "Performing standard restart..."
    
    cd "$PROJECT_ROOT"
    
    if [[ ${#services[@]} -eq 0 ]]; then
        # Restart all services
        log_info "Restarting all services..."
        docker-compose restart
    else
        # Restart specific services
        for service in "${services[@]}"; do
            log_info "Restarting $service..."
            docker-compose restart "$service"
        done
    fi
    
    log_success "Standard restart completed"
}

# Rolling restart (one service at a time)
rolling_restart() {
    local services=("$@")
    
    log_info "Performing rolling restart..."
    
    cd "$PROJECT_ROOT"
    
    # Define service restart order (dependencies first)
    local service_order=(
        "postgres"
        "redis"
        "transcription-service"
        "report-generation"
        "summary-generation"
        "backend"
        "frontend"
        "nginx"
        "prometheus"
        "grafana"
        "loki"
        "promtail"
        "node-exporter"
        "cadvisor"
        "postgres-backup"
    )
    
    # If specific services are requested, use those instead
    if [[ ${#services[@]} -gt 0 ]]; then
        service_order=("${services[@]}")
    fi
    
    for service in "${service_order[@]}"; do
        # Check if service exists and is running
        if docker-compose ps "$service" 2>/dev/null | grep -q "Up"; then
            log_info "Rolling restart: $service"
            
            # Restart the service
            docker-compose restart "$service"
            
            # Wait for service to be healthy
            wait_for_service_health "$service"
            
            # Brief pause between services
            sleep 5
        else
            log_warning "Service $service is not running, skipping"
        fi
    done
    
    log_success "Rolling restart completed"
}

# Wait for service to be healthy
wait_for_service_health() {
    local service="$1"
    local max_attempts=20
    local attempt=1
    
    log_info "Waiting for $service to be healthy..."
    
    while [[ $attempt -le $max_attempts ]]; do
        # Check if container is running
        if ! docker-compose ps "$service" | grep -q "Up"; then
            log_error "$service container is not running"
            return 1
        fi
        
        # Check health endpoint if available
        local health_check_passed=false
        case "$service" in
            "nginx")
                if docker-compose exec -T "$service" wget --no-verbose --tries=1 --spider "http://localhost/health" &> /dev/null; then
                    health_check_passed=true
                fi
                ;;
            "backend")
                if docker-compose exec -T "$service" wget --no-verbose --tries=1 --spider "http://localhost:8000/health" &> /dev/null; then
                    health_check_passed=true
                fi
                ;;
            "frontend")
                if docker-compose exec -T "$service" wget --no-verbose --tries=1 --spider "http://localhost:3000/api/health" &> /dev/null; then
                    health_check_passed=true
                fi
                ;;
            "transcription-service")
                if docker-compose exec -T "$service" wget --no-verbose --tries=1 --spider "http://localhost:8001/health" &> /dev/null; then
                    health_check_passed=true
                fi
                ;;
            "report-generation")
                if docker-compose exec -T "$service" wget --no-verbose --tries=1 --spider "http://localhost:8002/health" &> /dev/null; then
                    health_check_passed=true
                fi
                ;;
            "summary-generation")
                if docker-compose exec -T "$service" wget --no-verbose --tries=1 --spider "http://localhost:8003/health" &> /dev/null; then
                    health_check_passed=true
                fi
                ;;
            "postgres")
                if docker-compose exec -T "$service" pg_isready -U meduser -d radiology_db &> /dev/null; then
                    health_check_passed=true
                fi
                ;;
            "redis")
                if docker-compose exec -T "$service" redis-cli ping | grep -q "PONG"; then
                    health_check_passed=true
                fi
                ;;
            "prometheus")
                if docker-compose exec -T "$service" wget --no-verbose --tries=1 --spider "http://localhost:9090/-/healthy" &> /dev/null; then
                    health_check_passed=true
                fi
                ;;
            "grafana")
                if docker-compose exec -T "$service" wget --no-verbose --tries=1 --spider "http://localhost:3000/api/health" &> /dev/null; then
                    health_check_passed=true
                fi
                ;;
            *)
                # For services without health checks, just verify container is running
                health_check_passed=true
                ;;
        esac
        
        if [[ "$health_check_passed" == "true" ]]; then
            log_success "$service is healthy"
            return 0
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            log_error "$service failed to become healthy within $(( max_attempts * 3 )) seconds"
            return 1
        fi
        
        log_info "Attempt $attempt/$max_attempts: $service not healthy yet, waiting..."
        sleep 3
        ((attempt++))
    done
}

# Run post-restart health checks
run_post_restart_checks() {
    log_info "Running post-restart health checks..."
    
    cd "$PROJECT_ROOT"
    
    # Check all services are running
    local failed_services=()
    local services=$(docker-compose config --services)
    
    while IFS= read -r service; do
        if ! docker-compose ps "$service" | grep -q "Up"; then
            failed_services+=("$service")
        fi
    done <<< "$services"
    
    if [[ ${#failed_services[@]} -gt 0 ]]; then
        log_error "Services failed to start: ${failed_services[*]}"
        return 1
    fi
    
    # Test critical endpoints
    local critical_endpoints=(
        "nginx:80:/health"
        "backend:8000/health"
        "transcription-service:8001/health"
        "report-generation:8002/health"
        "summary-generation:8003/health"
    )
    
    for endpoint in "${critical_endpoints[@]}"; do
        IFS=':' read -r service port_path <<< "$endpoint"
        IFS=':' read -r port path <<< "$port_path"
        
        if ! docker-compose exec -T "$service" wget --no-verbose --tries=1 --spider "http://localhost:$port$path" &> /dev/null; then
            log_error "Critical endpoint $service$path is not responding"
            return 1
        fi
    done
    
    log_success "Post-restart health checks passed"
    return 0
}

# Show restart summary
show_restart_summary() {
    log_info "Restart Summary:"
    echo
    
    cd "$PROJECT_ROOT"
    
    # Show service status
    docker-compose ps
    
    echo
    log_info "System is ready!"
    echo "  • Frontend: https://radiology-ai.local"
    echo "  • API: https://radiology-ai.local/api"
    echo "  • Grafana: https://radiology-ai.local/grafana"
    echo
    
    # Show resource usage
    log_info "Current Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" $(docker-compose ps -q) 2>/dev/null || true
}

# Main function
main() {
    local start_time=$(date +%s)
    
    # Parse arguments
    local parse_result=($(parse_arguments "$@"))
    local services_arg="${parse_result[0]}"
    local rolling_restart="${parse_result[1]}"
    local force_rebuild="${parse_result[2]}"
    
    # Convert services string to array
    local services=()
    if [[ "$services_arg" != "all" ]]; then
        IFS=' ' read -ra services <<< "$services_arg"
    fi
    
    log_info "Starting Radiology AI System restart..."
    log_info "Restart started at: $(date)"
    log_info "Services: ${services[*]:-all}"
    log_info "Rolling restart: $rolling_restart"
    log_info "Force rebuild: $force_rebuild"
    
    # Check current system status
    check_system_status
    
    # Create backup
    create_restart_backup "${rolling_restart:+rolling}" "${services[*]:-all}"
    
    # Rebuild images if requested
    if [[ "$force_rebuild" == "true" ]]; then
        rebuild_images "${services[@]}"
    fi
    
    # Perform restart
    if [[ "$rolling_restart" == "true" ]]; then
        rolling_restart "${services[@]}"
    else
        standard_restart "${services[@]}"
    fi
    
    # Run health checks
    if run_post_restart_checks; then
        show_restart_summary
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_success "System restart completed successfully in ${duration} seconds!"
    else
        log_error "Post-restart checks failed"
        exit 1
    fi
}

# Handle script interruption
trap 'log_error "Restart interrupted"; exit 1' INT TERM

# Run main function
main "$@"