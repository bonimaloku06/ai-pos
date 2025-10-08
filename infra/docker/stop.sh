#!/bin/bash

# Pharmacy POS Docker Services Stop Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

echo "⏹️  Stopping Pharmacy POS Docker Services..."

cd "$SCRIPT_DIR"

# Check if .env exists
if [ -f "$ENV_FILE" ]; then
    docker-compose --env-file "$ENV_FILE" down
else
    docker-compose down
fi

echo ""
echo "✅ All services stopped!"
