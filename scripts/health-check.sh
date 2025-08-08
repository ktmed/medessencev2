#!/bin/bash

#==============================================================================
# Radiology AI System - Health Check Script
# Comprehensive system health monitoring for medical environment
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

# Health check configuration
TIMEOUT=30
RETRY_COUNT=3
RETRY_DELAY=5

# Health check results
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    ((PASSED_CHECKS++))
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    ((WARNING_CHECKS++))
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ((FAILED_CHECKS++))
}

# Increment total checks counter
increment_check() {
    ((TOTAL_CHECKS++))
}

# Show help
show_help() {
    cat <<EOF
Usage: $0 [OPTIONS]

Perform comprehensive health checks on the Radiology AI System.

Options:
  --service, -s SERVICE   Check specific service only
  --quick, -q            Quick check (basic services only)
  --detailed, -d         Detailed check with performance metrics
  --continuous, -c       Continuous monitoring mode
  --interval, -i N       Check interval in seconds (for continuous mode)
  --json                 Output results in JSON format
  --nagios               Output in Nagios-compatible format
  --export, -e FILE      Export results to file
  --quiet                Suppress non-essential output
  --help, -h             Show this help message

Available Services:
  - nginx (reverse proxy and load balancer)
  - frontend (web interface)
  - backend (API gateway and authentication)
  - transcription-service (medical audio transcription)
  - report-generation (medical report generator)
  - summary-generation (medical summary generator)
  - postgres (database)
  - redis (cache and session store)
  - prometheus (metrics collection)
  - grafana (dashboards)
  - loki (log aggregation)
  - promtail (log collection)

Examples:
  $0                              # Full health check
  $0 --service backend           # Check backend service only
  $0 --quick                     # Quick system check
  $0 --detailed --json           # Detailed check with JSON output
  $0 --continuous --interval 60  # Monitor every 60 seconds
EOF
}

# Parse command line arguments
parse_arguments() {
    local service=""
    local quick=false
    local detailed=false
    local continuous=false
    local interval=60
    local json_output=false
    local nagios_output=false
    local export_file=""
    local quiet=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --service|-s)
                service="$2"
                shift 2
                ;;
            --quick|-q)
                quick=true
                shift
                ;;
            --detailed|-d)
                detailed=true
                shift
                ;;
            --continuous|-c)
                continuous=true
                shift
                ;;
            --interval|-i)
                interval="$2"
                shift 2
                ;;
            --json)
                json_output=true
                shift
                ;;
            --nagios)
                nagios_output=true
                shift
                ;;
            --export|-e)
                export_file="$2"
                shift 2
                ;;
            --quiet)
                quiet=true
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
    
    echo "$service|$quick|$detailed|$continuous|$interval|$json_output|$nagios_output|$export_file|$quiet"
}

# Check if Docker and Docker Compose are available
check_docker_environment() {
    increment_check
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        return 1
    fi
    
    increment_check
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed or not in PATH"
        return 1
    fi
    
    increment_check
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running or not accessible"
        return 1
    fi
    
    log_success "Docker environment is healthy"
    return 0
}

# Check service container status
check_container_status() {
    local service="$1"
    
    increment_check
    cd "$PROJECT_ROOT"
    
    local container_status=$(docker-compose ps -q "$service" 2>/dev/null | xargs docker inspect --format='{{.State.Status}}' 2>/dev/null || echo "not_found")
    
    case "$container_status" in
        "running")
            log_success "Container $service is running"
            return 0
            ;;
        "exited")
            log_error "Container $service has exited"
            return 1
            ;;
        "restarting")
            log_warning "Container $service is restarting"
            return 1
            ;;
        "not_found")
            log_error "Container $service not found"
            return 1
            ;;
        *)
            log_error "Container $service is in unknown state: $container_status"
            return 1
            ;;
    esac
}

# Check service health endpoint
check_health_endpoint() {
    local service="$1"
    local port="$2"
    local path="$3"
    local expected_status="${4:-200}"
    
    increment_check
    cd "$PROJECT_ROOT"
    
    local retry=0
    while [[ $retry -lt $RETRY_COUNT ]]; do
        if docker-compose exec -T "$service" timeout "$TIMEOUT" wget --no-verbose --tries=1 --spider "http://localhost:$port$path" &> /dev/null; then
            log_success "Health endpoint $service:$port$path is responding"
            return 0
        fi
        
        ((retry++))
        if [[ $retry -lt $RETRY_COUNT ]]; then
            sleep $RETRY_DELAY
        fi
    done
    
    log_error "Health endpoint $service:$port$path is not responding after $RETRY_COUNT attempts"
    return 1
}

