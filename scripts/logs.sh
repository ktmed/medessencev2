#!/bin/bash

#==============================================================================
# Radiology AI System - Log Viewer Script
# Comprehensive log viewing and analysis for medical compliance
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

# Show help
show_help() {
    cat <<EOF
Usage: $0 [OPTIONS] [SERVICE]

View and analyze Radiology AI System logs with medical compliance features.

Arguments:
  SERVICE                 Specific service to view logs for (optional)

Options:
  --follow, -f           Follow log output (tail -f behavior)
  --tail, -t N           Show last N lines (default: 100)
  --since, -s TIME       Show logs since timestamp (e.g., "2023-01-01T10:00:00")
  --until, -u TIME       Show logs until timestamp
  --grep, -g PATTERN     Filter logs by pattern
  --level, -l LEVEL      Filter by log level (ERROR, WARN, INFO, DEBUG)
  --export, -e FORMAT    Export logs (json, csv, text)
  --medical, -m          Show only medical/audit logs
  --errors, -E           Show only error logs
  --performance, -p      Show performance metrics from logs
  --compliance, -c       Generate compliance report
  --all, -a              Show logs from all services
  --help, -h             Show this help message

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

Examples:
  $0                                    # Show recent logs from all services
  $0 backend                           # Show backend service logs
  $0 --follow --tail 50 backend        # Follow backend logs, last 50 lines
  $0 --level ERROR --all               # Show all error logs
  $0 --medical --export json           # Export medical logs as JSON
  $0 --since "1 hour ago" --grep "patient"  # Search patient-related logs
  $0 --compliance                      # Generate compliance report
EOF
}

# Parse command line arguments
parse_arguments() {
    local service=""
    local follow=false
    local tail_lines=100
    local since=""
    local until=""
    local grep_pattern=""
    local log_level=""
    local export_format=""
    local medical_only=false
    local errors_only=false
    local performance=false
    local compliance=false
    local all_services=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --follow|-f)
                follow=true
                shift
                ;;
            --tail|-t)
                tail_lines="$2"
                shift 2
                ;;
            --since|-s)
                since="$2"
                shift 2
                ;;
            --until|-u)
                until="$2"
                shift 2
                ;;
            --grep|-g)
                grep_pattern="$2"
                shift 2
                ;;
            --level|-l)
                log_level="$2"
                shift 2
                ;;
            --export|-e)
                export_format="$2"
                shift 2
                ;;
            --medical|-m)
                medical_only=true
                shift
                ;;
            --errors|-E)
                errors_only=true
                shift
                ;;
            --performance|-p)
                performance=true
                shift
                ;;
            --compliance|-c)
                compliance=true
                shift
                ;;
            --all|-a)
                all_services=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            -*)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
            *)
                service="$1"
                shift
                ;;
        esac
    done
    
    # Output parsed arguments as a single line
    echo "$service|$follow|$tail_lines|$since|$until|$grep_pattern|$log_level|$export_format|$medical_only|$errors_only|$performance|$compliance|$all_services"
}

# Get available services
get_available_services() {
    cd "$PROJECT_ROOT"
    docker-compose config --services 2>/dev/null || echo ""
}

# View standard Docker Compose logs
view_docker_logs() {
    local service="$1"
    local follow="$2"
    local tail_lines="$3"
    local since="$4"
    local until="$5"
    
    cd "$PROJECT_ROOT"
    
    local docker_args=()
    
    if [[ "$follow" == "true" ]]; then
        docker_args+=("--follow")
    fi
    
    if [[ -n "$tail_lines" ]]; then
        docker_args+=("--tail" "$tail_lines")
    fi
    
    if [[ -n "$since" ]]; then
        docker_args+=("--since" "$since")
    fi
    
    if [[ -n "$until" ]]; then
        docker_args+=("--until" "$until")
    fi
    
    if [[ -n "$service" ]]; then
        docker-compose logs "${docker_args[@]}" "$service"
    else
        docker-compose logs "${docker_args[@]}"
    fi
}

# Filter logs by pattern or level
filter_logs() {
    local grep_pattern="$1"
    local log_level="$2"
    local medical_only="$3"
    local errors_only="$4"
    
    local filter_cmd="cat"
    
    # Apply filters in sequence
    if [[ "$errors_only" == "true" ]]; then
        filter_cmd="$filter_cmd | grep -i -E '(ERROR|FATAL|CRITICAL)'"
    elif [[ -n "$log_level" ]]; then
        filter_cmd="$filter_cmd | grep -i '$log_level'"
    fi
    
    if [[ "$medical_only" == "true" ]]; then
        filter_cmd="$filter_cmd | grep -i -E '(patient|procedure|medical|audit|transcription|report|summary)'"
    fi
    
    if [[ -n "$grep_pattern" ]]; then
        filter_cmd="$filter_cmd | grep -i '$grep_pattern'"
    fi
    
    # Add syntax highlighting for important log levels
    filter_cmd="$filter_cmd | sed 's/ERROR/\\033[0;31mERROR\\033[0m/g; s/WARN/\\033[1;33mWARN\\033[0m/g; s/INFO/\\033[0;32mINFO\\033[0m/g'"
    
    eval "$filter_cmd"
}

