#!/bin/bash

#==============================================================================
# Radiology AI System - Backup Script
# Medical-grade backup with German compliance requirements
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
BACKUP_RETENTION_DAYS=7
BACKUP_RETENTION_WEEKS=4
BACKUP_RETENTION_MONTHS=6
BACKUP_RETENTION_YEARS=30  # German medical compliance

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

# Load environment variables
load_environment() {
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
    else
        log_error ".env file not found"
        exit 1
    fi
}

# Show help
show_help() {
    cat <<EOF
Usage: $0 [OPTIONS]

Create comprehensive backups of the Radiology AI System with medical compliance.

Options:
  --type, -t TYPE        Backup type: full, database, config, logs, all (default: all)
  --output, -o DIR       Output directory (default: backups/)
  --encrypt, -e          Encrypt backup files (recommended for medical data)
  --compress, -c         Compress backup files
  --verify, -v           Verify backup integrity
  --remote, -r           Upload to remote storage (S3, etc.)
  --retention, -R        Apply retention policy after backup
  --quiet, -q            Suppress non-essential output
  --help, -h             Show this help message

Backup Types:
  full        Complete system backup (database + config + logs + volumes)
  database    PostgreSQL database only
  config      Configuration files and certificates
  logs        System and application logs
  volumes     Docker volumes and data directories
  medical     Medical audit logs and compliance data

Examples:
  $0                               # Full backup with default settings
  $0 --type database --encrypt     # Encrypted database backup
  $0 --type full --remote --verify # Full backup with remote upload and verification
  $0 --type medical --output /secure/backups  # Medical compliance backup
EOF
}

# Parse command line arguments
parse_arguments() {
    local backup_type="all"
    local output_dir="$PROJECT_ROOT/backups"
    local encrypt=false
    local compress=true
    local verify=false
    local remote=false
    local retention=true
    local quiet=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --type|-t)
                backup_type="$2"
                shift 2
                ;;
            --output|-o)
                output_dir="$2"
                shift 2
                ;;
            --encrypt|-e)
                encrypt=true
                shift
                ;;
            --compress|-c)
                compress=true
                shift
                ;;
            --verify|-v)
                verify=true
                shift
                ;;
            --remote|-r)
                remote=true
                shift
                ;;
            --retention|-R)
                retention=true
                shift
                ;;
            --quiet|-q)
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
    
    echo "$backup_type|$output_dir|$encrypt|$compress|$verify|$remote|$retention|$quiet"
}

# Create backup directory structure
create_backup_structure() {
    local backup_root="$1"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="$backup_root/full_backup_$timestamp"
    
    mkdir -p "$backup_dir"/{database,config,logs,volumes,medical,metadata}
    
    echo "$backup_dir"
}