# Check database connectivity and health
check_database_health() {
    increment_check
    cd "$PROJECT_ROOT"
    
    # Check PostgreSQL connectivity
    if docker-compose exec -T postgres timeout "$TIMEOUT" pg_isready -U meduser -d radiology_db &> /dev/null; then
        log_success "PostgreSQL database is accessible"
    else
        log_error "PostgreSQL database is not accessible"
        return 1
    fi
    
    increment_check
    # Check database can execute queries
    if docker-compose exec -T postgres timeout "$TIMEOUT" psql -U meduser -d radiology_db -c "SELECT 1;" &> /dev/null; then
        log_success "PostgreSQL database can execute queries"
    else
        log_error "PostgreSQL database cannot execute queries"
        return 1
    fi
    
    increment_check
    # Check database connections
    local connection_count=$(docker-compose exec -T postgres psql -U meduser -d radiology_db -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" 2>/dev/null | tr -d ' ' || echo "0")
    local max_connections=$(docker-compose exec -T postgres psql -U meduser -d radiology_db -t -c "SHOW max_connections;" 2>/dev/null | tr -d ' ' || echo "100")
    local connection_percentage=$(echo "scale=2; $connection_count * 100 / $max_connections" | bc -l 2>/dev/null || echo "0")
    
    if (( $(echo "$connection_percentage > 80" | bc -l 2>/dev/null || echo "0") )); then
        log_warning "Database connection usage is high: ${connection_percentage}% (${connection_count}/${max_connections})"
    else
        log_success "Database connection usage is normal: ${connection_percentage}% (${connection_count}/${max_connections})"
    fi
    
    return 0
}

# Check Redis connectivity and health
check_redis_health() {
    increment_check
    cd "$PROJECT_ROOT"
    
    # Check Redis connectivity
    if docker-compose exec -T redis timeout "$TIMEOUT" redis-cli ping | grep -q "PONG"; then
        log_success "Redis cache is accessible"
    else
        log_error "Redis cache is not accessible"
        return 1
    fi
    
    increment_check
    # Check Redis memory usage
    local memory_info=$(docker-compose exec -T redis redis-cli info memory 2>/dev/null | grep "used_memory_human" | cut -d: -f2 | tr -d '\r' || echo "unknown")
    local max_memory=$(docker-compose exec -T redis redis-cli config get maxmemory 2>/dev/null | tail -1 | tr -d '\r' || echo "0")
    
    if [[ "$max_memory" != "0" ]]; then
        local used_memory=$(docker-compose exec -T redis redis-cli info memory 2>/dev/null | grep "used_memory:" | cut -d: -f2 | tr -d '\r' || echo "0")
        local memory_percentage=$(echo "scale=2; $used_memory * 100 / $max_memory" | bc -l 2>/dev/null || echo "0")
        
        if (( $(echo "$memory_percentage > 90" | bc -l 2>/dev/null || echo "0") )); then
            log_warning "Redis memory usage is high: ${memory_percentage}% ($memory_info)"
        else
            log_success "Redis memory usage is normal: ${memory_percentage}% ($memory_info)"
        fi
    else
        log_success "Redis memory usage: $memory_info"
    fi
    
    return 0
}

# Check service-specific health
check_service_health() {
    local service="$1"
    
    case "$service" in
        "nginx")
            check_container_status "$service"
            check_health_endpoint "$service" "80" "/health"
            ;;
        "frontend")
            check_container_status "$service"
            check_health_endpoint "$service" "3000" "/api/health"
            ;;
        "backend")
            check_container_status "$service"
            check_health_endpoint "$service" "8000" "/health"
            ;;
        "transcription-service")
            check_container_status "$service"
            check_health_endpoint "$service" "8001" "/health"
            ;;
        "report-generation")
            check_container_status "$service"
            check_health_endpoint "$service" "8002" "/health"
            ;;
        "summary-generation")
            check_container_status "$service"
            check_health_endpoint "$service" "8003" "/health"
            ;;
        "postgres")
            check_container_status "$service"
            check_database_health
            ;;
        "redis")
            check_container_status "$service"
            check_redis_health
            ;;
        "prometheus")
            check_container_status "$service"
            check_health_endpoint "$service" "9090" "/-/healthy"
            ;;
        "grafana")
            check_container_status "$service"
            check_health_endpoint "$service" "3000" "/api/health"
            ;;
        "loki")
            check_container_status "$service"
            check_health_endpoint "$service" "3100" "/ready"
            ;;
        "promtail"|"node-exporter"|"cadvisor")
            check_container_status "$service"
            ;;
        *)
            log_warning "Unknown service: $service"
            return 1
            ;;
    esac
}

