#!/bin/bash

# Pharmacy POS - Stop All Services

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "⏹️  Stopping Pharmacy POS - All Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Stop Python Forecast Service
echo "🔮 Stopping Python Forecast Service..."
cd "$PROJECT_ROOT/apps/svc-forecast"

if [ -f "forecast.pid" ]; then
    PID=$(cat forecast.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        echo "✅ Forecast service stopped (PID: $PID)"
    else
        echo "⚠️  Forecast service not running (stale PID file)"
    fi
    rm -f forecast.pid
else
    # Try to find and kill by process name
    PIDS=$(pgrep -f "python main.py" || true)
    if [ -n "$PIDS" ]; then
        echo "$PIDS" | xargs kill 2>/dev/null || true
        echo "✅ Forecast service stopped"
    else
        echo "✅ Forecast service not running"
    fi
fi

echo ""

# Stop Docker Services
echo "🐳 Stopping Docker Services..."
cd "$PROJECT_ROOT/infra/docker"

if docker-compose --env-file ../../.env ps -q | grep -q .; then
    docker-compose --env-file ../../.env down
    echo "✅ Docker services stopped"
else
    echo "✅ Docker services already stopped"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All services stopped!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To start again, run: pnpm dev"
echo ""