# Backup PostgreSQL database
backup_database() {
    local backup_dir="$1"
    local compress="$2"
    local encrypt="$3"
    
    log_info "Creating database backup..."
    
    cd "$PROJECT_ROOT"
    
    # Check if database is running
    if ! docker-compose exec -T postgres pg_isready -U meduser -d radiology_db &> /dev/null; then
        log_error "Database is not accessible"
        return 1
    fi
    
    local dump_file="$backup_dir/database/radiology_db_$(date +%Y%m%d_%H%M%S).sql"
    
    # Create database dump with custom format for better compression and parallel restore
    docker-compose exec -T postgres pg_dump \
        -U meduser \
        -d radiology_db \
        --format=custom \
        --verbose \
        --no-password \
        --compress=9 \
        --exclude-table-data='audit_log_temp' > "$dump_file.custom"
    
    # Also create a plain SQL dump for portability
    docker-compose exec -T postgres pg_dump \
        -U meduser \
        -d radiology_db \
        --format=plain \
        --verbose \
        --no-password \
        --create \
        --clean > "$dump_file"
    
    # Backup database schema separately
    docker-compose exec -T postgres pg_dump \
        -U meduser \
        -d radiology_db \
        --schema-only \
        --verbose \
        --no-password > "$backup_dir/database/schema_$(date +%Y%m%d_%H%M%S).sql"
    
    # Export database statistics
    docker-compose exec -T postgres psql -U meduser -d radiology_db -c "\l; \dt; \du;" > "$backup_dir/database/db_info.txt"
    
    # Backup database configuration
    docker-compose exec -T postgres cat /etc/postgresql/postgresql.conf > "$backup_dir/database/postgresql.conf" 2>/dev/null || true
    docker-compose exec -T postgres cat /etc/postgresql/pg_hba.conf > "$backup_dir/database/pg_hba.conf" 2>/dev/null || true
    
    # Get database size
    local db_size=$(docker-compose exec -T postgres psql -U meduser -d radiology_db -t -c "SELECT pg_size_pretty(pg_database_size('radiology_db'));")
    echo "Database size: $db_size" > "$backup_dir/database/backup_info.txt"
    
    if [[ "$compress" == "true" ]]; then
        log_info "Compressing database backup..."
        gzip "$dump_file"
        dump_file="$dump_file.gz"
    fi
    
    if [[ "$encrypt" == "true" ]]; then
        log_info "Encrypting database backup..."
        gpg --cipher-algo AES256 --compress-algo 1 --symmetric --output "$dump_file.gpg" "$dump_file"
        rm "$dump_file"
        dump_file="$dump_file.gpg"
    fi
    
    log_success "Database backup completed: $(basename "$dump_file")"
}

# Backup Redis data
backup_redis() {
    local backup_dir="$1"
    
    log_info "Creating Redis backup..."
    
    cd "$PROJECT_ROOT"
    
    # Create Redis backup
    docker-compose exec -T redis redis-cli --rdb /data/backup.rdb BGSAVE
    
    # Wait for background save to complete
    while [[ "$(docker-compose exec -T redis redis-cli LASTSAVE)" == "$(docker-compose exec -T redis redis-cli LASTSAVE)" ]]; do
        sleep 1
    done
    
    # Copy RDB file
    docker cp "$(docker-compose ps -q redis):/data/dump.rdb" "$backup_dir/database/redis_$(date +%Y%m%d_%H%M%S).rdb"
    
    # Export Redis configuration
    docker-compose exec -T redis cat /usr/local/etc/redis/redis.conf > "$backup_dir/database/redis.conf" 2>/dev/null || true
    
    log_success "Redis backup completed"
}

# Backup configuration files
backup_config() {
    local backup_dir="$1"
    
    log_info "Creating configuration backup..."
    
    # Copy configuration files
    cp -r "$PROJECT_ROOT/docker" "$backup_dir/config/"
    cp "$PROJECT_ROOT/.env" "$backup_dir/config/" 2>/dev/null || true
    cp "$PROJECT_ROOT/docker-compose.yml" "$backup_dir/config/"
    
    # Copy SSL certificates
    if [[ -d "$PROJECT_ROOT/docker/nginx/ssl" ]]; then
        cp -r "$PROJECT_ROOT/docker/nginx/ssl" "$backup_dir/config/"
    fi
    
    # Create configuration inventory
    cat > "$backup_dir/config/inventory.txt" <<EOF
Configuration Backup Inventory
Created: $(date)
System: Radiology AI Medical Processing System

Files included:
- Docker Compose configuration
- Environment variables (.env)
- Nginx configuration
- PostgreSQL configuration
- Redis configuration  
- Prometheus configuration
- Grafana configuration
- Loki/Promtail configuration
- SSL certificates and keys

Total files: $(find "$backup_dir/config" -type f | wc -l)
Total size: $(du -sh "$backup_dir/config" | cut -f1)
EOF
    
    log_success "Configuration backup completed"
}

