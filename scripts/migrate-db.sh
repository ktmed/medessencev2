#!/bin/bash

#==============================================================================
# Radiology AI System - Database Migration Script
# Medical-grade database schema migration with rollback capability
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

# Migration configuration
MIGRATION_DIR="$PROJECT_ROOT/database/migrations"
MIGRATION_TABLE="schema_migrations"

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
Usage: $0 [COMMAND] [OPTIONS]

Manage database migrations for the Radiology AI System with medical compliance.

Commands:
  create NAME             Create a new migration file
  migrate                 Run pending migrations (default)
  rollback [N]           Rollback last N migrations (default: 1)
  status                 Show migration status
  reset                  Reset database and run all migrations
  seed                   Run database seeding
  validate               Validate current schema
  backup                 Create migration backup before running

Options:
  --dry-run, -d          Show what would be done without executing
  --force, -f            Force execution (skip confirmations)
  --version, -v VERSION  Migrate to specific version
  --quiet, -q            Suppress non-essential output
  --help, -h             Show this help message

Examples:
  $0                                    # Run pending migrations
  $0 create add_audit_table            # Create new migration
  $0 rollback 2                        # Rollback last 2 migrations
  $0 migrate --version 20240101120000   # Migrate to specific version
  $0 reset --force                     # Reset database (destructive!)
  $0 status                            # Show current migration status
EOF
}

# Check database connection
check_database_connection() {
    log_info "Checking database connection..."
    
    cd "$PROJECT_ROOT"
    
    if ! docker-compose exec -T postgres pg_isready -U meduser -d radiology_db &> /dev/null; then
        log_error "Database is not accessible. Make sure the system is running."
        exit 1
    fi
    
    log_success "Database connection established"
}

# Initialize migration system
init_migration_system() {
    log_info "Initializing migration system..."
    
    cd "$PROJECT_ROOT"
    
    # Create migrations table if it doesn't exist
    docker-compose exec -T postgres psql -U meduser -d radiology_db -c "
        CREATE TABLE IF NOT EXISTS $MIGRATION_TABLE (
            version VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            applied_by VARCHAR(255) DEFAULT CURRENT_USER,
            execution_time_ms INTEGER,
            checksum VARCHAR(64)
        );
        
        -- Create audit table for migration tracking
        CREATE TABLE IF NOT EXISTS migration_audit (
            id SERIAL PRIMARY KEY,
            migration_version VARCHAR(255) NOT NULL,
            operation VARCHAR(20) NOT NULL CHECK (operation IN ('UP', 'DOWN')),
            executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            executed_by VARCHAR(255) DEFAULT CURRENT_USER,
            success BOOLEAN NOT NULL,
            error_message TEXT,
            execution_time_ms INTEGER
        );
    " > /dev/null
    
    log_success "Migration system initialized"
}

# Create migration directory structure
create_migration_directories() {
    mkdir -p "$MIGRATION_DIR"/{up,down,seeds,validators}
    
    # Create .gitkeep files to ensure directories are tracked
    touch "$MIGRATION_DIR"/{up,down,seeds,validators}/.gitkeep
}

# Get next migration version
get_next_version() {
    echo "$(date +%Y%m%d%H%M%S)"
}

