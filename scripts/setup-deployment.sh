#!/bin/bash

#==============================================================================
# Radiology AI System - Production Deployment Setup Script
# German Medical Environment Deployment
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

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "This script should not be run as root for security reasons"
        exit 1
    fi
}

# Check system requirements
check_requirements() {
    log_info "Checking system requirements..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check minimum Docker version
    DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "0.0.0")
    REQUIRED_DOCKER_VERSION="20.10.0"
    if ! printf '%s\n%s\n' "$REQUIRED_DOCKER_VERSION" "$DOCKER_VERSION" | sort -V -C; then
        log_error "Docker version $DOCKER_VERSION is too old. Please upgrade to $REQUIRED_DOCKER_VERSION or later."
        exit 1
    fi
    
    # Check available disk space (minimum 50GB)
    AVAILABLE_SPACE=$(df "$PROJECT_ROOT" | awk 'NR==2 {print $4}')
    REQUIRED_SPACE=52428800  # 50GB in KB
    if [[ $AVAILABLE_SPACE -lt $REQUIRED_SPACE ]]; then
        log_error "Insufficient disk space. Required: 50GB, Available: $(( AVAILABLE_SPACE / 1024 / 1024 ))GB"
        exit 1
    fi
    
    # Check available memory (minimum 8GB)
    AVAILABLE_MEMORY=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    REQUIRED_MEMORY=8388608  # 8GB in KB
    if [[ $AVAILABLE_MEMORY -lt $REQUIRED_MEMORY ]]; then
        log_warning "System has less than 8GB RAM. Performance may be degraded."
    fi
    
    log_success "System requirements check passed"
}

# Create necessary directories
create_directories() {
    log_info "Creating necessary directories..."
    
    local dirs=(
        "data/postgres"
        "data/postgres-wal"
        "data/redis"
        "data/prometheus"
        "data/grafana"
        "data/loki"
        "logs/nginx"
        "logs/medical-audit"
        "backups/postgres"
        "backups/redis"
        "backups/system"
        "docker/nginx/ssl"
        "docker/grafana/dashboards/medical"
        "docker/grafana/dashboards/infrastructure"
        "docker/grafana/dashboards/applications"
        "docker/grafana/dashboards/compliance"
    )
    
    for dir in "${dirs[@]}"; do
        mkdir -p "$PROJECT_ROOT/$dir"
        log_info "Created directory: $dir"
    done
    
    # Set proper permissions for data directories
    chmod 750 "$PROJECT_ROOT/data"
    chmod 750 "$PROJECT_ROOT/logs"
    chmod 750 "$PROJECT_ROOT/backups"
    chmod 700 "$PROJECT_ROOT/docker/nginx/ssl"
    
    log_success "Directories created successfully"
}