# Show performance metrics from logs
show_performance_metrics() {
    local service="$1"
    
    log_info "Extracting performance metrics from logs..."
    
    cd "$PROJECT_ROOT"
    
    local services=()
    if [[ -n "$service" ]]; then
        services=("$service")
    else
        mapfile -t services < <(docker-compose config --services)
    fi
    
    for svc in "${services[@]}"; do
        log_info "Performance metrics for $svc:"
        
        # Extract response times
        docker-compose logs --tail 1000 "$svc" 2>/dev/null | \
            grep -i -E "(response_time|duration|latency)" | \
            head -10 || echo "  No performance metrics found"
        
        # Extract error rates
        local error_count=$(docker-compose logs --tail 1000 "$svc" 2>/dev/null | grep -c -i -E "(ERROR|FATAL)" || echo "0")
        local total_count=$(docker-compose logs --tail 1000 "$svc" 2>/dev/null | wc -l || echo "1")
        local error_rate=$(echo "scale=2; $error_count * 100 / $total_count" | bc -l 2>/dev/null || echo "0.00")
        
        echo "  Error rate: $error_rate% ($error_count/$total_count)"
        echo
    done
}

# Generate compliance report
generate_compliance_report() {
    local since="$1"
    local until="$2"
    
    log_info "Generating medical compliance report..."
    
    local report_file="$PROJECT_ROOT/reports/compliance/compliance-report-$(date +%Y%m%d_%H%M%S).txt"
    mkdir -p "$(dirname "$report_file")"
    
    cat > "$report_file" <<EOF
=============================================================================
MEDICAL COMPLIANCE REPORT - RADIOLOGY AI SYSTEM
=============================================================================
Generated: $(date)
Period: ${since:-system_start} to ${until:-now}
System: Radiology AI Medical Processing System
Compliance Framework: German Medical Device Regulation (MDR)

=============================================================================
AUDIT TRAIL SUMMARY
=============================================================================
EOF
    
    cd "$PROJECT_ROOT"
    
    # User activity summary
    echo "User Activity:" >> "$report_file"
    docker-compose logs --since "${since:-24h}" 2>/dev/null | \
        grep -i -E "(login|logout|user|authentication)" | \
        wc -l >> "$report_file" || echo "0" >> "$report_file"
    
    # Medical procedure summary
    echo -e "\nMedical Procedures Processed:" >> "$report_file"
    docker-compose logs --since "${since:-24h}" 2>/dev/null | \
        grep -i -E "(transcription|report|summary|procedure)" | \
        wc -l >> "$report_file" || echo "0" >> "$report_file"
    
    # Error summary
    echo -e "\nSystem Errors:" >> "$report_file"
    docker-compose logs --since "${since:-24h}" 2>/dev/null | \
        grep -i -E "(ERROR|FATAL|CRITICAL)" | \
        wc -l >> "$report_file" || echo "0" >> "$report_file"
    
    # Security events
    echo -e "\nSecurity Events:" >> "$report_file"
    docker-compose logs --since "${since:-24h}" 2>/dev/null | \
        grep -i -E "(security|unauthorized|breach|failed.*login)" | \
        wc -l >> "$report_file" || echo "0" >> "$report_file"
    
    # Data access events
    echo -e "\nData Access Events:" >> "$report_file"
    docker-compose logs --since "${since:-24h}" 2>/dev/null | \
        grep -i -E "(database|postgres|redis|data.*access)" | \
        wc -l >> "$report_file" || echo "0" >> "$report_file"
    
    # Detailed audit trail
    echo -e "\n=============================================================================\nDETAILED AUDIT TRAIL\n=============================================================================" >> "$report_file"
    
    docker-compose logs --since "${since:-24h}" 2>/dev/null | \
        grep -i -E "(audit|medical|patient|procedure|user.*action|authentication)" | \
        head -100 >> "$report_file" || echo "No detailed audit entries found" >> "$report_file"
    
    log_success "Compliance report generated: $report_file"
    
    # Display summary
    echo
    log_info "Compliance Report Summary:"
    head -30 "$report_file" | tail -20
}

