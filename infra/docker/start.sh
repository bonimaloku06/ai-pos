#!/bin/bash

# Pharmacy POS Docker Services Startup Script
# This script starts all Docker services with the correct port configuration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

echo "🚀 Starting Pharmacy POS Docker Services..."
echo "   Project root: $PROJECT_ROOT"
echo "   Environment file: $ENV_FILE"
echo ""

# Check if .env exists
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: .env file not found at $ENV_FILE"
    exit 1
fi

# Start services
cd "$SCRIPT_DIR"
docker-compose --env-file "$ENV_FILE" up -d

echo ""
echo "✅ Services started successfully!"
echo ""
echo "📊 Service URLs:"
echo "   PostgreSQL:      localhost:5433"
echo "   Redis:           localhost:6380"
echo "   Meilisearch:     http://localhost:7701"
echo "   MinIO Console:   http://localhost:9101"
echo "   MinIO API:       http://localhost:9100"
echo "   Prometheus:      http://localhost:9091"
echo "   Grafana:         http://localhost:3003 (admin/admin123)"
echo "   MailHog UI:      http://localhost:8026"
echo ""
echo "📝 View logs: docker-compose --env-file $ENV_FILE logs -f"
echo "⏹️  Stop services: docker-compose --env-file $ENV_FILE down"
echo ""

# Show container status
docker-compose --env-file "$ENV_FILE" ps