# Create new migration
create_migration() {
    local migration_name="$1"
    
    if [[ -z "$migration_name" ]]; then
        log_error "Migration name is required"
        exit 1
    fi
    
    local version=$(get_next_version)
    local filename="${version}_${migration_name}"
    
    create_migration_directories
    
    # Create UP migration file
    cat > "$MIGRATION_DIR/up/${filename}.sql" <<EOF
-- Migration: ${migration_name}
-- Created: $(date)
-- Author: $(whoami)
-- Description: [Add description here]

-- WARNING: This migration affects medical data
-- Ensure compliance with German medical data regulations

BEGIN;

-- Add your migration SQL here
-- Example:
-- CREATE TABLE new_table (
--     id SERIAL PRIMARY KEY,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
-- );

-- Update schema version
INSERT INTO schema_versions (version, description, applied_at) 
VALUES ('$version', '$migration_name', CURRENT_TIMESTAMP);

COMMIT;
EOF
    
    # Create DOWN migration file
    cat > "$MIGRATION_DIR/down/${filename}.sql" <<EOF
-- Rollback Migration: ${migration_name}
-- Created: $(date)
-- Author: $(whoami)
-- Description: Rollback for migration $version

-- WARNING: This rollback affects medical data
-- Ensure data integrity and compliance requirements

BEGIN;

-- Add your rollback SQL here
-- This should undo everything from the UP migration
-- Example:
-- DROP TABLE IF EXISTS new_table;

-- Remove schema version
DELETE FROM schema_versions WHERE version = '$version';

COMMIT;
EOF
    
    log_success "Migration created:"
    log_info "  UP:   $MIGRATION_DIR/up/${filename}.sql"
    log_info "  DOWN: $MIGRATION_DIR/down/${filename}.sql"
    log_warning "Please edit the migration files before running migrate command"
}

# Get pending migrations
get_pending_migrations() {
    local applied_migrations_file=$(mktemp)
    local all_migrations_file=$(mktemp)
    
    cd "$PROJECT_ROOT"
    
    # Get applied migrations
    docker-compose exec -T postgres psql -U meduser -d radiology_db -t -c "
        SELECT version FROM $MIGRATION_TABLE ORDER BY version;
    " | grep -v '^$' | tr -d ' ' > "$applied_migrations_file" || touch "$applied_migrations_file"
    
    # Get all available migrations
    if [[ -d "$MIGRATION_DIR/up" ]]; then
        ls "$MIGRATION_DIR/up"/*.sql 2>/dev/null | sed 's/.*\/\([0-9]\{14\}\)_.*/\1/' | sort > "$all_migrations_file" || touch "$all_migrations_file"
    else
        touch "$all_migrations_file"
    fi
    
    # Find pending migrations
    comm -23 "$all_migrations_file" "$applied_migrations_file"
    
    # Cleanup
    rm -f "$applied_migrations_file" "$all_migrations_file"
}

# Run single migration
run_migration() {
    local version="$1"
    local dry_run="$2"
    
    local migration_file="$MIGRATION_DIR/up/${version}_*.sql"
    local migration_path=$(ls $migration_file 2>/dev/null | head -1)
    
    if [[ ! -f "$migration_path" ]]; then
        log_error "Migration file not found for version: $version"
        return 1
    fi
    
    local start_time=$(date +%s%3N)
    
    log_info "Running migration: $(basename "$migration_path")"
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "DRY RUN - Would execute:"
        cat "$migration_path"
        return 0
    fi
    
    cd "$PROJECT_ROOT"
    
    # Calculate checksum
    local checksum=$(sha256sum "$migration_path" | cut -d' ' -f1)
    
    # Run migration with error handling
    local success=true
    local error_message=""
    
    if ! docker-compose exec -T postgres psql -U meduser -d radiology_db -f- < "$migration_path"; then
        success=false
        error_message="Migration execution failed"
        log_error "$error_message"
    else
        # Record successful migration
        local end_time=$(date +%s%3N)
        local execution_time=$((end_time - start_time))
        
        docker-compose exec -T postgres psql -U meduser -d radiology_db -c "
            INSERT INTO $MIGRATION_TABLE (version, execution_time_ms, checksum)
            VALUES ('$version', $execution_time, '$checksum');
        " > /dev/null
        
        log_success "Migration completed in ${execution_time}ms"
    fi
    
    # Record audit entry
    docker-compose exec -T postgres psql -U meduser -d radiology_db -c "
        INSERT INTO migration_audit (migration_version, operation, success, error_message, execution_time_ms)
        VALUES ('$version', 'UP', $success, $(if [[ -n "$error_message" ]]; then echo "'$error_message'"; else echo "NULL"; fi), $((end_time - start_time)));
    " > /dev/null || true
    
    if [[ "$success" == "false" ]]; then
        return 1
    fi
}

