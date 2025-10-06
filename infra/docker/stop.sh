#!/bin/bash

# Pharmacy POS Docker Services Stop Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

echo "⏹️  Stopping Pharmacy POS Docker Services..."

cd "$SCRIPT_DIR"
docker-compose --env-file "$ENV_FILE" down

echo ""
echo "✅ All services stopped!"
