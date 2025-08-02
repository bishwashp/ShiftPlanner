#!/bin/bash

# V0.6 Deployment Script for ShiftPlanner
# This script deploys the production-ready system with all V0.6 features

set -e

echo "🚀 Starting V0.6 Deployment for ShiftPlanner"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="shiftplanner"
ENVIRONMENT=${1:-production}
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if required directories exist
    if [ ! -d "backend" ]; then
        print_error "Backend directory not found. Please run this script from the project root."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    mkdir -p logs/nginx
    mkdir -p nginx/ssl
    mkdir -p monitoring/grafana/dashboards
    mkdir -p monitoring/grafana/datasources
    
    print_success "Directories created"
}

# Function to generate SSL certificates (self-signed for development)
generate_ssl_certificates() {
    print_status "Generating SSL certificates..."
    
    if [ ! -f "nginx/ssl/cert.pem" ] || [ ! -f "nginx/ssl/key.pem" ]; then
        print_warning "SSL certificates not found. Generating self-signed certificates..."
        
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout nginx/ssl/key.pem \
            -out nginx/ssl/cert.pem \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
        
        print_success "Self-signed SSL certificates generated"
    else
        print_success "SSL certificates already exist"
    fi
}

# Function to create environment file
create_environment_file() {
    print_status "Creating environment configuration..."
    
    if [ ! -f ".env" ]; then
        cat > .env << EOF
# V0.6 Production Configuration
NODE_ENV=production

# Database Configuration
DATABASE_PASSWORD=secure_production_password
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

# Redis Configuration
REDIS_PASSWORD=secure_redis_password
REDIS_DB=0

# Security Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# Rate Limiting
RATE_LIMIT_API=100
RATE_LIMIT_AUTH=5
RATE_LIMIT_GRAPHQL=200

# Monitoring Configuration
MONITORING_ENABLED=true
ALERTING_ENABLED=true
METRICS_COLLECTION_INTERVAL=30000

# Performance Configuration
COMPRESSION_ENABLED=true
COMPRESSION_LEVEL=6
COMPRESSION_THRESHOLD=1024

# GraphQL Configuration
GRAPHQL_INTROSPECTION=false
GRAPHQL_PLAYGROUND=false

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=json

# Monitoring Passwords
GRAFANA_PASSWORD=secure_grafana_password
PGADMIN_PASSWORD=secure_pgadmin_password

# Alerting Configuration
ALERT_EMAIL=admin@shiftplanner.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz
ALERT_WEBHOOK_URL=https://alerts.example.com/webhook
ALERT_SMS_NUMBER=+1234567890

# Webhook Configuration
CALENDAR_WEBHOOK_URL=https://calendar.example.com/webhook
CALENDAR_WEBHOOK_SECRET=calendar-secret-key
SLACK_WEBHOOK_SECRET=slack-secret-key
ANALYTICS_WEBHOOK_URL=https://analytics.example.com/webhook
ANALYTICS_WEBHOOK_SECRET=analytics-secret-key
EOF
        
        print_success "Environment file created"
        print_warning "Please review and update the .env file with your actual values"
    else
        print_success "Environment file already exists"
    fi
}

# Function to create monitoring configuration
create_monitoring_config() {
    print_status "Creating monitoring configuration..."
    
    # Create Prometheus configuration
    cat > monitoring/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'shiftplanner-backend'
    static_configs:
      - targets: ['backend:4000']
    metrics_path: '/monitoring/metrics'
    scrape_interval: 30s

  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
EOF
    
    # Create Grafana datasource configuration
    mkdir -p monitoring/grafana/datasources
    cat > monitoring/grafana/datasources/prometheus.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
EOF
    
    # Create Grafana dashboard configuration
    mkdir -p monitoring/grafana/dashboards
    cat > monitoring/grafana/dashboards/dashboards.yml << EOF
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
EOF
    
    print_success "Monitoring configuration created"
}