# Run rollback migration
run_rollback() {
    local version="$1"
    local dry_run="$2"
    
    local migration_file="$MIGRATION_DIR/down/${version}_*.sql"
    local migration_path=$(ls $migration_file 2>/dev/null | head -1)
    
    if [[ ! -f "$migration_path" ]]; then
        log_error "Rollback file not found for version: $version"
        return 1
    fi
    
    local start_time=$(date +%s%3N)
    
    log_info "Rolling back migration: $(basename "$migration_path")"
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "DRY RUN - Would execute:"
        cat "$migration_path"
        return 0
    fi
    
    cd "$PROJECT_ROOT"
    
    # Run rollback with error handling
    local success=true
    local error_message=""
    
    if ! docker-compose exec -T postgres psql -U meduser -d radiology_db -f- < "$migration_path"; then
        success=false
        error_message="Rollback execution failed"
        log_error "$error_message"
    else
        # Remove migration record
        docker-compose exec -T postgres psql -U meduser -d radiology_db -c "
            DELETE FROM $MIGRATION_TABLE WHERE version = '$version';
        " > /dev/null
        
        local end_time=$(date +%s%3N)
        log_success "Rollback completed in $((end_time - start_time))ms"
    fi
    
    # Record audit entry
    local end_time=$(date +%s%3N)
    docker-compose exec -T postgres psql -U meduser -d radiology_db -c "
        INSERT INTO migration_audit (migration_version, operation, success, error_message, execution_time_ms)
        VALUES ('$version', 'DOWN', $success, $(if [[ -n "$error_message" ]]; then echo "'$error_message'"; else echo "NULL"; fi), $((end_time - start_time)));
    " > /dev/null || true
    
    if [[ "$success" == "false" ]]; then
        return 1
    fi
}

