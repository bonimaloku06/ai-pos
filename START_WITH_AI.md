# 🚀 Starting Pharmacy POS with AI Forecasting

## Quick Start (3 Terminals)

### Terminal 1: Docker Services
```bash
cd /Users/shabanmaloku/Desktop/Personal/AiPos
./infra/docker/start.sh
```

Wait until all containers show "healthy" status.

### Terminal 2: Python AI Forecast Service
```bash
cd /Users/shabanmaloku/Desktop/Personal/AiPos/apps/svc-forecast
./start.sh
```

You should see:
```
✅ Python environment ready
🚀 Starting forecast service on http://localhost:8000

INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Terminal 3: Node.js Application
```bash
cd /Users/shabanmaloku/Desktop/Personal/AiPos
pnpm dev
```

You should see:
```
✓ Meilisearch product index initialized
Server listening on http://localhost:4000
Local:   http://localhost:5173/
```

## Verify Everything is Running

### Check Services Status

**Docker Services:**
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

Should show 7 containers running.

**Forecast Service:**
```bash
curl http://localhost:8000/health
```

Should return: `{"status":"ok"}`

**API Core:**
```bash
curl http://localhost:4000/health
```

Should return API status.

**Web App:**
Open http://localhost:5173 in your browser.

## Test AI Forecasting

1. **Login**: http://localhost:5173
   - Email: `admin@pharmacy.com`
   - Password: `admin123`

2. **Go to Replenishment Page**

3. **Click "Generate Suggestions"**

4. **See AI-Powered Results**:
   - Machine learning demand forecasting
   - Seasonal trend detection
   - Multi-scenario order recommendations
   - Stock duration predictions
   - Urgency levels (CRITICAL/HIGH/MEDIUM/LOW)

## What Each Service Does

### Docker Services (Port 5433, 6380, 7701, etc.)
- **PostgreSQL**: Database (inventory, sales, users)
- **Redis**: Caching and session management
- **Meilisearch**: Fast product search
- **MinIO**: File storage
- **Prometheus/Grafana**: Monitoring
- **MailHog**: Email testing

### Python Forecast Service (Port 8000)
- **AI/ML Engine**: Time series forecasting
- **Demand Prediction**: Analyzes historical sales patterns
- **Reorder Calculations**: ROP, EOQ, safety stock
- **Scenario Generation**: Multiple order quantity options
- **Seasonal Analysis**: Detects trends and seasonality

### Node.js API (Port 4000)
- **REST API**: All business logic endpoints
- **Authentication**: JWT-based auth
- **Database Operations**: Prisma ORM
- **Forecast Integration**: Calls Python service for AI predictions
- **Real-time Updates**: WebSocket support

### React Web App (Port 5173)
- **User Interface**: Modern React UI
- **Real-time Updates**: TanStack Query
- **Routing**: TanStack Router
- **State Management**: React hooks
- **Forms**: React Hook Form

## Architecture Flow

```
User → Web App (5173) 
       ↓
       API Core (4000) → Database (5433)
       ↓                 → Redis (6380)
       ↓                 → Meilisearch (7701)
       ↓
       Python AI Service (8000)
       ↓
       Returns: AI-powered reorder suggestions
```

## Stopping Services

### Stop Application
Press `Ctrl+C` in Terminal 3 (Node.js app)

### Stop Forecast Service
Press `Ctrl+C` in Terminal 2 (Python service)

### Stop Docker
```bash
./infra/docker/stop.sh
```

## Troubleshooting

### Forecast Service Won't Start

**Check Python version:**
```bash
python3 --version
```
Should be Python 3.9+

**Reinstall dependencies:**
```bash
cd apps/svc-forecast
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

**Check for errors:**
```bash
cd apps/svc-forecast
source venv/bin/activate
python main.py
```

### API Can't Connect to Forecast Service

**Check if service is running:**
```bash
lsof -i :8000
```