# Generate SSL certificates
generate_ssl_certificates() {
    log_info "Generating SSL certificates..."
    
    local ssl_dir="$PROJECT_ROOT/docker/nginx/ssl"
    local domain="${DOMAIN:-radiology-ai.local}"
    
    if [[ -f "$ssl_dir/radiology-ai.crt" && -f "$ssl_dir/radiology-ai.key" ]]; then
        log_warning "SSL certificates already exist. Skipping generation."
        return
    fi
    
    # Generate private key
    openssl genrsa -out "$ssl_dir/radiology-ai.key" 4096
    
    # Generate certificate signing request
    openssl req -new -key "$ssl_dir/radiology-ai.key" -out "$ssl_dir/radiology-ai.csr" -subj "/C=DE/ST=Germany/L=Berlin/O=Medical Center/OU=Radiology AI/CN=$domain"
    
    # Generate self-signed certificate (for development/testing)
    openssl x509 -req -days 365 -in "$ssl_dir/radiology-ai.csr" -signkey "$ssl_dir/radiology-ai.key" -out "$ssl_dir/radiology-ai.crt"
    
    # Create certificate chain (copy cert for self-signed)
    cp "$ssl_dir/radiology-ai.crt" "$ssl_dir/radiology-ai-chain.crt"
    
    # Generate Diffie-Hellman parameters
    if [[ ! -f "$PROJECT_ROOT/docker/nginx/dhparam.pem" ]]; then
        log_info "Generating Diffie-Hellman parameters (this may take a while)..."
        openssl dhparam -out "$PROJECT_ROOT/docker/nginx/dhparam.pem" 2048
    fi
    
    # Set proper permissions
    chmod 600 "$ssl_dir"/*
    chmod 644 "$ssl_dir"/*.crt
    
    log_success "SSL certificates generated successfully"
    log_warning "Using self-signed certificates. Replace with CA-signed certificates for production."
}

# Setup environment file
setup_environment() {
    log_info "Setting up environment configuration..."
    
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        log_warning ".env file already exists. Creating backup..."
        cp "$PROJECT_ROOT/.env" "$PROJECT_ROOT/.env.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    if [[ ! -f "$PROJECT_ROOT/.env" ]]; then
        log_info "Creating .env file from template..."
        cp "$PROJECT_ROOT/.env.template" "$PROJECT_ROOT/.env"
        
        # Generate secure passwords and keys
        log_info "Generating secure passwords and keys..."
        
        # Generate JWT secret
        JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
        sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" "$PROJECT_ROOT/.env"
        
        # Generate encryption key
        ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n')
        sed -i "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$ENCRYPTION_KEY/" "$PROJECT_ROOT/.env"
        
        # Generate database password
        POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | tr -d '+/=' | head -c 32)
        sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$POSTGRES_PASSWORD/" "$PROJECT_ROOT/.env"
        
        # Generate Redis password
        REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | tr -d '+/=' | head -c 32)
        sed -i "s/REDIS_PASSWORD=.*/REDIS_PASSWORD=$REDIS_PASSWORD/" "$PROJECT_ROOT/.env"
        
        # Generate Grafana password
        GRAFANA_PASSWORD=$(openssl rand -base64 16 | tr -d '\n' | tr -d '+/=' | head -c 16)
        sed -i "s/GRAFANA_PASSWORD=.*/GRAFANA_PASSWORD=$GRAFANA_PASSWORD/" "$PROJECT_ROOT/.env"
        
        # Generate Grafana DB password
        GRAFANA_DB_PASSWORD=$(openssl rand -base64 16 | tr -d '\n' | tr -d '+/=' | head -c 16)
        sed -i "s/GRAFANA_DB_PASSWORD=.*/GRAFANA_DB_PASSWORD=$GRAFANA_DB_PASSWORD/" "$PROJECT_ROOT/.env"
        
        # Set proper permissions
        chmod 600 "$PROJECT_ROOT/.env"
        
        log_success "Environment file created with generated passwords"
        log_warning "Please review and update the .env file with your specific configuration"
        log_warning "Especially update OPENAI_API_KEY and other service-specific settings"
    else
        log_info "Using existing .env file"
    fi
}

# Initialize database
init_database() {
    log_info "Initializing database setup..."
    
    # Check if database initialization script exists
    if [[ ! -f "$PROJECT_ROOT/database/init.sql" ]]; then
        log_error "Database initialization script not found at database/init.sql"
        exit 1
    fi
    
    log_success "Database initialization script found"
}

# Setup Docker networks
setup_docker_networks() {
    log_info "Setting up Docker networks..."
    
    # Create custom networks if they don't exist
    if ! docker network inspect radiology-ai-system_radiology-network &> /dev/null; then
        docker network create radiology-ai-system_radiology-network --subnet=172.20.0.0/16 || true
    fi
    
    if ! docker network inspect radiology-ai-system_monitoring &> /dev/null; then
        docker network create radiology-ai-system_monitoring --subnet=172.21.0.0/16 || true
    fi
    
    log_success "Docker networks configured"
}

# Validate configuration files
validate_configuration() {
    log_info "Validating configuration files..."
    
    local config_files=(
        "docker-compose.yml"
        "docker/nginx/nginx.conf"
        "docker/postgres/postgresql.conf"
        "docker/redis/redis.conf"
        "docker/prometheus/prometheus.yml"
        "docker/loki/loki-config.yml"
        "docker/promtail/promtail-config.yml"
    )
    
    for config_file in "${config_files[@]}"; do
        if [[ ! -f "$PROJECT_ROOT/$config_file" ]]; then
            log_error "Configuration file missing: $config_file"
            exit 1
        fi
    done
    
    # Validate Docker Compose file
    if cd "$PROJECT_ROOT" && docker-compose config > /dev/null 2>&1; then
        log_success "Docker Compose configuration is valid"
    else
        log_error "Docker Compose configuration is invalid"
        cd "$PROJECT_ROOT" && docker-compose config
        exit 1
    fi
    
    log_success "Configuration files validated"
}