# Backup logs
backup_logs() {
    local backup_dir="$1"
    local compress="$2"
    
    log_info "Creating logs backup..."
    
    # Copy application logs
    if [[ -d "$PROJECT_ROOT/logs" ]]; then
        cp -r "$PROJECT_ROOT/logs" "$backup_dir/"
    fi
    
    # Export container logs
    cd "$PROJECT_ROOT"
    local services=$(docker-compose ps --services 2>/dev/null || true)
    
    if [[ -n "$services" ]]; then
        while IFS= read -r service; do
            if docker-compose ps "$service" | grep -q "Up"; then
                log_info "Exporting logs for $service..."
                docker-compose logs --no-color "$service" > "$backup_dir/logs/container_${service}_$(date +%Y%m%d_%H%M%S).log" 2>/dev/null || true
            fi
        done <<< "$services"
    fi
    
    # Create logs inventory
    cat > "$backup_dir/logs/inventory.txt" <<EOF
Logs Backup Inventory
Created: $(date)

Log Categories:
- Application logs (nginx, backend, services)
- Container logs (Docker Compose services)
- System logs (if accessible)
- Medical audit logs

Total log files: $(find "$backup_dir/logs" -name "*.log" | wc -l)
Date range: $(find "$backup_dir/logs" -name "*.log" -exec ls -lt {} \; | tail -1 | awk '{print $6, $7, $8}') to $(date)
EOF
    
    if [[ "$compress" == "true" ]]; then
        log_info "Compressing log files..."
        find "$backup_dir/logs" -name "*.log" -exec gzip {} \;
    fi
    
    log_success "Logs backup completed"
}

# Backup Docker volumes
backup_volumes() {
    local backup_dir="$1"
    
    log_info "Creating volumes backup..."
    
    cd "$PROJECT_ROOT"
    
    # Create data directories backup
    if [[ -d "$PROJECT_ROOT/data" ]]; then
        tar -czf "$backup_dir/volumes/data_$(date +%Y%m%d_%H%M%S).tar.gz" -C "$PROJECT_ROOT" data/
    fi
    
    # Backup Docker volumes
    local volumes=$(docker volume ls --filter "label=com.docker.compose.project=radiology-ai-system" --format "{{.Name}}" 2>/dev/null || true)
    
    if [[ -n "$volumes" ]]; then
        while IFS= read -r volume; do
            log_info "Backing up volume: $volume"
            docker run --rm -v "$volume":/volume -v "$backup_dir/volumes":/backup alpine \
                tar -czf "/backup/${volume}_$(date +%Y%m%d_%H%M%S).tar.gz" -C /volume . || true
        done <<< "$volumes"
    fi
    
    log_success "Volumes backup completed"
}

# Backup medical audit logs
backup_medical() {
    local backup_dir="$1"
    local encrypt="$2"
    
    log_info "Creating medical/audit logs backup..."
    
    # Copy medical audit logs (if they exist)
    if [[ -d "$PROJECT_ROOT/logs/medical-audit" ]]; then
        cp -r "$PROJECT_ROOT/logs/medical-audit" "$backup_dir/medical/"
    fi
    
    # Export medical data compliance information
    cd "$PROJECT_ROOT"
    
    # Database medical data summary
    if docker-compose exec -T postgres pg_isready -U meduser -d radiology_db &> /dev/null; then
        docker-compose exec -T postgres psql -U meduser -d radiology_db -c "
            SELECT 'Medical procedures', COUNT(*) FROM procedures;
            SELECT 'Patient records', COUNT(*) FROM patients;
            SELECT 'Reports generated', COUNT(*) FROM reports;
            SELECT 'Transcriptions processed', COUNT(*) FROM transcriptions;
        " > "$backup_dir/medical/medical_data_summary.txt" 2>/dev/null || true
    fi
    
    # Create medical compliance manifest
    cat > "$backup_dir/medical/compliance_manifest.txt" <<EOF
Medical Data Backup Compliance Manifest
Generated: $(date)
System: Radiology AI Medical Processing System
Compliance: German Medical Device Regulation (MDR), GDPR

Data Categories Backed Up:
1. Medical procedure records
2. Patient transcription data (anonymized)  
3. Generated medical reports
4. User access audit logs
5. System security logs
6. Data processing audit trail

Retention Period: 30 years (German medical law requirement)
Encryption: $(if [[ "$encrypt" == "true" ]]; then echo "AES-256 encryption applied"; else echo "No encryption applied"; fi)
Access Control: Restricted to authorized medical personnel only

Data Protection Officer: [TO BE FILLED]
Backup Administrator: $(whoami)
Backup Location: $(realpath "$backup_dir")
EOF
    
    # Encrypt medical data if requested
    if [[ "$encrypt" == "true" ]]; then
        log_info "Encrypting medical data backup..."
        
        find "$backup_dir/medical" -type f \( -name "*.txt" -o -name "*.log" -o -name "*.json" \) | while read -r file; do
            gpg --cipher-algo AES256 --compress-algo 1 --symmetric --output "$file.gpg" "$file"
            rm "$file"
        done
    fi
    
    log_success "Medical/audit backup completed"
}

