#!/bin/bash

# =============================================================================
# MedEssenceAI Production Backup Script
# =============================================================================

set -euo pipefail

# Color codes
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
readonly BACKUP_DIR="$PROJECT_ROOT/backups/backup_$BACKUP_DATE"
readonly LOG_FILE="$PROJECT_ROOT/logs/backup_$BACKUP_DATE.log"
readonly ENV_FILE="$PROJECT_ROOT/.env.production"

# Create directories
mkdir -p "$PROJECT_ROOT/backups" "$PROJECT_ROOT/logs"

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
    
    case $level in
        ERROR) echo -e "${RED}❌ ${message}${NC}" ;;
        SUCCESS) echo -e "${GREEN}✅ ${message}${NC}" ;;
        WARNING) echo -e "${YELLOW}⚠️  ${message}${NC}" ;;
        INFO) echo -e "${BLUE}ℹ️  ${message}${NC}" ;;
    esac
}

# Load environment variables
load_env() {
    if [[ -f "$ENV_FILE" ]]; then
        set -a
        source "$ENV_FILE"
        set +a
    else
        log "WARNING" "Environment file not found: $ENV_FILE"
    fi
}

# Create backup directory
create_backup_dir() {
    log "INFO" "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
}

# Backup PostgreSQL database
backup_postgres() {
    log "INFO" "Starting PostgreSQL database backup..."
    
    local db_backup_file="$BACKUP_DIR/postgres_dump.sql"
    local db_container="medessenceai-production_postgres_1"
    
    # Try different container name patterns
    for pattern in "medessenceai-production_postgres_1" "medessenceai-production-postgres-1" "*postgres*"; do
        local container=$(docker ps --format "table {{.Names}}" | grep -i postgres | head -1 || true)
        if [[ -n "$container" ]]; then
            db_container="$container"
            break
        fi
    done
    
    if docker ps --format "{{.Names}}" | grep -q "$db_container"; then
        if docker exec "$db_container" pg_dump -U "${POSTGRES_USER:-medessenceai_user}" -d "${POSTGRES_DB:-medessenceai_production}" > "$db_backup_file"; then
            log "SUCCESS" "PostgreSQL backup completed: $(du -h "$db_backup_file" | cut -f1)"
        else
            log "ERROR" "PostgreSQL backup failed"
            return 1
        fi
    else
        log "WARNING" "PostgreSQL container not found or not running"
    fi
}

# Backup Redis data
backup_redis() {
    log "INFO" "Starting Redis data backup..."
    
    local redis_backup_file="$BACKUP_DIR/redis_dump.rdb"
    local redis_container="medessenceai-production_redis_1"
    
    # Try different container name patterns
    for pattern in "medessenceai-production_redis_1" "medessenceai-production-redis-1" "*redis*"; do
        local container=$(docker ps --format "table {{.Names}}" | grep -i redis | head -1 || true)
        if [[ -n "$container" ]]; then
            redis_container="$container"
            break
        fi
    done
    
    if docker ps --format "{{.Names}}" | grep -q "$redis_container"; then
        # Create Redis backup
        docker exec "$redis_container" redis-cli --rdb /data/backup.rdb &> /dev/null || true
        
        # Copy backup file
        if docker cp "$redis_container:/data/dump.rdb" "$redis_backup_file"; then
            log "SUCCESS" "Redis backup completed: $(du -h "$redis_backup_file" | cut -f1)"
        else
            log "ERROR" "Redis backup failed"
            return 1
        fi
    else
        log "WARNING" "Redis container not found or not running"
    fi
}

# Backup application data
backup_app_data() {
    log "INFO" "Starting application data backup..."
    
    local app_data_dir="$BACKUP_DIR/app_data"
    mkdir -p "$app_data_dir"
    
    # Backup medical dictionaries
    if [[ -d "$PROJECT_ROOT/data/medical_dictionaries" ]]; then
        cp -r "$PROJECT_ROOT/data/medical_dictionaries" "$app_data_dir/"
        log "SUCCESS" "Medical dictionaries backed up"
    fi
    
    # Backup logs (last 7 days)
    if [[ -d "$PROJECT_ROOT/logs" ]]; then
        find "$PROJECT_ROOT/logs" -name "*.log" -mtime -7 -exec cp {} "$app_data_dir/" \;
        log "SUCCESS" "Recent logs backed up"
    fi
    
    # Backup configuration files
    local config_files=(
        ".env.production"
        "docker-compose.production.yml"
        "docker-compose.yml"
    )
    
    for file in "${config_files[@]}"; do
        if [[ -f "$PROJECT_ROOT/$file" ]]; then
            cp "$PROJECT_ROOT/$file" "$app_data_dir/"
        fi
    done
    
    log "SUCCESS" "Application data backup completed"
}

# Backup SSL certificates
backup_ssl() {
    log "INFO" "Starting SSL certificates backup..."
    
    local ssl_backup_dir="$BACKUP_DIR/ssl"
    
    if [[ -n "${SSL_CERT_PATH:-}" ]] && [[ -f "$SSL_CERT_PATH" ]]; then
        mkdir -p "$ssl_backup_dir"
        cp "$SSL_CERT_PATH" "$ssl_backup_dir/"
        
        if [[ -n "${SSL_KEY_PATH:-}" ]] && [[ -f "$SSL_KEY_PATH" ]]; then
            cp "$SSL_KEY_PATH" "$ssl_backup_dir/"
        fi
        
        log "SUCCESS" "SSL certificates backed up"
    else
        log "INFO" "No SSL certificates to backup"
    fi
}