# Run migrations
run_migrations() {
    local dry_run="$1"
    local target_version="$2"
    
    local pending_migrations=($(get_pending_migrations))
    
    if [[ ${#pending_migrations[@]} -eq 0 ]]; then
        log_info "No pending migrations found"
        return 0
    fi
    
    # Filter migrations up to target version if specified
    if [[ -n "$target_version" ]]; then
        local filtered_migrations=()
        for migration in "${pending_migrations[@]}"; do
            if [[ "$migration" <= "$target_version" ]]; then
                filtered_migrations+=("$migration")
            fi
        done
        pending_migrations=("${filtered_migrations[@]}")
    fi
    
    log_info "Found ${#pending_migrations[@]} pending migration(s)"
    
    # Create backup before migrations
    if [[ "$dry_run" == "false" ]]; then
        log_info "Creating pre-migration backup..."
        "$SCRIPT_DIR/backup.sh" --type database --quiet
    fi
    
    # Run each migration
    for version in "${pending_migrations[@]}"; do
        if ! run_migration "$version" "$dry_run"; then
            log_error "Migration failed: $version"
            exit 1
        fi
    done
    
    if [[ "$dry_run" == "false" ]]; then
        log_success "All migrations completed successfully"
    else
        log_info "DRY RUN completed - no changes made"
    fi
}

# Rollback migrations
rollback_migrations() {
    local count="$1"
    local dry_run="$2"
    local force="$3"
    
    cd "$PROJECT_ROOT"
    
    # Get applied migrations in reverse order
    local applied_migrations=($(docker-compose exec -T postgres psql -U meduser -d radiology_db -t -c "
        SELECT version FROM $MIGRATION_TABLE ORDER BY version DESC LIMIT $count;
    " | grep -v '^$' | tr -d ' '))
    
    if [[ ${#applied_migrations[@]} -eq 0 ]]; then
        log_info "No migrations to rollback"
        return 0
    fi
    
    log_warning "About to rollback ${#applied_migrations[@]} migration(s):"
    for version in "${applied_migrations[@]}"; do
        echo "  - $version"
    done
    
    if [[ "$force" == "false" && "$dry_run" == "false" ]]; then
        echo
        read -p "Are you sure you want to proceed? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Rollback cancelled"
            return 0
        fi
    fi
    
    # Create backup before rollback
    if [[ "$dry_run" == "false" ]]; then
        log_info "Creating pre-rollback backup..."
        "$SCRIPT_DIR/backup.sh" --type database --quiet
    fi
    
    # Run rollbacks
    for version in "${applied_migrations[@]}"; do
        if ! run_rollback "$version" "$dry_run"; then
            log_error "Rollback failed: $version"
            exit 1
        fi
    done
    
    if [[ "$dry_run" == "false" ]]; then
        log_success "Rollback completed successfully"
    else
        log_info "DRY RUN completed - no changes made"
    fi
}

# Show migration status
show_status() {
    log_info "Migration Status:"
    echo
    
    cd "$PROJECT_ROOT"
    
    # Show applied migrations
    log_info "Applied Migrations:"
    docker-compose exec -T postgres psql -U meduser -d radiology_db -c "
        SELECT 
            version,
            applied_at,
            applied_by,
            execution_time_ms || 'ms' as duration
        FROM $MIGRATION_TABLE 
        ORDER BY version;
    " 2>/dev/null || echo "No applied migrations found"
    
    echo
    
    # Show pending migrations
    local pending_migrations=($(get_pending_migrations))
    log_info "Pending Migrations:"
    if [[ ${#pending_migrations[@]} -eq 0 ]]; then
        echo "  None"
    else
        for migration in "${pending_migrations[@]}"; do
            echo "  - $migration"
        done
    fi
    
    echo
    
    # Show recent migration activity
    log_info "Recent Migration Activity:"
    docker-compose exec -T postgres psql -U meduser -d radiology_db -c "
        SELECT 
            migration_version,
            operation,
            executed_at,
            success,
            execution_time_ms || 'ms' as duration
        FROM migration_audit 
        ORDER BY executed_at DESC 
        LIMIT 10;
    " 2>/dev/null || echo "No migration activity found"
}

# Reset database
reset_database() {
    local force="$1"
    local dry_run="$2"
    
    log_warning "WARNING: This will destroy all data and reset the database!"
    
    if [[ "$force" == "false" && "$dry_run" == "false" ]]; then
        echo
        read -p "Are you absolutely sure? Type 'RESET' to confirm: " -r
        echo
        if [[ "$REPLY" != "RESET" ]]; then
            log_info "Reset cancelled"
            return 0
        fi
    fi
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "DRY RUN - Would reset database and run all migrations"
        return 0
    fi
    
    # Create backup before reset
    log_info "Creating pre-reset backup..."
    "$SCRIPT_DIR/backup.sh" --type database --quiet
    
    cd "$PROJECT_ROOT"
    
    # Drop and recreate database
    log_info "Resetting database..."
    docker-compose exec -T postgres psql -U meduser -d postgres -c "
        DROP DATABASE IF EXISTS radiology_db;
        CREATE DATABASE radiology_db OWNER meduser;
    "
    
    # Run initialization script
    if [[ -f "$PROJECT_ROOT/database/init.sql" ]]; then
        log_info "Running database initialization..."
        docker-compose exec -T postgres psql -U meduser -d radiology_db -f- < "$PROJECT_ROOT/database/init.sql"
    fi
    
    # Initialize migration system
    init_migration_system
    
    # Run all migrations
    log_info "Running all migrations..."
    run_migrations "false" ""
    
    log_success "Database reset completed"
}

# Seed database
seed_database() {
    local dry_run="$1"
    
    log_info "Seeding database..."
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "DRY RUN - Would run database seeds"
        return 0
    fi
    
    # Run seed files
    if [[ -d "$MIGRATION_DIR/seeds" ]]; then
        for seed_file in "$MIGRATION_DIR/seeds"/*.sql; do
            if [[ -f "$seed_file" ]]; then
                log_info "Running seed: $(basename "$seed_file")"
                cd "$PROJECT_ROOT"
                docker-compose exec -T postgres psql -U meduser -d radiology_db -f- < "$seed_file"
            fi
        done
    fi
    
    # Run application-specific seeding
    if [[ -f "$PROJECT_ROOT/backend/prisma/seed.js" ]]; then
        log_info "Running Prisma seeds..."
        cd "$PROJECT_ROOT"
        docker-compose exec -T backend npm run seed
    fi
    
    log_success "Database seeding completed"
}

# Validate schema
validate_schema() {
    log_info "Validating database schema..."
    
    cd "$PROJECT_ROOT"
    
    # Run validation queries
    local validation_results=""
    
    # Check for orphaned records, inconsistent data, etc.
    validation_results+=$(docker-compose exec -T postgres psql -U meduser -d radiology_db -t -c "
        -- Check for basic schema integrity
        SELECT 'Schema validation results:';
        SELECT 'Tables count: ' || count(*) FROM information_schema.tables WHERE table_schema = 'public';
        SELECT 'Views count: ' || count(*) FROM information_schema.views WHERE table_schema = 'public';
        SELECT 'Indexes count: ' || count(*) FROM pg_indexes WHERE schemaname = 'public';
    " 2>/dev/null || echo "Schema validation failed")
    
    echo "$validation_results"
    
    # Run custom validators
    if [[ -d "$MIGRATION_DIR/validators" ]]; then
        for validator_file in "$MIGRATION_DIR/validators"/*.sql; do
            if [[ -f "$validator_file" ]]; then
                log_info "Running validator: $(basename "$validator_file")"
                docker-compose exec -T postgres psql -U meduser -d radiology_db -f- < "$validator_file"
            fi
        done
    fi
    
    log_success "Schema validation completed"
}

# Main function
main() {
    local command="migrate"
    local dry_run=false
    local force=false
    local target_version=""
    local quiet=false
    local rollback_count=1
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            create)
                command="create"
                shift
                if [[ $# -gt 0 ]]; then
                    migration_name="$1"
                    shift
                fi
                ;;
            migrate)
                command="migrate"
                shift
                ;;
            rollback)
                command="rollback"
                shift
                if [[ $# -gt 0 && "$1" =~ ^[0-9]+$ ]]; then
                    rollback_count="$1"
                    shift
                fi
                ;;
            status)
                command="status"
                shift
                ;;
            reset)
                command="reset"
                shift
                ;;
            seed)
                command="seed"
                shift
                ;;
            validate)
                command="validate"
                shift
                ;;
            backup)
                command="backup"
                shift
                ;;
            --dry-run|-d)
                dry_run=true
                shift
                ;;
            --force|-f)
                force=true
                shift
                ;;
            --version|-v)
                target_version="$2"
                shift 2
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
    
    if [[ "$quiet" == "false" ]]; then
        log_info "Starting database migration command: $command"
    fi
    
    # Load environment
    load_environment
    
    # Check database connection for most commands
    if [[ "$command" != "create" ]]; then
        check_database_connection
        init_migration_system
    fi
    
    # Execute command
    case "$command" in
        "create")
            create_migration "${migration_name:-}"
            ;;
        "migrate")
            run_migrations "$dry_run" "$target_version"
            ;;
        "rollback")
            rollback_migrations "$rollback_count" "$dry_run" "$force"
            ;;
        "status")
            show_status
            ;;
        "reset")
            reset_database "$force" "$dry_run"
            ;;
        "seed")
            seed_database "$dry_run"
            ;;
        "validate")
            validate_schema
            ;;
        "backup")
            "$SCRIPT_DIR/backup.sh" --type database
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
    
    if [[ "$quiet" == "false" ]]; then
        log_success "Database migration command completed: $command"
    fi
}

# Run main function
main "$@"