# Create backup metadata
create_backup_metadata() {
    local backup_dir="$1"
    local backup_type="$2"
    
    log_info "Creating backup metadata..."
    
    cat > "$backup_dir/metadata/backup_manifest.json" <<EOF
{
    "backup_info": {
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "type": "$backup_type",
        "system": "Radiology AI Medical Processing System",
        "version": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
        "backup_id": "$(basename "$backup_dir")",
        "created_by": "$(whoami)",
        "hostname": "$(hostname)"
    },
    "system_info": {
        "docker_version": "$(docker --version)",
        "docker_compose_version": "$(docker-compose --version)",
        "os_info": "$(uname -a)",
        "disk_usage": "$(df -h "$PROJECT_ROOT" | awk 'NR==2 {print $3 "/" $2 " (" $5 " used)"}')"
    },
    "backup_contents": {
        "database": $(if [[ -d "$backup_dir/database" ]]; then echo "true"; else echo "false"; fi),
        "config": $(if [[ -d "$backup_dir/config" ]]; then echo "true"; else echo "false"; fi),
        "logs": $(if [[ -d "$backup_dir/logs" ]]; then echo "true"; else echo "false"; fi),
        "volumes": $(if [[ -d "$backup_dir/volumes" ]]; then echo "true"; else echo "false"; fi),
        "medical": $(if [[ -d "$backup_dir/medical" ]]; then echo "true"; else echo "false"; fi)
    },
    "integrity": {
        "total_files": $(find "$backup_dir" -type f | wc -l),
        "total_size_bytes": $(du -sb "$backup_dir" | cut -f1),
        "checksum": "$(find "$backup_dir" -type f -exec sha256sum {} \; | sha256sum | cut -d' ' -f1)"
    }
}
EOF
    
    # Create file checksums
    find "$backup_dir" -type f -not -path "*/metadata/*" -exec sha256sum {} \; > "$backup_dir/metadata/checksums.txt"
    
    log_success "Backup metadata created"
}

# Verify backup integrity
verify_backup() {
    local backup_dir="$1"
    
    log_info "Verifying backup integrity..."
    
    # Verify checksums
    if [[ -f "$backup_dir/metadata/checksums.txt" ]]; then
        cd "$backup_dir"
        if sha256sum -c metadata/checksums.txt --quiet; then
            log_success "Backup integrity verification passed"
        else
            log_error "Backup integrity verification failed"
            return 1
        fi
    else
        log_warning "No checksums file found, skipping integrity verification"
    fi
    
    # Verify database backup if it exists
    if [[ -f "$backup_dir/database/radiology_db_"*".sql" ]]; then
        log_info "Verifying database backup..."
        local db_backup=$(ls "$backup_dir/database/radiology_db_"*".sql" | head -1)
        if head -10 "$db_backup" | grep -q "PostgreSQL database dump"; then
            log_success "Database backup verification passed"
        else
            log_error "Database backup verification failed"
            return 1
        fi
    fi
    
    return 0
}

# Upload to remote storage
upload_remote() {
    local backup_dir="$1"
    
    log_info "Uploading backup to remote storage..."
    
    # Check if S3 backup is configured
    if [[ "${S3_BACKUP_ENABLED:-false}" == "true" ]]; then
        if command -v aws &> /dev/null; then
            local backup_name=$(basename "$backup_dir")
            local s3_path="s3://${S3_BACKUP_BUCKET:-radiology-ai-backups}/medical-backups/$backup_name"
            
            aws s3 sync "$backup_dir" "$s3_path" --delete --storage-class DEEP_ARCHIVE
            log_success "Backup uploaded to S3: $s3_path"
        else
            log_error "AWS CLI not available for S3 upload"
            return 1
        fi
    else
        log_warning "Remote backup not configured"
    fi
}