# Create backup manifest
create_manifest() {
    log "INFO" "Creating backup manifest..."
    
    local manifest_file="$BACKUP_DIR/backup_manifest.txt"
    
    cat > "$manifest_file" << EOF
MedEssenceAI Backup Manifest
============================
Backup Date: $BACKUP_DATE
Backup Directory: $BACKUP_DIR
Hostname: $(hostname)
User: $(whoami)

Backup Contents:
EOF
    
    find "$BACKUP_DIR" -type f -exec basename {} \; | sort >> "$manifest_file"
    
    # Add file sizes
    echo "" >> "$manifest_file"
    echo "File Sizes:" >> "$manifest_file"
    find "$BACKUP_DIR" -type f -exec du -h {} \; | sort >> "$manifest_file"
    
    # Add total size
    echo "" >> "$manifest_file"
    echo "Total Backup Size: $(du -sh "$BACKUP_DIR" | cut -f1)" >> "$manifest_file"
    
    log "SUCCESS" "Backup manifest created"
}

# Compress backup
compress_backup() {
    log "INFO" "Compressing backup..."
    
    local compressed_file="$PROJECT_ROOT/backups/medessenceai_backup_$BACKUP_DATE.tar.gz"
    
    if tar -czf "$compressed_file" -C "$PROJECT_ROOT/backups" "backup_$BACKUP_DATE"; then
        local compressed_size=$(du -h "$compressed_file" | cut -f1)
        log "SUCCESS" "Backup compressed: $compressed_file ($compressed_size)"
        
        # Remove uncompressed backup directory
        rm -rf "$BACKUP_DIR"
        
        echo "$compressed_file" > "$PROJECT_ROOT/backups/latest_backup.txt"
    else
        log "ERROR" "Backup compression failed"
        return 1
    fi
}

# Upload to cloud (if configured)
upload_to_cloud() {
    if [[ -n "${AWS_ACCESS_KEY_ID:-}" ]] && [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
        log "INFO" "Uploading backup to AWS S3..."
        
        local compressed_file="$PROJECT_ROOT/backups/medessenceai_backup_$BACKUP_DATE.tar.gz"
        local s3_key="backups/medessenceai_backup_$BACKUP_DATE.tar.gz"
        
        if command -v aws &> /dev/null; then
            if aws s3 cp "$compressed_file" "s3://${BACKUP_S3_BUCKET}/$s3_key"; then
                log "SUCCESS" "Backup uploaded to S3: s3://${BACKUP_S3_BUCKET}/$s3_key"
            else
                log "ERROR" "Failed to upload backup to S3"
            fi
        else
            log "WARNING" "AWS CLI not installed, skipping S3 upload"
        fi
    else
        log "INFO" "Cloud backup not configured"
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log "INFO" "Cleaning up old backups..."
    
    local retention_days=${BACKUP_RETENTION_DAYS:-30}
    
    # Remove local backups older than retention period
    find "$PROJECT_ROOT/backups" -name "medessenceai_backup_*.tar.gz" -mtime +$retention_days -delete || true
    
    # Remove old backup logs
    find "$PROJECT_ROOT/logs" -name "backup_*.log" -mtime +$retention_days -delete || true
    
    log "SUCCESS" "Old backups cleaned up (retention: $retention_days days)"
}

# Send notification (if configured)
send_notification() {
    local status=$1
    local message=$2
    
    if [[ -n "${ALERT_EMAIL_TO:-}" ]] && [[ -n "${SMTP_HOST:-}" ]]; then
        log "INFO" "Sending backup notification..."
        
        # This would require a mail client or API call
        # Implementation depends on your notification system
        log "INFO" "Notification configured but implementation needed"
    fi
}

# Main backup function
main() {
    local exit_code=0
    
    log "INFO" "🔄 Starting MedEssenceAI system backup..."
    log "INFO" "Backup timestamp: $BACKUP_DATE"
    
    # Load environment
    load_env
    
    # Create backup directory
    create_backup_dir
    
    # Perform backups
    backup_postgres || exit_code=1
    backup_redis || exit_code=1
    backup_app_data || exit_code=1
    backup_ssl || exit_code=1
    
    # Create manifest
    create_manifest
    
    if [[ $exit_code -eq 0 ]]; then
        # Compress and upload
        compress_backup || exit_code=1
        upload_to_cloud || exit_code=1
        
        # Cleanup
        cleanup_old_backups
        
        log "SUCCESS" "🎉 System backup completed successfully!"
        send_notification "SUCCESS" "MedEssenceAI backup completed successfully"
    else
        log "ERROR" "❌ System backup completed with errors!"
        send_notification "ERROR" "MedEssenceAI backup completed with errors"
    fi
    
    log "INFO" "Backup log: $LOG_FILE"
    
    return $exit_code
}

# Trap errors
trap 'log "ERROR" "Backup script failed at line $LINENO"' ERR

# Run main function
main "$@"