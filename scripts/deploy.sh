#!/bin/bash

#==============================================================================
# Radiology AI System - Deployment Script
# Production deployment with health checks and rollback capability
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
DEPLOYMENT_TIMEOUT=300
HEALTH_CHECK_RETRIES=30
HEALTH_CHECK_INTERVAL=10

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking deployment prerequisites..."
    
    # Check if .env file exists
    if [[ ! -f "$PROJECT_ROOT/.env" ]]; then
        log_error ".env file not found. Please run setup-deployment.sh first."
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        log_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Check if necessary directories exist
    local required_dirs=("data" "logs" "backups")
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$PROJECT_ROOT/$dir" ]]; then
            log_error "Required directory '$dir' not found. Please run setup-deployment.sh first."
            exit 1
        fi
    done
    
    # Check SSL certificates
    if [[ ! -f "$PROJECT_ROOT/docker/nginx/ssl/radiology-ai.crt" ]]; then
        log_error "SSL certificates not found. Please run setup-deployment.sh first."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Create backup of current deployment
create_backup() {
    log_info "Creating deployment backup..."
    
    local backup_dir="$PROJECT_ROOT/backups/deployments/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Backup environment file
    cp "$PROJECT_ROOT/.env" "$backup_dir/"
    
    # Backup docker-compose file
    cp "$PROJECT_ROOT/docker-compose.yml" "$backup_dir/"
    
    # Export current container states
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" ps --services > "$backup_dir/services.txt" 2>/dev/null || true
    
    # Create deployment info
    cat > "$backup_dir/deployment-info.txt" <<EOF
Deployment Backup Created: $(date)
Git Commit: $(git rev-parse HEAD 2>/dev/null || echo "Not a git repository")
Docker Version: $(docker --version)
Docker Compose Version: $(docker-compose --version)
EOF
    
    log_success "Backup created at: $backup_dir"
    echo "$backup_dir" > "$PROJECT_ROOT/.last-backup"
}

# Pull latest images
pull_images() {
    log_info "Pulling latest Docker images..."
    
    cd "$PROJECT_ROOT"
    if docker-compose pull --quiet; then
        log_success "Images pulled successfully"
    else
        log_warning "Some images failed to pull, continuing with existing images"
    fi
}

# Build custom images
build_images() {
    log_info "Building custom Docker images..."
    
    cd "$PROJECT_ROOT"
    if docker-compose build --parallel; then
        log_success "Images built successfully"
    else
        log_error "Failed to build images"
        exit 1
    fi
}

# Start services with dependency order
start_services() {
    log_info "Starting services..."
    
    cd "$PROJECT_ROOT"
    
    # Start infrastructure services first
    log_info "Starting infrastructure services..."
    docker-compose up -d postgres redis
    
    # Wait for infrastructure to be ready
    wait_for_service "postgres" "5432" "PostgreSQL"
    wait_for_service "redis" "6379" "Redis"
    
    # Start monitoring services
    log_info "Starting monitoring services..."
    docker-compose up -d prometheus grafana loki promtail node-exporter cadvisor
    
    # Start application services
    log_info "Starting application services..."
    docker-compose up -d transcription-service report-generation summary-generation
    
    # Wait for application services
    wait_for_service "transcription-service" "8001" "Transcription Service"
    wait_for_service "report-generation" "8002" "Report Generation Service"
    wait_for_service "summary-generation" "8003" "Summary Generation Service"
    
    # Start backend API
    log_info "Starting backend API..."
    docker-compose up -d backend
    wait_for_service "backend" "8000" "Backend API"
    
    # Start frontend
    log_info "Starting frontend..."
    docker-compose up -d frontend
    wait_for_service "frontend" "3000" "Frontend"
    
    # Start reverse proxy
    log_info "Starting reverse proxy..."
    docker-compose up -d nginx
    wait_for_service "nginx" "80" "Nginx"
    
    # Start backup service
    log_info "Starting backup service..."
    docker-compose up -d postgres-backup
    
    log_success "All services started successfully"
}

# Wait for a service to be ready
wait_for_service() {
    local service_name="$1"
    local port="$2"
    local display_name="$3"
    local max_attempts=30
    local attempt=1
    
    log_info "Waiting for $display_name to be ready..."
    
    while [[ $attempt -le $max_attempts ]]; do
        if docker-compose exec -T "$service_name" sh -c "nc -z localhost $port" &> /dev/null; then
            log_success "$display_name is ready"
            return 0
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            log_error "$display_name failed to start within $(( max_attempts * 5 )) seconds"
            return 1
        fi
        
        log_info "Attempt $attempt/$max_attempts: $display_name not ready yet, waiting..."
        sleep 5
        ((attempt++))
    done
}