# Apply retention policy
apply_retention() {
    local backup_root="$1"
    
    log_info "Applying backup retention policy..."
    
    # Remove backups older than retention periods
    find "$backup_root" -name "full_backup_*" -type d -mtime +$((BACKUP_RETENTION_YEARS * 365)) -exec rm -rf {} \; 2>/dev/null || true
    find "$backup_root" -name "*backup_*" -type d -mtime +$((BACKUP_RETENTION_MONTHS * 30)) -path "*/monthly/*" -exec rm -rf {} \; 2>/dev/null || true
    find "$backup_root" -name "*backup_*" -type d -mtime +$((BACKUP_RETENTION_WEEKS * 7)) -path "*/weekly/*" -exec rm -rf {} \; 2>/dev/null || true
    find "$backup_root" -name "*backup_*" -type d -mtime +$BACKUP_RETENTION_DAYS -path "*/daily/*" -exec rm -rf {} \; 2>/dev/null || true
    
    log_success "Retention policy applied"
}

# Main backup function
main() {
    local start_time=$(date +%s)
    
    # Parse arguments
    local args=$(parse_arguments "$@")
    IFS='|' read -r backup_type output_dir encrypt compress verify remote retention quiet <<< "$args"
    
    if [[ "$quiet" == "false" ]]; then
        log_info "Starting Radiology AI System backup..."
        log_info "Backup type: $backup_type"
        log_info "Output directory: $output_dir"
        log_info "Encryption: $encrypt"
        log_info "Compression: $compress"
    fi
    
    # Load environment
    load_environment
    
    # Create backup directory
    local backup_dir=$(create_backup_structure "$output_dir")
    
    # Perform backup based on type
    case "$backup_type" in
        "database")
            backup_database "$backup_dir" "$compress" "$encrypt"
            backup_redis "$backup_dir"
            ;;
        "config")
            backup_config "$backup_dir"
            ;;
        "logs")
            backup_logs "$backup_dir" "$compress"
            ;;
        "volumes")
            backup_volumes "$backup_dir"
            ;;
        "medical")
            backup_medical "$backup_dir" "$encrypt"
            ;;
        "full"|"all")
            backup_database "$backup_dir" "$compress" "$encrypt"
            backup_redis "$backup_dir"
            backup_config "$backup_dir"
            backup_logs "$backup_dir" "$compress"
            backup_volumes "$backup_dir"
            backup_medical "$backup_dir" "$encrypt"
            ;;
        *)
            log_error "Unknown backup type: $backup_type"
            exit 1
            ;;
    esac
    
    # Create metadata
    create_backup_metadata "$backup_dir" "$backup_type"
    
    # Verify backup if requested
    if [[ "$verify" == "true" ]]; then
        verify_backup "$backup_dir"
    fi
    
    # Upload to remote storage if requested
    if [[ "$remote" == "true" ]]; then
        upload_remote "$backup_dir"
    fi
    
    # Apply retention policy if requested
    if [[ "$retention" == "true" ]]; then
        apply_retention "$output_dir"
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local backup_size=$(du -sh "$backup_dir" | cut -f1)
    
    log_success "Backup completed successfully!"
    log_info "Backup location: $backup_dir"
    log_info "Backup size: $backup_size"
    log_info "Duration: ${duration} seconds"
    
    # Create quick access symlink
    ln -sfn "$backup_dir" "$output_dir/latest"
    
    if [[ "$quiet" == "false" ]]; then
        echo
        log_info "Backup contents:"
        ls -la "$backup_dir"
        echo
        log_info "To restore from this backup, use:"
        echo "  ./scripts/restore.sh --backup '$backup_dir'"
    fi
}

# Run main function
main "$@"