Should show Python process.

**Test connection:**
```bash
curl http://localhost:8000/health
```

**Check .env file:**
```bash
cd apps/svc-forecast
cat .env
```

Should have:
```
API_CORE_URL=http://localhost:4000
PORT=8000
```

### "Forecast service unavailable" Error in UI

This means the Python service isn't running. Start it:
```bash
cd apps/svc-forecast
./start.sh
```

### Port Already in Use

**Check what's using port 8000:**
```bash
lsof -i :8000
```

**Kill the process:**
```bash
kill -9 <PID>
```

## Development Tips

### Auto-Reload

All services support auto-reload:
- **Node.js**: tsx watch (reloads on TypeScript changes)
- **Python**: Uvicorn --reload (reloads on Python changes)
- **React**: Vite HMR (hot module replacement)

### View Logs

**Python service:**
```bash
tail -f apps/svc-forecast/forecast.log
```

**API Core:**
Look at Terminal 3 output

**Docker services:**
```bash
docker-compose -f infra/docker/docker-compose.yml --env-file .env logs -f
```

### Database Changes

If you modify the Prisma schema:
```bash
cd apps/api-core
pnpm db:generate  # Generate client
DATABASE_URL="postgresql://pharmacy:pharmacy123@localhost:5433/pharmacy_pos" pnpm db:push  # Push to DB
```

## Performance Notes

### First Request May Be Slow

The first reorder suggestion generation takes longer because:
1. Python service loads ML libraries
2. Fetches sales history from database
3. Performs statistical calculations

Subsequent requests are faster (cached data).

### Memory Usage

Typical memory usage:
- Docker services: ~500MB
- Python forecast service: ~200MB
- Node.js API: ~150MB
- React dev server: ~100MB

Total: ~1GB RAM

### Scaling

For production:
- Use production builds (not dev servers)
- Enable Redis caching
- Use PostgreSQL connection pooling
- Deploy Python service separately
- Use CDN for static assets

## API Endpoints (Forecast Service)

**Health Check:**
```bash
GET http://localhost:8000/health
```

**Generate Recommendations (V2):**
```bash
POST http://localhost:8000/recommendations-v2
Content-Type: application/json

{
  "storeId": "store-id",
  "asOf": "2024-01-01T00:00:00Z",
  "skus": ["SKU001", "SKU002"],
  "leadTimes": {"SKU001": 7, "SKU002": 5},
  "currentStock": {"SKU001": 100, "SKU002": 50},
  "serviceLevel": 0.95,
  "analysisPeriodDays": 30,
  "zScore": 1.65
}
```

**Forecast Demand:**
```bash
POST http://localhost:8000/forecast
Content-Type: application/json

{
  "storeId": "store-id",
  "sku": "SKU001",
  "forecastDays": 30
}
```

## Environment Variables

### Root .env
```bash
# Docker ports
POSTGRES_PORT=5433
REDIS_PORT=6380
# ... etc

# Application URLs
DATABASE_URL=postgresql://pharmacy:pharmacy123@localhost:5433/pharmacy_pos
REDIS_URL=redis://localhost:6380
FORECAST_SVC_URL=http://localhost:8000
```

### apps/api-core/.env
Same as root .env

### apps/svc-forecast/.env
```bash
API_CORE_URL=http://localhost:4000
API_CORE_TOKEN=your-api-token
PORT=8000
```

## Summary

✅ **3 Services Required**:
1. Docker (infrastructure)
2. Python AI Service (port 8000)
3. Node.js App (ports 4000, 5173)

✅ **Start Order**:
1. Docker first (dependencies)
2. Python service (AI engine)
3. Node.js app (uses both)

✅ **All services must be running** for full AI-powered forecasting

🎯 **Result**: Real machine learning demand forecasting with multi-scenario recommendations!

---

**Ready to start? Run the 3 terminals above!** 🚀