# Check system resources
check_system_resources() {
    increment_check
    # Check disk space
    local disk_usage=$(df "$PROJECT_ROOT" | awk 'NR==2 {print $5}' | sed 's/%//')
    if [[ $disk_usage -gt 90 ]]; then
        log_error "Disk usage is critical: ${disk_usage}%"
    elif [[ $disk_usage -gt 80 ]]; then
        log_warning "Disk usage is high: ${disk_usage}%"
    else
        log_success "Disk usage is normal: ${disk_usage}%"
    fi
    
    increment_check
    # Check memory usage
    local memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [[ $memory_usage -gt 95 ]]; then
        log_error "Memory usage is critical: ${memory_usage}%"
    elif [[ $memory_usage -gt 85 ]]; then
        log_warning "Memory usage is high: ${memory_usage}%"
    else
        log_success "Memory usage is normal: ${memory_usage}%"
    fi
    
    increment_check
    # Check CPU load
    local cpu_load=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local cpu_cores=$(nproc)
    local load_percentage=$(echo "scale=0; $cpu_load * 100 / $cpu_cores" | bc -l 2>/dev/null || echo "0")
    
    if [[ $load_percentage -gt 200 ]]; then
        log_error "CPU load is critical: ${cpu_load} (${load_percentage}% of ${cpu_cores} cores)"
    elif [[ $load_percentage -gt 100 ]]; then
        log_warning "CPU load is high: ${cpu_load} (${load_percentage}% of ${cpu_cores} cores)"
    else
        log_success "CPU load is normal: ${cpu_load} (${load_percentage}% of ${cpu_cores} cores)"
    fi
}

# Check external dependencies
check_external_dependencies() {
    increment_check
    # Check internet connectivity
    if timeout 10 wget --no-verbose --tries=1 --spider "https://api.openai.com" &> /dev/null; then
        log_success "OpenAI API is reachable"
    else
        log_warning "OpenAI API is not reachable (may affect AI services)"
    fi
    
    increment_check
    # Check DNS resolution
    if timeout 5 nslookup google.com &> /dev/null; then
        log_success "DNS resolution is working"
    else
        log_error "DNS resolution is not working"
    fi
}

# Perform detailed checks
perform_detailed_checks() {
    log_info "Performing detailed health checks..."
    
    # Check log file sizes
    increment_check
    if [[ -d "$PROJECT_ROOT/logs" ]]; then
        local log_size=$(du -sm "$PROJECT_ROOT/logs" 2>/dev/null | cut -f1 || echo "0")
        if [[ $log_size -gt 1000 ]]; then
            log_warning "Log directory size is large: ${log_size}MB"
        else
            log_success "Log directory size is normal: ${log_size}MB"
        fi
    fi
    
    # Check backup status
    increment_check
    if [[ -d "$PROJECT_ROOT/backups" ]]; then
        local latest_backup=$(find "$PROJECT_ROOT/backups" -name "*backup_*" -type d 2>/dev/null | sort | tail -1)
        if [[ -n "$latest_backup" ]]; then
            local backup_age=$((($(date +%s) - $(stat -c %Y "$latest_backup")) / 86400))
            if [[ $backup_age -gt 7 ]]; then
                log_warning "Latest backup is $backup_age days old"
            else
                log_success "Latest backup is $backup_age days old"
            fi
        else
            log_warning "No backups found"
        fi
    fi
    
    # Check SSL certificate expiry
    increment_check
    if [[ -f "$PROJECT_ROOT/docker/nginx/ssl/radiology-ai.crt" ]]; then
        local cert_expiry=$(openssl x509 -enddate -noout -in "$PROJECT_ROOT/docker/nginx/ssl/radiology-ai.crt" 2>/dev/null | cut -d= -f2)
        if [[ -n "$cert_expiry" ]]; then
            local expiry_epoch=$(date -d "$cert_expiry" +%s 2>/dev/null || echo "0")
            local current_epoch=$(date +%s)
            local days_until_expiry=$(((expiry_epoch - current_epoch) / 86400))
            
            if [[ $days_until_expiry -lt 30 ]]; then
                log_error "SSL certificate expires in $days_until_expiry days"
            elif [[ $days_until_expiry -lt 90 ]]; then
                log_warning "SSL certificate expires in $days_until_expiry days"
            else
                log_success "SSL certificate expires in $days_until_expiry days"
            fi
        fi
    fi
    
    # Check Docker image versions
    increment_check
    cd "$PROJECT_ROOT"
    local outdated_images=$(docker images --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}" | grep -E "(postgres|redis|nginx|grafana|prometheus)" | awk '$2 ~ /months?|years?/ {print $1}' | wc -l)
    if [[ $outdated_images -gt 0 ]]; then
        log_warning "$outdated_images Docker images are potentially outdated"
    else
        log_success "Docker images appear to be recent"
    fi
}

