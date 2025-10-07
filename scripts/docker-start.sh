#!/bin/bash

# Pharmacy POS - Docker Start Script
# Starts all services using Docker Compose

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_DIR="$PROJECT_ROOT/infra/docker"

echo "🚀 Starting Pharmacy POS - All Services in Docker"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists docker; then
    echo "❌ Docker is not installed. Please install Docker Desktop."
    exit 1
fi

echo "✅ All prerequisites installed"
echo ""

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "⚠️  Docker daemon is not running. Please start Docker Desktop."
    exit 1
fi

cd "$DOCKER_DIR"

# Check if services are already running
RUNNING_CONTAINERS=$(docker-compose --env-file ../../.env ps -q | wc -l)

if [ "$RUNNING_CONTAINERS" -gt 0 ]; then
    echo "⚠️  Some containers are already running."
    read -p "Do you want to restart them? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔄 Restarting services..."
        docker-compose --env-file ../../.env down
    else
        echo "ℹ️  Using existing containers."
    fi
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🐳 Starting All Services with Docker Compose"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Build and start services
echo "📦 Building and starting services..."
docker-compose --env-file ../../.env up -d --build

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Show service status
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Service Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker-compose --env-file ../../.env ps

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All Services Started!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Service URLs:"
echo "   🌐 Web App:          http://localhost:5174"
echo "   🔌 API Core:         http://localhost:4000"
echo "   🔮 Forecast Service: http://localhost:8000"
echo "   📊 Grafana:          http://localhost:3003"
echo "   📦 MinIO Console:    http://localhost:9101"
echo "   📧 MailHog UI:       http://localhost:8026"
echo ""
echo "🔑 Default Login:"
echo "   Email:    admin@pharmacy.com"
echo "   Password: admin123"
echo ""
echo "📝 Useful Commands:"
echo "   View logs:           docker-compose --env-file ../../.env logs -f"
echo "   Stop services:       docker-compose --env-file ../../.env down"
echo "   Restart service:     docker-compose --env-file ../../.env restart <service>"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