# Setup system limits and kernel parameters
setup_system_limits() {
    log_info "Setting up system limits and kernel parameters..."
    
    # Check if we can modify system settings
    if [[ ! -w /etc/sysctl.conf ]] && [[ ! -d /etc/sysctl.d ]]; then
        log_warning "Cannot modify system settings. Some optimizations may not be applied."
        return
    fi
    
    # Create sysctl configuration for medical workloads
    sudo tee /etc/sysctl.d/99-radiology-ai.conf > /dev/null <<EOF
# Radiology AI System Optimizations
# Network optimizations
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 8192

# Memory management for large medical files
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5

# File system optimizations
fs.file-max = 2097152
fs.inotify.max_user_watches = 524288

# Security settings
kernel.dmesg_restrict = 1
kernel.kptr_restrict = 2
EOF
    
    # Apply sysctl settings
    sudo sysctl -p /etc/sysctl.d/99-radiology-ai.conf
    
    log_success "System limits and kernel parameters configured"
}

# Setup log rotation
setup_log_rotation() {
    log_info "Setting up log rotation..."
    
    sudo tee /etc/logrotate.d/radiology-ai > /dev/null <<EOF
$PROJECT_ROOT/logs/*/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 $(whoami) $(whoami)
    postrotate
        docker-compose -f $PROJECT_ROOT/docker-compose.yml exec -T nginx nginx -s reload > /dev/null 2>&1 || true
    endscript
}

$PROJECT_ROOT/logs/medical-audit/*.log {
    daily
    rotate 3650
    compress
    delaycompress
    missingok
    notifempty
    create 644 $(whoami) $(whoami)
    # Medical audit logs are kept for 10 years for compliance
}
EOF
    
    log_success "Log rotation configured"
}

# Create systemd service (optional)
create_systemd_service() {
    log_info "Creating systemd service..."
    
    if [[ ! -d /etc/systemd/system ]]; then
        log_warning "Systemd not available. Skipping service creation."
        return
    fi
    
    sudo tee /etc/systemd/system/radiology-ai.service > /dev/null <<EOF
[Unit]
Description=Radiology AI System
Documentation=https://docs.radiology-ai.local
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$PROJECT_ROOT
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
ExecReload=/usr/local/bin/docker-compose restart
User=$(whoami)
Group=$(whoami)

[Install]
WantedBy=multi-user.target
EOF
    
    sudo systemctl daemon-reload
    sudo systemctl enable radiology-ai.service
    
    log_success "Systemd service created and enabled"
}

# Run security checks
run_security_checks() {
    log_info "Running security checks..."
    
    # Check file permissions
    local secure_files=(".env" "docker/nginx/ssl/radiology-ai.key")
    for file in "${secure_files[@]}"; do
        if [[ -f "$PROJECT_ROOT/$file" ]]; then
            local perms=$(stat -c "%a" "$PROJECT_ROOT/$file")
            if [[ "$perms" != "600" ]]; then
                log_warning "Fixing permissions for $file"
                chmod 600 "$PROJECT_ROOT/$file"
            fi
        fi
    done
    
    # Check for default passwords
    if grep -q "your-" "$PROJECT_ROOT/.env" 2>/dev/null; then
        log_error "Default passwords found in .env file. Please update all 'your-*' values."
        exit 1
    fi
    
    # Check OpenAI API key
    if ! grep -q "^OPENAI_API_KEY=sk-" "$PROJECT_ROOT/.env" 2>/dev/null; then
        log_warning "OpenAI API key not configured. Some features will not work."
    fi
    
    log_success "Security checks completed"
}

# Main installation function
main() {
    log_info "Starting Radiology AI System deployment setup..."
    log_info "Project root: $PROJECT_ROOT"
    
    check_root
    check_requirements
    create_directories
    setup_environment
    generate_ssl_certificates
    init_database
    setup_docker_networks
    validate_configuration
    setup_system_limits
    setup_log_rotation
    create_systemd_service
    run_security_checks
    
    log_success "Deployment setup completed successfully!"
    echo
    log_info "Next steps:"
    echo "1. Review and update the .env file with your specific configuration"
    echo "2. Update OPENAI_API_KEY in .env file"
    echo "3. Replace self-signed certificates with CA-signed certificates for production"
    echo "4. Run './scripts/deploy.sh' to start the system"
    echo "5. Run './scripts/health-check.sh' to verify the deployment"
    echo
    log_info "Important files:"
    echo "- Configuration: .env"
    echo "- SSL Certificates: docker/nginx/ssl/"
    echo "- Data Directory: data/"
    echo "- Logs Directory: logs/"
    echo "- Backups Directory: backups/"
    echo
    log_warning "For production deployment, ensure you:"
    echo "- Use proper SSL certificates from a trusted CA"
    echo "- Configure proper firewall rules"
    echo "- Set up external backup storage"
    echo "- Configure monitoring alerts"
    echo "- Review all security settings"
}

# Run main function
main "$@"