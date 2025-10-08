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
if [ -f "$ENV_FILE" ]; then
    echo "   Using environment file: $ENV_FILE"
    ENV_FLAG="--env-file $ENV_FILE"
else
    echo "   Using default port configuration (no .env file found)"
    ENV_FLAG=""
fi

# Start services (only infrastructure)
cd "$SCRIPT_DIR"
docker-compose $ENV_FLAG up -d postgres redis meilisearch minio prometheus grafana mailhog

echo ""
echo "✅ Services started successfully!"
echo ""
echo "📊 Service URLs:"
echo "   PostgreSQL:      localhost:15433"
echo "   Redis:           localhost:16380"
echo "   Meilisearch:     http://localhost:17701"
echo "   MinIO Console:   http://localhost:19101"
echo "   MinIO API:       http://localhost:19100"
echo "   Prometheus:      http://localhost:19091"
echo "   Grafana:         http://localhost:13002 (admin/admin123)"
echo "   MailHog UI:      http://localhost:18026"
echo ""
echo "📝 View logs: docker-compose --env-file $ENV_FILE logs -f"
echo "⏹️  Stop services: docker-compose --env-file $ENV_FILE down"
echo ""

# Show container status
docker-compose --env-file "$ENV_FILE" ps
