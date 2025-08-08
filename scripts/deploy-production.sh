#!/bin/bash

# =============================================================================
# MedEssenceAI Production Deployment Script
# =============================================================================

set -euo pipefail

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly LOG_FILE="$PROJECT_ROOT/logs/deployment-$(date +%Y%m%d-%H%M%S).log"
readonly COMPOSE_FILE="docker-compose.production.yml"
readonly ENV_FILE=".env.production"

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/logs"

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

# Error handling
error_exit() {
    log "ERROR" "$1"
    exit 1
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error_exit "This script should not be run as root for security reasons"
    fi
}

# Check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error_exit "Docker is not installed. Please install Docker first."
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error_exit "Docker Compose is not installed. Please install Docker Compose first."
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        error_exit "Docker daemon is not running. Please start Docker first."
    fi
    
    # Check environment file
    if [[ ! -f "$PROJECT_ROOT/$ENV_FILE" ]]; then
        log "WARNING" "Production environment file not found. Copying from example..."
        if [[ -f "$PROJECT_ROOT/.env.production.example" ]]; then
            cp "$PROJECT_ROOT/.env.production.example" "$PROJECT_ROOT/$ENV_FILE"
            log "WARNING" "Please edit $ENV_FILE with your actual configuration before proceeding."
            exit 1
        else
            error_exit "No environment configuration found."
        fi
    fi
    
    log "SUCCESS" "Prerequisites check completed"
}

# Validate environment configuration
validate_env() {
    log "INFO" "Validating environment configuration..."
    
    # Source environment file
    set -a
    source "$PROJECT_ROOT/$ENV_FILE"
    set +a
    
    # Required variables
    local required_vars=(
        "OPENAI_API_KEY"
        "ANTHROPIC_API_KEY"
        "GOOGLE_API_KEY"
        "POSTGRES_PASSWORD"
        "REDIS_PASSWORD"
        "DOMAIN_NAME"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]] || [[ "${!var}" == *"your-"* ]] || [[ "${!var}" == *"CHANGE_THIS"* ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log "ERROR" "Missing or placeholder values for required variables:"
        for var in "${missing_vars[@]}"; do
            log "ERROR" "  - $var"
        done
        error_exit "Please update $ENV_FILE with actual values"
    fi
    
    log "SUCCESS" "Environment validation completed"
}

# Create necessary directories and files
setup_directories() {
    log "INFO" "Setting up directories and permissions..."
    
    local dirs=(
        "$PROJECT_ROOT/logs"
        "$PROJECT_ROOT/data/uploads"
        "$PROJECT_ROOT/data/exports"
        "$PROJECT_ROOT/database/backups"
        "$PROJECT_ROOT/ssl"
    )
    
    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
        chmod 755 "$dir"
    done
    
    log "SUCCESS" "Directory setup completed"
}

# Check SSL certificates
check_ssl() {
    log "INFO" "Checking SSL certificates..."
    
    if [[ -n "${SSL_CERT_PATH:-}" ]] && [[ -n "${SSL_KEY_PATH:-}" ]]; then
        if [[ ! -f "$SSL_CERT_PATH" ]] || [[ ! -f "$SSL_KEY_PATH" ]]; then
            log "WARNING" "SSL certificates not found. HTTPS will not be available."
            log "WARNING" "Certificate: $SSL_CERT_PATH"
            log "WARNING" "Private key: $SSL_KEY_PATH"
            
            read -p "Continue without SSL? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                error_exit "Deployment cancelled"
            fi
        else
            log "SUCCESS" "SSL certificates found"
        fi
    else
        log "WARNING" "SSL not configured. Application will run in HTTP mode only."
    fi
}

# Pull latest images
pull_images() {
    log "INFO" "Pulling latest Docker images..."
    
    cd "$PROJECT_ROOT"
    
    if docker-compose -f "$COMPOSE_FILE" pull; then
        log "SUCCESS" "Images pulled successfully"
    else
        error_exit "Failed to pull Docker images"
    fi
}

# Build custom images
build_images() {
    log "INFO" "Building custom Docker images..."
    
    cd "$PROJECT_ROOT"
    
    if docker-compose -f "$COMPOSE_FILE" build --no-cache; then
        log "SUCCESS" "Images built successfully"
    else
        error_exit "Failed to build Docker images"
    fi
}

# Health check function
health_check() {
    log "INFO" "Performing health checks..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        log "INFO" "Health check attempt $attempt/$max_attempts..."
        
        # Check if services are running
        if docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
            # Check specific endpoints
            if curl -f -s "http://localhost:8080/health" > /dev/null 2>&1; then
                log "SUCCESS" "Health checks passed"
                return 0
            fi
        fi
        
        sleep 10
        ((attempt++))
    done
    
    log "ERROR" "Health checks failed after $max_attempts attempts"
    return 1
}

# Deploy services
deploy_services() {
    log "INFO" "Deploying services..."
    
    cd "$PROJECT_ROOT"
    
    # Start services
    if docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d; then
        log "SUCCESS" "Services started successfully"
    else
        error_exit "Failed to start services"
    fi
    
    # Wait for services to be ready
    sleep 10
    
    # Perform health checks
    if health_check; then
        log "SUCCESS" "Deployment successful"
    else
        log "ERROR" "Deployment failed health checks"
        show_logs
        error_exit "Deployment failed"
    fi
}

# Show service logs
show_logs() {
    log "INFO" "Showing service logs..."
    docker-compose -f "$COMPOSE_FILE" logs --tail=50
}

# Main deployment function
main() {
    log "INFO" "Starting MedEssenceAI production deployment..."
    log "INFO" "Deployment log: $LOG_FILE"
    
    cd "$PROJECT_ROOT"
    
    # Run all checks and deployment steps
    check_root
    check_prerequisites
    validate_env
    setup_directories
    check_ssl
    pull_images
    build_images
    deploy_services
    
    log "SUCCESS" "🎉 MedEssenceAI deployed successfully!"
    log "INFO" "Application URL: https://${DOMAIN_NAME:-localhost}"
    log "INFO" "Health endpoint: https://${DOMAIN_NAME:-localhost}/health"
    log "INFO" "Monitoring: https://${DOMAIN_NAME:-localhost}:3001 (Grafana)"
    
    echo
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  MedEssenceAI Production Deployment${NC}"
    echo -e "${GREEN}           🏥 SUCCESSFUL 🏥${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo
    echo -e "📊 Monitor services: ${BLUE}docker-compose -f $COMPOSE_FILE logs -f${NC}"
    echo -e "📈 View metrics: ${BLUE}docker-compose -f $COMPOSE_FILE exec prometheus prometheus --version${NC}"
    echo -e "🛑 Stop services: ${BLUE}docker-compose -f $COMPOSE_FILE down${NC}"
    echo
}

# Trap errors
trap 'error_exit "Deployment failed at line $LINENO"' ERR

# Run main function
main "$@"