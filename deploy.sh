#!/bin/bash

# CipherWave Production Deployment Script
# Usage: ./deploy.sh [environment] [action]
# Example: ./deploy.sh production deploy

set -e

# Configuration
ENVIRONMENT=${1:-production}
ACTION=${2:-deploy}
PROJECT_NAME="cipherwave"
DOCKER_IMAGE="${PROJECT_NAME}:latest"
BACKUP_DIR="./backups"
LOG_FILE="./deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "${LOG_FILE}"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "${LOG_FILE}"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "${LOG_FILE}"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "${LOG_FILE}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    # Check if required files exist
    if [[ ! -f "docker-compose.yml" ]]; then
        error "docker-compose.yml not found"
    fi
    
    if [[ ! -f "Dockerfile" ]]; then
        error "Dockerfile not found"
    fi
    
    log "Prerequisites check passed"
}

# Create backup
create_backup() {
    log "Creating backup..."
    
    mkdir -p "${BACKUP_DIR}"
    
    local backup_name="${PROJECT_NAME}-backup-$(date +%Y%m%d-%H%M%S)"
    local backup_path="${BACKUP_DIR}/${backup_name}"
    
    # Backup current deployment if it exists
    if docker-compose ps -q | grep -q .; then
        log "Backing up current deployment to ${backup_path}"
        
        # Export current containers
        docker-compose config > "${backup_path}-compose.yml"
        
        # Backup volumes
        mkdir -p "${backup_path}"
        docker run --rm -v cipherwave_redis-data:/data -v "${PWD}/${backup_path}:/backup" alpine \
            tar czf /backup/redis-data.tar.gz -C /data .
        
        log "Backup created at ${backup_path}"
    else
        log "No existing deployment found, skipping backup"
    fi
}

# Build Docker image
build_image() {
    log "Building Docker image..."
    
    # Build the image
    docker build -t "${DOCKER_IMAGE}" .
    
    # Tag with timestamp for versioning
    local timestamp=$(date +%Y%m%d-%H%M%S)
    docker tag "${DOCKER_IMAGE}" "${PROJECT_NAME}:${timestamp}"
    
    log "Docker image built successfully"
}

# Deploy application
deploy() {
    log "Starting deployment for environment: ${ENVIRONMENT}"
    
    # Copy environment file
    if [[ -f ".env.${ENVIRONMENT}" ]]; then
        cp ".env.${ENVIRONMENT}" .env
        log "Environment file copied: .env.${ENVIRONMENT}"
    elif [[ -f ".env.example" ]]; then
        warn "No environment-specific file found, using .env.example"
        cp .env.example .env
    else
        warn "No environment file found, using defaults"
    fi
    
    # Pull latest images for services
    log "Pulling latest service images..."
    docker-compose pull redis nginx prometheus grafana
    
    # Start services
    log "Starting services..."
    docker-compose up -d
    
    # Wait for services to be healthy
    log "Waiting for services to be healthy..."
    local max_wait=120
    local wait_time=0
    
    while [[ $wait_time -lt $max_wait ]]; do
        if docker-compose ps | grep -q "healthy\|Up"; then
            log "Services are healthy"
            break
        fi
        
        sleep 5
        wait_time=$((wait_time + 5))
        info "Waiting for services... (${wait_time}s/${max_wait}s)"
    done
    
    if [[ $wait_time -ge $max_wait ]]; then
        error "Services failed to become healthy within ${max_wait} seconds"
    fi
    
    # Run post-deployment checks
    post_deployment_checks
    
    log "Deployment completed successfully"
}

