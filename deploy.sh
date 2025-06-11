#!/bin/bash

# Agentic RAG Platform Deployment Script
# Automates the complete deployment process with comprehensive validation

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Cleanup function for graceful shutdown
cleanup() {
    if [ $? -ne 0 ]; then
        log_error "Deployment failed. Cleaning up..."
        docker-compose down --remove-orphans 2>/dev/null || true
    fi
}
trap cleanup EXIT

log_info "Starting Agentic RAG Platform Deployment"

# Check system requirements
check_requirements() {
    log_info "Checking system requirements..."
    
    command -v docker >/dev/null 2>&1 || { 
        log_error "Docker is required but not installed. Please install Docker first."
        exit 1 
    }
    
    command -v docker-compose >/dev/null 2>&1 || { 
        log_error "Docker Compose is required but not installed. Please install Docker Compose first."
        exit 1 
    }
    
    # Check Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi
    
    log_success "System requirements satisfied"
}

# Validate environment configuration
validate_environment() {
    log_info "Validating environment configuration..."
    
    if [ ! -f .env ]; then
        log_warning "No .env file found. Creating from template..."
        cp .env.example .env
        log_error "Please edit .env file with your configuration before continuing."
        log_info "Required variables: DATABASE_URL, OPENAI_API_KEY, POSTGRES_PASSWORD"
        exit 1
    fi
    
    # Source environment file
    set -a
    source .env
    set +a
    
    # Validate required variables
    missing_vars=()
    [ -z "${DATABASE_URL:-}" ] && missing_vars+=("DATABASE_URL")
    [ -z "${OPENAI_API_KEY:-}" ] && missing_vars+=("OPENAI_API_KEY")
    [ -z "${POSTGRES_PASSWORD:-}" ] && missing_vars+=("POSTGRES_PASSWORD")
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        log_error "Required environment variables missing in .env file:"
        printf '  - %s\n' "${missing_vars[@]}"
        exit 1
    fi
    
    # Validate OpenAI API key format
    if [[ ! "$OPENAI_API_KEY" =~ ^sk-[a-zA-Z0-9]{48,}$ ]]; then
        log_warning "OpenAI API key format appears invalid"
    fi
    
    log_success "Environment configuration validated"
}

# Build and deploy services
deploy_services() {
    log_info "Building Docker images..."
    docker-compose build --no-cache
    
    log_info "Starting PostgreSQL database..."
    docker-compose up -d postgres
    
    # Wait for database with proper health check
    log_info "Waiting for database to be ready..."
    max_attempts=30
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker-compose exec -T postgres pg_isready -U postgres -d agentic_rag >/dev/null 2>&1; then
            log_success "Database is ready"
            break
        fi
        
        attempt=$((attempt + 1))
        log_info "Database not ready yet (attempt $attempt/$max_attempts)..."
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "Database failed to start within expected time"
        docker-compose logs postgres
        exit 1
    fi
    
    log_info "Starting application services..."
    docker-compose up -d app
    
    # Wait for application to be ready
    log_info "Waiting for application to start..."
    max_attempts=30
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f -s http://localhost:5000/api/health >/dev/null 2>&1; then
            log_success "Application is running"
            break
        fi
        
        attempt=$((attempt + 1))
        log_info "Application not ready yet (attempt $attempt/$max_attempts)..."
        sleep 3
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "Application failed to start within expected time"
        docker-compose logs app
        exit 1
    fi
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    if docker-compose exec -T app npm run db:push; then
        log_success "Database migrations completed"
    else
        log_error "Database migrations failed"
        docker-compose logs app
        exit 1
    fi
}

# Perform final health checks
health_check() {
    log_info "Performing comprehensive health check..."
    
    # Check API health endpoint
    health_response=$(curl -s http://localhost:5000/api/health || echo "failed")
    if [[ "$health_response" == *"healthy"* ]]; then
        log_success "API health check passed"
    else
        log_error "API health check failed"
        echo "Response: $health_response"
        exit 1
    fi
    
    # Check database connection
    if docker-compose exec -T postgres psql -U postgres -d agentic_rag -c "SELECT 1;" >/dev/null 2>&1; then
        log_success "Database connection verified"
    else
        log_error "Database connection failed"
        exit 1
    fi
    
    log_success "All health checks passed"
}

# Main deployment flow
main() {
    check_requirements
    validate_environment
    deploy_services
    run_migrations
    health_check
    
    log_success "Deployment completed successfully!"
    echo ""
    log_info "Application is now available at: http://localhost:5000"
    echo ""
    log_info "Useful management commands:"
    echo "  View logs:           docker-compose logs -f"
    echo "  Stop services:       docker-compose down"
    echo "  Restart services:    docker-compose restart"
    echo "  Update application:  git pull && docker-compose up -d --build"
    echo "  Database backup:     docker-compose exec postgres pg_dump -U postgres agentic_rag > backup.sql"
}

# Run main function
main "$@"