# Quick health check
perform_quick_check() {
    log_info "Performing quick health check..."
    
    # Check only critical services
    local critical_services=("postgres" "redis" "backend" "nginx")
    
    for service in "${critical_services[@]}"; do
        check_service_health "$service"
    done
    
    check_system_resources
}

# Full health check
perform_full_check() {
    log_info "Performing full health check..."
    
    # Check Docker environment
    check_docker_environment
    
    # Check all services
    cd "$PROJECT_ROOT"
    local services=$(docker-compose config --services 2>/dev/null || echo "")
    
    if [[ -n "$services" ]]; then
        while IFS= read -r service; do
            check_service_health "$service"
        done <<< "$services"
    fi
    
    # Check system resources
    check_system_resources
    
    # Check external dependencies
    check_external_dependencies
}

# Generate health check report
generate_report() {
    local json_output="$1"
    local nagios_output="$2"
    local export_file="$3"
    
    local status="OK"
    local exit_code=0
    
    if [[ $FAILED_CHECKS -gt 0 ]]; then
        status="CRITICAL"
        exit_code=2
    elif [[ $WARNING_CHECKS -gt 0 ]]; then
        status="WARNING"
        exit_code=1
    fi
    
    if [[ "$json_output" == "true" ]]; then
        local json_report=$(cat <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "system": "Radiology AI Medical Processing System",
    "status": "$status",
    "summary": {
        "total_checks": $TOTAL_CHECKS,
        "passed": $PASSED_CHECKS,
        "warnings": $WARNING_CHECKS,
        "failures": $FAILED_CHECKS
    },
    "exit_code": $exit_code
}
EOF
        )
        echo "$json_report"
        
        if [[ -n "$export_file" ]]; then
            echo "$json_report" > "$export_file"
        fi
        
    elif [[ "$nagios_output" == "true" ]]; then
        echo "$status - $PASSED_CHECKS/$TOTAL_CHECKS checks passed, $WARNING_CHECKS warnings, $FAILED_CHECKS failures"
        
    else
        echo
        log_info "Health Check Summary:"
        echo "  Status: $status"
        echo "  Total Checks: $TOTAL_CHECKS"
        echo "  Passed: $GREEN$PASSED_CHECKS$NC"
        echo "  Warnings: $YELLOW$WARNING_CHECKS$NC"
        echo "  Failures: $RED$FAILED_CHECKS$NC"
        
        if [[ -n "$export_file" ]]; then
            cat > "$export_file" <<EOF
Health Check Report - $(date)
System: Radiology AI Medical Processing System
Status: $status
Total Checks: $TOTAL_CHECKS
Passed: $PASSED_CHECKS
Warnings: $WARNING_CHECKS
Failures: $FAILED_CHECKS
EOF
        fi
    fi
    
    return $exit_code
}

# Continuous monitoring mode
continuous_monitoring() {
    local interval="$1"
    local service="$2"
    local detailed="$3"
    
    log_info "Starting continuous monitoring (interval: ${interval}s)"
    log_info "Press Ctrl+C to stop"
    
    while true; do
        # Reset counters
        TOTAL_CHECKS=0
        PASSED_CHECKS=0
        FAILED_CHECKS=0
        WARNING_CHECKS=0
        
        echo
        echo "=== Health Check - $(date) ==="
        
        if [[ -n "$service" ]]; then
            check_service_health "$service"
        else
            if [[ "$detailed" == "true" ]]; then
                perform_full_check
                perform_detailed_checks
            else
                perform_quick_check
            fi
        fi
        
        generate_report "false" "false" ""
        
        sleep "$interval"
    done
}

# Main function
main() {
    # Parse arguments
    local args=$(parse_arguments "$@")
    IFS='|' read -r service quick detailed continuous interval json_output nagios_output export_file quiet <<< "$args"
    
    if [[ "$quiet" == "false" ]]; then
        log_info "Starting Radiology AI System health check..."
    fi
    
    # Handle continuous monitoring
    if [[ "$continuous" == "true" ]]; then
        continuous_monitoring "$interval" "$service" "$detailed"
        return
    fi
    
    # Perform health checks
    if [[ -n "$service" ]]; then
        check_service_health "$service"
    elif [[ "$quick" == "true" ]]; then
        perform_quick_check
    else
        perform_full_check
        if [[ "$detailed" == "true" ]]; then
            perform_detailed_checks
        fi
    fi
    
    # Generate and display report
    generate_report "$json_output" "$nagios_output" "$export_file"
}

# Handle script interruption in continuous mode
trap 'echo; log_info "Health check monitoring stopped"; exit 0' INT TERM

# Run main function
main "$@"