#!/bin/bash

# Medical Report Generation Service Startup Script
# This script handles the complete startup process for the service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
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

# Check if required files exist
check_requirements() {
    log_info "Checking requirements..."
    
    if [ ! -f ".env" ]; then
        log_warning ".env file not found. Copying from .env.example"
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_warning "Please edit .env file and add your OpenAI API key"
        else
            log_error ".env.example file not found"
            exit 1
        fi
    fi
    
    if [ ! -f "requirements.txt" ]; then
        log_error "requirements.txt not found"
        exit 1
    fi
    
    log_success "Requirements check completed"
}

# Load environment variables
load_env() {
    log_info "Loading environment variables..."
    
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
        log_success "Environment variables loaded"
    else
        log_error ".env file not found"
        exit 1
    fi
}

# Check for OpenAI API key
check_openai_key() {
    log_info "Checking OpenAI API key..."
    
    if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "sk-your-openai-api-key-here" ]; then
        log_error "OpenAI API key not configured in .env file"
        log_error "Please edit .env file and add your OpenAI API key"
        exit 1
    fi
    
    log_success "OpenAI API key configured"
}

# Wait for service to be ready
wait_for_service() {
    local service_name=$1
    local port=$2
    local max_attempts=30
    local attempt=1
    
    log_info "Waiting for $service_name to be ready on port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z localhost $port 2>/dev/null; then
            log_success "$service_name is ready"
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts: $service_name not ready yet..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    log_error "$service_name failed to start within expected time"
    return 1
}

# Start database services
start_database() {
    log_info "Starting database services..."
    
    if docker-compose ps | grep -q "report-db.*Up"; then
        log_info "Database already running"
    else
        docker-compose up -d report-db redis
        wait_for_service "PostgreSQL" 5433
        wait_for_service "Redis" 6380
    fi
    
    log_success "Database services started"
}

# Initialize database
init_database() {
    log_info "Initializing database..."
    
    # Wait a bit more for database to be fully ready
    sleep 5
    
    # Run database initialization
    if python -c "
import asyncio
import sys
sys.path.append('.')
from app.core.database import init_db
try:
    asyncio.run(init_db())
    print('Database initialized successfully')
except Exception as e:
    print(f'Database initialization failed: {e}')
    sys.exit(1)
"; then
        log_success "Database initialized"
    else
        log_error "Database initialization failed"
        exit 1
    fi
}

# Start the application
start_application() {
    log_info "Starting Medical Report Generation Service..."
    
    if [ "$1" = "development" ]; then
        log_info "Starting in development mode with auto-reload"
        uvicorn main:app --host 0.0.0.0 --port 8002 --reload
    elif [ "$1" = "production" ]; then
        log_info "Starting in production mode"
        gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8002
    else
        log_info "Starting with default settings"
        uvicorn main:app --host 0.0.0.0 --port 8002
    fi
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:8002/health >/dev/null 2>&1; then
            log_success "Service is healthy"
            curl -s http://localhost:8002/health | python -m json.tool
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts: Service not ready yet..."
        sleep 3
        attempt=$((attempt + 1))
    done
    
    log_error "Service health check failed"
    return 1
}

# Stop services
stop_services() {
    log_info "Stopping services..."
    docker-compose down
    log_success "Services stopped"
}

# Show logs
show_logs() {
    if [ -n "$1" ]; then
        docker-compose logs -f "$1"
    else
        docker-compose logs -f
    fi
}

# Main script logic
case "$1" in
    "start")
        check_requirements
        load_env
        check_openai_key
        start_database
        init_database
        start_application "${2:-default}"
        ;;
    
    "dev")
        check_requirements
        load_env
        check_openai_key
        start_database
        init_database
        start_application "development"
        ;;
    
    "prod")
        check_requirements
        load_env
        check_openai_key
        start_database
        init_database
        start_application "production"
        ;;
    
    "docker")
        check_requirements
        log_info "Starting with Docker Compose..."
        docker-compose up -d
        wait_for_service "Medical Report Service" 8002
        health_check
        ;;
    
    "stop")
        stop_services
        ;;
    
    "restart")
        stop_services
        sleep 2
        $0 docker
        ;;
    
    "logs")
        show_logs "$2"
        ;;
    
    "health")
        health_check
        ;;
    
    "test")
        log_info "Running tests..."
        pytest tests/ -v
        ;;
    
    "install")
        log_info "Installing Python dependencies..."
        pip install -r requirements.txt
        log_success "Dependencies installed"
        ;;
    
    "setup")
        log_info "Setting up development environment..."
        check_requirements
        log_info "Installing Python dependencies..."
        pip install -r requirements.txt
        load_env
        check_openai_key
        start_database
        init_database
        log_success "Development environment setup completed"
        log_info "You can now run: ./start.sh dev"
        ;;
    
    *)
        echo "Medical Report Generation Service"
        echo ""
        echo "Usage: $0 {command} [options]"
        echo ""
        echo "Commands:"
        echo "  setup          - Set up development environment"
        echo "  start          - Start service with default settings"
        echo "  dev            - Start in development mode (with auto-reload)"
        echo "  prod           - Start in production mode (with gunicorn)"
        echo "  docker         - Start using Docker Compose"
        echo "  stop           - Stop all services"
        echo "  restart        - Restart services"
        echo "  logs [service] - Show logs (optionally for specific service)"
        echo "  health         - Check service health"
        echo "  test           - Run test suite"
        echo "  install        - Install Python dependencies"
        echo ""
        echo "Examples:"
        echo "  $0 setup       - Initial setup"
        echo "  $0 dev         - Start development server"
        echo "  $0 docker      - Start with Docker"
        echo "  $0 logs        - Show all logs"
        echo "  $0 health      - Check if service is running"
        echo ""
        exit 1
        ;;
esac