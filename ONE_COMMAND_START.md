# ⚡ One Command to Start Everything!

## 🚀 Quick Start

Just run:

```bash
pnpm dev
```

**That's it!** All services start automatically:
- ✅ Docker Services (PostgreSQL, Redis, Meilisearch, MinIO, etc.)
- ✅ Python AI Forecast Service (port 8000)
- ✅ API Core (port 4000)
- ✅ Web App (port 5173)

## What Happens

When you run `pnpm dev`, the script automatically:

1. **Checks Prerequisites**
   - Docker installed and running
   - Python 3 installed
   - pnpm installed

2. **Starts Docker Services**
   - PostgreSQL (port 5433)
   - Redis (port 6380)
   - Meilisearch (port 7701)
   - MinIO (ports 9100-9101)
   - Prometheus, Grafana, MailHog

3. **Starts Python Forecast Service**
   - Creates virtual environment if needed
   - Installs dependencies if needed
   - Starts service on port 8000
   - Runs in background

4. **Starts Node.js Apps**
   - API Core (port 4000)
   - Web App (port 5173)
   - Uses Turbo for parallel execution

## Expected Output

You'll see:

```
🚀 Starting Pharmacy POS - All Services
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Checking prerequisites...
✅ All prerequisites installed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🐳 Step 1/3: Starting Docker Services
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Starting Docker services...
⏳ Waiting for PostgreSQL to be ready...
✅ PostgreSQL is ready!
⏳ Waiting for Meilisearch to be ready...
✅ Meilisearch is ready!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔮 Step 2/3: Starting Python Forecast Service
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Starting forecast service in background...
⏳ Waiting for Forecast Service to be ready...
✅ Forecast Service is ready!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ Step 3/3: Starting Node.js Services
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 Starting API Core and Web App with Turbo...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ All Services Started!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Service URLs:
   🌐 Web App:          http://localhost:5173
   🔌 API Core:         http://localhost:4000
   🔮 Forecast Service: http://localhost:8000
   📊 Grafana:          http://localhost:3003
   📦 MinIO Console:    http://localhost:9101

🔑 Default Login:
   Email:    admin@pharmacy.com
   Password: admin123

⏹️  To stop all services:
   Press Ctrl+C, then run: pnpm stop

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Packages in scope: api-core, sdk-client, shared-types, web
• Running dev in 4 packages
• Remote caching disabled

api-core:dev: Server listening on http://localhost:4000
web:dev: Local: http://localhost:5173/
```

## Stopping All Services

### Option 1: Graceful Shutdown

Press **Ctrl+C** to stop the Node.js apps, then run:

```bash
pnpm stop
```

This stops:
- Python forecast service
- Docker containers

### Option 2: Quick Stop

Just press **Ctrl+C** twice (stops Node.js apps, leaves Docker/Python running)

### Option 3: Full Cleanup

```bash
pnpm stop
```

Stops everything cleanly.

## Accessing Your App

Once started, open your browser to:

**Main App:** http://localhost:5173

**Login:**
- Email: `admin@pharmacy.com`
- Password: `admin123`

**Other URLs:**
- API Docs: http://localhost:4000/docs
- Grafana: http://localhost:3003
- MinIO: http://localhost:9101
- MailHog: http://localhost:8026

## How It Works

### Script Flow

```
pnpm dev
    ↓
scripts/start-all.sh
    ↓
1. Check Docker, Python, pnpm installed
    ↓
2. Start Docker Compose
    ├── PostgreSQL (5433)
    ├── Redis (6380)
    ├── Meilisearch (7701)
    ├── MinIO (9100-9101)
    └── Prometheus, Grafana, MailHog
    ↓
3. Start Python Forecast Service (8000)
    ├── Create venv if needed
    ├── Install deps if needed
    └── Run in background (nohup)
    ↓
4. Start Turbo (Node.js apps)
    ├── API Core (4000)
    └── Web App (5173)
```

### Background Services

The Python forecast service runs in the **background** using `nohup`:
- Logs to: `apps/svc-forecast/forecast.log`
- PID stored in: `apps/svc-forecast/forecast.pid`
- Stopped by: `pnpm stop` or `scripts/stop-all.sh`