# Post-deployment health checks
post_deployment_checks() {
    log "Running post-deployment health checks..."
    
    # Check if main service is responding
    local health_url="http://localhost:52178/health"
    local max_retries=10
    local retry=0
    
    while [[ $retry -lt $max_retries ]]; do
        if curl -f "${health_url}" &> /dev/null; then
            log "Health check passed"
            break
        fi
        
        retry=$((retry + 1))
        info "Health check attempt ${retry}/${max_retries}..."
        sleep 5
    done
    
    if [[ $retry -ge $max_retries ]]; then
        error "Health check failed after ${max_retries} attempts"
    fi
    
    # Check WebSocket connectivity
    log "Checking WebSocket connectivity..."
    if command -v wscat &> /dev/null; then
        if timeout 5 wscat -c ws://localhost:52178 --wait 1 &> /dev/null; then
            log "WebSocket connectivity check passed"
        else
            warn "WebSocket connectivity check failed (wscat required for full test)"
        fi
    else
        warn "wscat not found, skipping WebSocket connectivity test"
    fi
    
    # Display service status
    log "Service status:"
    docker-compose ps
}

# Rollback to previous version
rollback() {
    log "Starting rollback..."
    
    # Find latest backup
    local latest_backup=$(ls -t "${BACKUP_DIR}"/*-compose.yml 2>/dev/null | head -n1)
    
    if [[ -z "$latest_backup" ]]; then
        error "No backup found for rollback"
    fi
    
    log "Rolling back to: ${latest_backup}"
    
    # Stop current services
    docker-compose down
    
    # Restore from backup
    cp "${latest_backup}" docker-compose.yml
    
    # Start services
    docker-compose up -d
    
    log "Rollback completed"
}

# Stop services
stop() {
    log "Stopping services..."
    docker-compose down
    log "Services stopped"
}

# View logs
logs() {
    log "Showing application logs..."
    docker-compose logs -f cipherwave
}

# Clean up old images and containers
cleanup() {
    log "Cleaning up old images and containers..."
    
    # Remove stopped containers
    docker container prune -f
    
    # Remove unused images (keep last 3 versions)
    local images_to_remove=$(docker images "${PROJECT_NAME}" --format "table {{.Repository}}:{{.Tag}}" | tail -n +4)
    if [[ -n "$images_to_remove" ]]; then
        echo "$images_to_remove" | xargs docker rmi
    fi
    
    # Remove unused volumes (be careful with this)
    # docker volume prune -f
    
    log "Cleanup completed"
}

# Show usage information
usage() {
    echo "CipherWave Deployment Script"
    echo ""
    echo "Usage: $0 [environment] [action]"
    echo ""
    echo "Environments:"
    echo "  development    Development environment"
    echo "  staging        Staging environment"
    echo "  production     Production environment (default)"
    echo ""
    echo "Actions:"
    echo "  deploy         Deploy the application (default)"
    echo "  build          Build Docker image only"
    echo "  rollback       Rollback to previous version"
    echo "  stop           Stop all services"
    echo "  logs           View application logs"
    echo "  cleanup        Clean up old images and containers"
    echo "  status         Show service status"
    echo ""
    echo "Examples:"
    echo "  $0 production deploy"
    echo "  $0 staging build"
    echo "  $0 production rollback"
    echo "  $0 logs"
}

# Show service status
status() {
    log "Service status:"
    docker-compose ps
    
    log "System resources:"
    docker stats --no-stream
}

# Main execution
main() {
    case "${ACTION}" in
        deploy)
            check_prerequisites
            create_backup
            build_image
            deploy
            ;;
        build)
            check_prerequisites
            build_image
            ;;
        rollback)
            check_prerequisites
            rollback
            ;;
        stop)
            stop
            ;;
        logs)
            logs
            ;;
        cleanup)
            cleanup
            ;;
        status)
            status
            ;;
        help|--help|-h)
            usage
            ;;
        *)
            error "Unknown action: ${ACTION}. Use 'help' for usage information."
            ;;
    esac
}

# Trap signals for cleanup
trap 'error "Deployment interrupted"' INT TERM

# Create log file
mkdir -p "$(dirname "${LOG_FILE}")"
touch "${LOG_FILE}"

# Run main function
main "$@"