# Run comprehensive health checks
run_health_checks() {
    log_info "Running comprehensive health checks..."
    
    local services=(
        "nginx:80:/health"
        "backend:8000/health"
        "frontend:3000/api/health"
        "transcription-service:8001/health"
        "report-generation:8002/health"
        "summary-generation:8003/health"
        "grafana:3000/api/health"
        "prometheus:9090/-/healthy"
    )
    
    local failed_services=()
    
    for service_info in "${services[@]}"; do
        IFS=':' read -r service port path <<< "$service_info"
        
        log_info "Checking health of $service..."
        
        local attempts=0
        local max_attempts=5
        local healthy=false
        
        while [[ $attempts -lt $max_attempts ]]; do
            if docker-compose exec -T "$service" wget --no-verbose --tries=1 --spider "http://localhost:$port$path" &> /dev/null; then
                log_success "$service is healthy"
                healthy=true
                break
            fi
            
            ((attempts++))
            if [[ $attempts -lt $max_attempts ]]; then
                log_info "Health check attempt $attempts/$max_attempts failed for $service, retrying..."
                sleep 5
            fi
        done
        
        if [[ "$healthy" == "false" ]]; then
            log_error "$service health check failed"
            failed_services+=("$service")
        fi
    done
    
    if [[ ${#failed_services[@]} -gt 0 ]]; then
        log_error "Health checks failed for services: ${failed_services[*]}"
        return 1
    fi
    
    log_success "All health checks passed"
    return 0
}

# Test critical functionality
test_functionality() {
    log_info "Testing critical functionality..."
    
    # Test database connectivity
    log_info "Testing database connectivity..."
    if docker-compose exec -T postgres pg_isready -U meduser -d radiology_db &> /dev/null; then
        log_success "Database connectivity test passed"
    else
        log_error "Database connectivity test failed"
        return 1
    fi
    
    # Test Redis connectivity
    log_info "Testing Redis connectivity..."
    if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
        log_success "Redis connectivity test passed"
    else
        log_error "Redis connectivity test failed"
        return 1
    fi
    
    # Test API endpoints
    log_info "Testing API endpoints..."
    local api_endpoints=(
        "backend:8000/api/health"
        "transcription-service:8001/health"
        "report-generation:8002/health"
        "summary-generation:8003/health"
    )
    
    for endpoint in "${api_endpoints[@]}"; do
        IFS=':' read -r service port_path <<< "$endpoint"
        IFS=':' read -r port path <<< "$port_path"
        
        if docker-compose exec -T "$service" wget --no-verbose --tries=1 --spider "http://localhost:$port$path" &> /dev/null; then
            log_success "API endpoint $service$path is responding"
        else
            log_error "API endpoint $service$path is not responding"
            return 1
        fi
    done
    
    log_success "Functionality tests passed"
    return 0
}

# Display deployment status
show_deployment_status() {
    log_info "Deployment Status:"
    echo
    
    cd "$PROJECT_ROOT"
    docker-compose ps
    
    echo
    log_info "Service URLs:"
    echo "  • Frontend:    https://radiology-ai.local"
    echo "  • API:         https://radiology-ai.local/api"
    echo "  • Grafana:     https://radiology-ai.local/grafana"
    echo "  • Prometheus:  https://radiology-ai.local/prometheus"
    echo
    
    # Show resource usage
    log_info "Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" $(docker-compose ps -q) 2>/dev/null || true
}

# Rollback deployment
rollback_deployment() {
    log_error "Deployment failed, initiating rollback..."
    
    if [[ -f "$PROJECT_ROOT/.last-backup" ]]; then
        local backup_dir=$(cat "$PROJECT_ROOT/.last-backup")
        if [[ -d "$backup_dir" ]]; then
            log_info "Rolling back to backup: $backup_dir"
            
            # Stop current services
            docker-compose -f "$PROJECT_ROOT/docker-compose.yml" down
            
            # Restore backup
            cp "$backup_dir/.env" "$PROJECT_ROOT/"
            cp "$backup_dir/docker-compose.yml" "$PROJECT_ROOT/"
            
            log_success "Rollback completed"
        else
            log_error "Backup directory not found: $backup_dir"
        fi
    else
        log_error "No backup found for rollback"
    fi
}

# Clean up old resources
cleanup_old_resources() {
    log_info "Cleaning up old resources..."
    
    # Remove unused images
    docker image prune -f --filter "until=24h" &> /dev/null || true
    
    # Remove unused volumes (be careful with data volumes)
    docker volume prune -f --filter "label!=persistent" &> /dev/null || true
    
    # Remove old backup directories (keep last 10)
    find "$PROJECT_ROOT/backups/deployments" -type d -name "20*" | sort -r | tail -n +11 | xargs rm -rf 2>/dev/null || true
    
    log_success "Cleanup completed"
}

# Main deployment function
main() {
    local start_time=$(date +%s)
    
    log_info "Starting Radiology AI System deployment..."
    log_info "Deployment started at: $(date)"
    
    # Trap to handle failures
    trap 'log_error "Deployment failed"; rollback_deployment; exit 1' ERR
    
    check_prerequisites
    create_backup
    pull_images
    build_images
    start_services
    
    # Run health checks with retries
    local health_check_attempts=3
    local health_check_success=false
    
    for ((i=1; i<=health_check_attempts; i++)); do
        log_info "Health check attempt $i/$health_check_attempts"
        if run_health_checks && test_functionality; then
            health_check_success=true
            break
        fi
        
        if [[ $i -lt $health_check_attempts ]]; then
            log_warning "Health checks failed, waiting before retry..."
            sleep 30
        fi
    done
    
    if [[ "$health_check_success" == "false" ]]; then
        log_error "Health checks failed after $health_check_attempts attempts"
        rollback_deployment
        exit 1
    fi
    
    cleanup_old_resources
    show_deployment_status
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "Deployment completed successfully in ${duration} seconds!"
    
    echo
    log_info "Post-deployment checklist:"
    echo "1. Verify all services are running: docker-compose ps"
    echo "2. Check logs for any errors: docker-compose logs"
    echo "3. Test the application through the web interface"
    echo "4. Monitor system metrics in Grafana"
    echo "5. Verify backup processes are working"
    echo
    log_info "Important commands:"
    echo "  • View logs: ./scripts/logs.sh [service]"
    echo "  • Stop system: ./scripts/stop.sh"
    echo "  • Restart system: ./scripts/restart.sh"
    echo "  • Health check: ./scripts/health-check.sh"
}

# Run main function
main "$@"