# Function to build and deploy
deploy() {
    print_status "Building and deploying V0.6..."
    
    # Build the backend image
    print_status "Building backend Docker image..."
    docker-compose -f $DOCKER_COMPOSE_FILE build backend
    
    # Start the services
    print_status "Starting services..."
    docker-compose -f $DOCKER_COMPOSE_FILE up -d
    
    # Wait for services to be healthy
    print_status "Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    print_status "Checking service health..."
    
    # Check backend health
    if curl -f http://localhost:4000/health > /dev/null 2>&1; then
        print_success "Backend is healthy"
    else
        print_error "Backend health check failed"
        exit 1
    fi
    
    # Check database health
    if docker-compose -f $DOCKER_COMPOSE_FILE exec -T postgres pg_isready -U shiftplanner > /dev/null 2>&1; then
        print_success "Database is healthy"
    else
        print_error "Database health check failed"
        exit 1
    fi
    
    # Check Redis health
    if docker-compose -f $DOCKER_COMPOSE_FILE exec -T redis redis-cli ping > /dev/null 2>&1; then
        print_success "Redis is healthy"
    else
        print_error "Redis health check failed"
        exit 1
    fi
    
    print_success "V0.6 deployment completed successfully!"
}

# Function to show deployment status
show_status() {
    print_status "Deployment Status:"
    echo ""
    
    # Show running containers
    echo "📦 Running Containers:"
    docker-compose -f $DOCKER_COMPOSE_FILE ps
    
    echo ""
    
    # Show service URLs
    echo "🌐 Service URLs:"
    echo "  - Backend API: http://localhost:4000"
    echo "  - GraphQL: http://localhost:4000/graphql"
    echo "  - Health Check: http://localhost:4000/health"
    echo "  - Monitoring Dashboard: http://localhost:3001 (Grafana)"
    echo "  - Prometheus: http://localhost:9090"
    echo "  - Nginx (Load Balancer): http://localhost:80 -> https://localhost:443"
    
    echo ""
    
    # Show debug tools (if enabled)
    if docker-compose -f $DOCKER_COMPOSE_FILE ps | grep -q "redis-commander\|pgadmin"; then
        echo "🔧 Debug Tools (if enabled):"
        echo "  - Redis Commander: http://localhost:8081"
        echo "  - pgAdmin: http://localhost:8080"
    fi
    
    echo ""
    echo "📊 To enable debug tools, run: docker-compose -f $DOCKER_COMPOSE_FILE --profile debug up -d"
}

# Function to run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Wait for database to be ready
    sleep 10
    
    # Run Prisma migrations
    docker-compose -f $DOCKER_COMPOSE_FILE exec -T backend npx prisma migrate deploy
    
    print_success "Database migrations completed"
}

# Function to seed database
seed_database() {
    print_status "Seeding database..."
    
    # Run database seeding
    docker-compose -f $DOCKER_COMPOSE_FILE exec -T backend npm run seed
    
    print_success "Database seeding completed"
}

# Function to show logs
show_logs() {
    print_status "Showing recent logs..."
    docker-compose -f $DOCKER_COMPOSE_FILE logs --tail=50
}

# Function to stop services
stop_services() {
    print_status "Stopping services..."
    docker-compose -f $DOCKER_COMPOSE_FILE down
    print_success "Services stopped"
}

# Function to clean up
cleanup() {
    print_status "Cleaning up..."
    docker-compose -f $DOCKER_COMPOSE_FILE down -v --remove-orphans
    docker system prune -f
    print_success "Cleanup completed"
}

# Main execution
main() {
    case "$2" in
        "status")
            show_status
            ;;
        "logs")
            show_logs
            ;;
        "stop")
            stop_services
            ;;
        "cleanup")
            cleanup
            ;;
        "migrate")
            run_migrations
            ;;
        "seed")
            seed_database
            ;;
        *)
            check_prerequisites
            create_directories
            generate_ssl_certificates
            create_environment_file
            create_monitoring_config
            deploy
            run_migrations
            show_status
            ;;
    esac
}

# Run main function
main "$@" 