# Export logs in different formats
export_logs() {
    local service="$1"
    local format="$2"
    local since="$3"
    local until="$4"
    local grep_pattern="$5"
    
    local export_file="$PROJECT_ROOT/exports/logs-$(date +%Y%m%d_%H%M%S).$format"
    mkdir -p "$(dirname "$export_file")"
    
    log_info "Exporting logs to: $export_file"
    
    cd "$PROJECT_ROOT"
    
    local log_data
    if [[ -n "$service" ]]; then
        log_data=$(docker-compose logs --since "${since:-24h}" ${until:+--until "$until"} "$service")
    else
        log_data=$(docker-compose logs --since "${since:-24h}" ${until:+--until "$until"})
    fi
    
    # Apply grep filter if specified
    if [[ -n "$grep_pattern" ]]; then
        log_data=$(echo "$log_data" | grep -i "$grep_pattern")
    fi
    
    case "$format" in
        "json")
            echo "$log_data" | jq -R -s 'split("\n") | map(select(length > 0)) | map({timestamp: ., message: .})' > "$export_file"
            ;;
        "csv")
            echo "timestamp,service,level,message" > "$export_file"
            echo "$log_data" | sed 's/,/;/g' | awk -F'|' '{print $1","$2","$3","$4}' >> "$export_file"
            ;;
        "text"|*)
            echo "$log_data" > "$export_file"
            ;;
    esac
    
    log_success "Logs exported successfully"
}

# Show log statistics
show_log_statistics() {
    local service="$1"
    local since="$2"
    
    log_info "Log Statistics:"
    
    cd "$PROJECT_ROOT"
    
    local log_data
    if [[ -n "$service" ]]; then
        log_data=$(docker-compose logs --since "${since:-24h}" "$service" 2>/dev/null)
    else
        log_data=$(docker-compose logs --since "${since:-24h}" 2>/dev/null)
    fi
    
    if [[ -z "$log_data" ]]; then
        log_warning "No logs found"
        return
    fi
    
    local total_lines=$(echo "$log_data" | wc -l)
    local error_lines=$(echo "$log_data" | grep -c -i -E "(ERROR|FATAL)" || echo "0")
    local warn_lines=$(echo "$log_data" | grep -c -i "WARN" || echo "0")
    local info_lines=$(echo "$log_data" | grep -c -i "INFO" || echo "0")
    
    echo "  Total log entries: $total_lines"
    echo "  Error entries: $error_lines"
    echo "  Warning entries: $warn_lines"
    echo "  Info entries: $info_lines"
    
    # Most active services
    echo "  Most active services:"
    echo "$log_data" | grep -o '^[^|]*' | sort | uniq -c | sort -nr | head -5 | sed 's/^/    /'
}

# Main function
main() {
    # Parse arguments
    local args=$(parse_arguments "$@")
    IFS='|' read -r service follow tail_lines since until grep_pattern log_level export_format medical_only errors_only performance compliance all_services <<< "$args"
    
    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not available"
        exit 1
    fi
    
    cd "$PROJECT_ROOT"
    
    # Validate service name if provided
    if [[ -n "$service" ]] && [[ "$all_services" == "false" ]]; then
        if ! docker-compose config --services | grep -q "^$service$"; then
            log_error "Service '$service' not found"
            log_info "Available services:"
            docker-compose config --services | sed 's/^/  - /'
            exit 1
        fi
    fi
    
    # Handle special modes
    if [[ "$compliance" == "true" ]]; then
        generate_compliance_report "$since" "$until"
        return
    fi
    
    if [[ "$performance" == "true" ]]; then
        show_performance_metrics "$service"
        return
    fi
    
    # Show log statistics first
    show_log_statistics "$service" "$since"
    echo
    
    # Handle export mode
    if [[ -n "$export_format" ]]; then
        export_logs "$service" "$export_format" "$since" "$until" "$grep_pattern"
        return
    fi
    
    # Set service to empty for all services mode
    if [[ "$all_services" == "true" ]]; then
        service=""
    fi
    
    # Show logs with filtering
    log_info "Showing logs for ${service:-all services}..."
    if [[ -n "$grep_pattern" ]] || [[ -n "$log_level" ]] || [[ "$medical_only" == "true" ]] || [[ "$errors_only" == "true" ]]; then
        log_info "Applying filters: pattern='$grep_pattern' level='$log_level' medical_only=$medical_only errors_only=$errors_only"
    fi
    echo
    
    # View and filter logs
    view_docker_logs "$service" "$follow" "$tail_lines" "$since" "$until" | \
        filter_logs "$grep_pattern" "$log_level" "$medical_only" "$errors_only"
}

# Run main function
main "$@"