### Smart Detection

The script is smart:
- **Skips** starting Docker if already running
- **Skips** starting Python if port 8000 in use
- **Creates** Python venv if missing
- **Installs** dependencies if missing
- **Waits** for services to be ready before continuing

## Troubleshooting

### "Docker is not running"

Start Docker Desktop, then run `pnpm dev` again.

### "Port already in use"

Check which ports are in use:
```bash
lsof -i :5173  # Web app
lsof -i :4000  # API
lsof -i :8000  # Python service
```

Kill conflicting processes:
```bash
kill -9 <PID>
```

Or stop with:
```bash
pnpm stop
```

### Python service won't start

**Check Python version:**
```bash
python3 --version
```

Must be 3.9+.

**Manually start to see errors:**
```bash
cd apps/svc-forecast
source venv/bin/activate
python main.py
```

### Services start but app doesn't work

**Check all services are healthy:**
```bash
# Docker
docker ps

# Python
curl http://localhost:8000/health

# API
curl http://localhost:4000/health
```

**Check logs:**
```bash
# Python
tail -f apps/svc-forecast/forecast.log

# Docker
docker-compose -f infra/docker/docker-compose.yml logs -f

# API (check terminal output)
```

### First time setup

If this is your first time running:

1. **Database needs setup:**
   ```bash
   cd apps/api-core
   DATABASE_URL="postgresql://pharmacy:pharmacy123@localhost:5433/pharmacy_pos" pnpm db:push
   DATABASE_URL="postgresql://pharmacy:pharmacy123@localhost:5433/pharmacy_pos" pnpm db:seed
   ```

2. **Then start:**
   ```bash
   pnpm dev
   ```

## Development Workflow

### Daily Usage

**Start working:**
```bash
pnpm dev
```

**Stop when done:**
```bash
# Press Ctrl+C
pnpm stop
```

### Making Changes

All services have **hot reload**:
- **TypeScript changes** → API auto-reloads (tsx watch)
- **React changes** → Web app auto-reloads (Vite HMR)
- **Python changes** → Forecast service auto-reloads (uvicorn --reload)

Just edit and save - no restart needed!

### Database Changes

If you modify the Prisma schema:

```bash
cd apps/api-core
pnpm db:generate  # Regenerate client
DATABASE_URL="postgresql://pharmacy:pharmacy123@localhost:5433/pharmacy_pos" pnpm db:push  # Apply to DB
```

Then the API will auto-reload with new types.

## Alternative Commands

### Start only Node.js apps (skip Docker/Python)

```bash
pnpm dev:apps
```

Useful if Docker and Python are already running.

### Stop all services

```bash
pnpm stop
```

### Start services individually

If you prefer manual control:

```bash
# Terminal 1: Docker
./infra/docker/start.sh

# Terminal 2: Python
cd apps/svc-forecast && ./start.sh

# Terminal 3: Node.js
pnpm dev:apps
```

## Scripts Reference

| Command | What It Does |
|---------|--------------|
| `pnpm dev` | Start everything (Docker + Python + Node.js) |
| `pnpm dev:apps` | Start only Node.js apps |
| `pnpm stop` | Stop all services |
| `pnpm build` | Build for production |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run all tests |
| `pnpm typecheck` | Type check all packages |

## Files Created

- `scripts/start-all.sh` - Unified startup script
- `scripts/stop-all.sh` - Unified stop script
- `package.json` - Updated with new commands

## Benefits

✅ **One command** to start everything  
✅ **Smart detection** of what's already running  
✅ **Automatic setup** of Python environment  
✅ **Background services** (Python runs in background)  
✅ **Clean shutdown** with `pnpm stop`  
✅ **Hot reload** for all services  
✅ **Easy debugging** - logs in separate files  

## Summary

**Before:**
- 3 separate terminals
- Manual Docker start
- Manual Python start
- Manual Node.js start

**After:**
- 1 command: `pnpm dev`
- Everything starts automatically
- Services run in background
- Hot reload enabled
- Easy to stop: `pnpm stop`

**Just run `pnpm dev` and start coding!** 🚀
