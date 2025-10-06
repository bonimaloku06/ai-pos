#!/bin/bash

# Pharmacy POS - Forecast Service Startup Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔮 Starting Pharmacy POS Forecast Service..."
echo "   Directory: $SCRIPT_DIR"
echo ""

cd "$SCRIPT_DIR"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Creating one..."
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Check if dependencies are installed
if ! python -c "import fastapi" 2>/dev/null; then
    echo "📦 Installing dependencies..."
    pip install -r requirements.txt
fi

echo ""
echo "✅ Python environment ready"
echo "🚀 Starting forecast service on http://localhost:8000"
echo ""
echo "   Press Ctrl+C to stop"
echo ""

# Start the service
python main.py
