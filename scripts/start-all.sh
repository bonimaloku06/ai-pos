#!/bin/bash

# Pharmacy POS - Start All Services
# This script starts Docker, Python Forecast Service, and Node.js apps

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🚀 Starting Pharmacy POS - All Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    lsof -i :"$1" >/dev/null 2>&1
}

# Function to wait for a service to be ready
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=0

    echo "⏳ Waiting for $name to be ready..."
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            echo "✅ $name is ready!"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done
    echo "⚠️  $name didn't start in time (but continuing anyway)"
    return 1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists docker; then
    echo "❌ Docker is not installed. Please install Docker Desktop."
    exit 1
fi

if ! command_exists python3; then
    echo "❌ Python 3 is not installed. Please install Python 3.9+."
    exit 1
fi

if ! command_exists pnpm; then
    echo "❌ pnpm is not installed. Please install pnpm."
    exit 1
fi

echo "✅ All prerequisites installed"
echo ""

# Step 1: Start Docker Services
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🐳 Step 1/3: Starting Docker Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$PROJECT_ROOT/infra/docker"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "⚠️  Docker daemon is not running. Please start Docker Desktop."
    exit 1
fi

# Check if services are already running
if docker-compose --env-file ../../.env ps | grep -q "Up"; then
    echo "✅ Docker services already running"
else
    echo "🚀 Starting Docker services..."
    docker-compose --env-file ../../.env up -d
    
    # Wait for key services
    wait_for_service "http://localhost:5433" "PostgreSQL"
    wait_for_service "http://localhost:7701/health" "Meilisearch"
fi

echo ""

# Step 2: Start Python Forecast Service
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔮 Step 2/3: Starting Python Forecast Service"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$PROJECT_ROOT/apps/svc-forecast"

# Check if already running
if port_in_use 8000; then
    echo "✅ Forecast service already running on port 8000"
else
    # Check if venv exists
    if [ ! -d "venv" ]; then
        echo "📦 Creating Python virtual environment..."
        python3 -m venv venv
        source venv/bin/activate
        pip install --upgrade pip --quiet
        pip install -r requirements.txt --quiet
    else
        source venv/bin/activate
    fi

    # Check if dependencies are installed
    if ! python -c "import fastapi" 2>/dev/null; then
        echo "📦 Installing Python dependencies..."
        pip install -r requirements.txt --quiet
    fi

    echo "🚀 Starting forecast service in background..."
    nohup python main.py > forecast.log 2>&1 &
    FORECAST_PID=$!
    echo $FORECAST_PID > forecast.pid
    
    # Wait for service to be ready
    wait_for_service "http://localhost:8000/health" "Forecast Service"
fi

echo ""

# Step 3: Start Node.js Services
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚡ Step 3/3: Starting Node.js Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$PROJECT_ROOT"

echo "🎯 Starting API Core and Web App with Turbo..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All Services Started!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Service URLs:"
echo "   🌐 Web App:          http://localhost:5173"
echo "   🔌 API Core:         http://localhost:4000"
echo "   🔮 Forecast Service: http://localhost:8000"
echo "   📊 Grafana:          http://localhost:3003"
echo "   📦 MinIO Console:    http://localhost:9101"
echo ""
echo "🔑 Default Login:"
echo "   Email:    admin@pharmacy.com"
echo "   Password: admin123"
echo ""
echo "⏹️  To stop all services:"
echo "   Press Ctrl+C, then run: ./scripts/stop-all.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Now start Turbo (this will run in foreground)
exec pnpm turbo run dev
