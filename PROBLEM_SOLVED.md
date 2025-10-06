# ✅ Docker Port Conflict - SOLVED

## Problem Summary

When starting your pharmacy-pos Docker containers, you encountered:
```
Error: ports are not available: exposing port TCP 0.0.0.0:6379 -> 127.0.0.1:0: 
listen tcp 0.0.0.0:6379: bind: address already in use
```

**Root Cause:**
- You have a **standalone Redis server** running on port 6379 (used by other Node.js apps)
- You have **multiple Docker projects** (pharmacy-pos, talent_flow) competing for the same default ports
- Another Node.js app was using port 3001 (Grafana's original port)
- Another Node.js app was using port 3002 (attempted Grafana port)

## Solution Implemented ✅

### 1. Changed All Ports to Unique Values

| Service       | Old Port   | New Port   | Status |
|---------------|------------|------------|--------|
| PostgreSQL    | 5432       | **5433**   | ✅     |
| Redis         | 6379       | **6380**   | ✅     |
| Meilisearch   | 7700       | **7701**   | ✅     |
| MinIO API     | 9000       | **9100**   | ✅     |
| MinIO Console | 9001       | **9101**   | ✅     |
| Prometheus    | 9090       | **9091**   | ✅     |
| Grafana       | 3001       | **3003**   | ✅     |
| MailHog SMTP  | 1025       | **1026**   | ✅     |
| MailHog UI    | 8025       | **8026**   | ✅     |

### 2. Made Configuration Flexible

**Modified Files:**
- `infra/docker/docker-compose.yml` - Uses environment variables for all ports
- `.env` - Contains all port configurations

**Example port mapping:**
```yaml
ports:
  - "${REDIS_PORT:-6380}:6379"
```
This means:
- Use `REDIS_PORT` from .env if set
- Otherwise, default to 6380
- Inside container, Redis still uses 6379 (no code changes needed)

### 3. Updated Connection URLs

All services in `.env` now use the new ports:
```bash
DATABASE_URL=postgresql://pharmacy:pharmacy123@localhost:5433/pharmacy_pos
REDIS_URL=redis://localhost:6380
MEILI_HOST=http://localhost:7701
S3_ENDPOINT=http://localhost:9100
SMTP_PORT=1026
```

### 4. Created Easy Startup Scripts

**Start services:**
```bash
./infra/docker/start.sh
```

**Stop services:**
```bash
./infra/docker/stop.sh
```

## Current Status

All containers are running successfully! 🎉

```
✅ pharmacy-pos-db           → localhost:5433 (healthy)
✅ pharmacy-pos-redis        → localhost:6380 (healthy)
✅ pharmacy-pos-search       → localhost:7701 (running)
✅ pharmacy-pos-storage      → localhost:9100-9101 (healthy)
✅ pharmacy-pos-prometheus   → localhost:9091 (running)
✅ pharmacy-pos-grafana      → localhost:3003 (running)
✅ pharmacy-pos-mail         → localhost:1026, 8026 (running)
```

## What's Running on Your System

### Standalone Services (Not Docker)
- **Redis** on port 6379 → Used by 2 Node.js apps (PIDs: 90159, 90348)
- **Node.js app** on port 3001 → Unknown app
- **Node.js app** on port 3002 → Unknown app

### Docker - Pharmacy POS (This Project)
- All services on unique ports (5433, 6380, 7701, etc.)

### Docker - Talent Flow (Stopped)
- No conflicts - can run alongside pharmacy-pos

## Why This Won't Happen Again

### 1. Environment-Based Configuration
Ports are configurable via `.env` - easy to change if needed:
```bash
REDIS_PORT=6390  # Change to any free port
```

### 2. Project-Specific Ports
Each project now has its own port range:
- **Pharmacy POS**: 5433, 6380, 7701, 9100-9101, 9091, 3003
- **Talent Flow**: Can use 5434, 6381, 7702, etc.
- **Future Projects**: Use next available range

### 3. Easy Startup
Use `./infra/docker/start.sh` - automatically handles environment configuration

### 4. Documentation
Multiple reference docs created:
- **PORT_SUMMARY.md** - Quick reference
- **DOCKER_PORT_MANAGEMENT.md** - Complete guide
- **FIX_PORT_CONFLICTS.md** - Troubleshooting steps

## How to Use

### Start Your Services
```bash
# Option 1: Easy way
./infra/docker/start.sh

# Option 2: Manual
cd infra/docker
docker-compose --env-file ../../.env up -d
```

### Stop Your Services
```bash
# Option 1: Easy way
./infra/docker/stop.sh

# Option 2: Manual
cd infra/docker
docker-compose --env-file ../../.env down
```

### View Logs
```bash
cd infra/docker
docker-compose --env-file ../../.env logs -f
```

### Check Status
```bash
cd infra/docker
docker-compose --env-file ../../.env ps
```

## Access Your Services

### Database Connections
```bash
# PostgreSQL
psql -h localhost -p 5433 -U pharmacy -d pharmacy_pos

# Redis
redis-cli -p 6380
```

### Web Interfaces
- **MinIO Console**: http://localhost:9101 (minioadmin/minioadmin123)
- **Grafana**: http://localhost:3003 (admin/admin123)
- **MailHog UI**: http://localhost:8026
- **Prometheus**: http://localhost:9091
- **Meilisearch**: http://localhost:7701

## For Future Projects

When starting a new project with Docker:

1. **Check existing ports:**
   ```bash
   docker ps --format "table {{.Names}}\t{{.Ports}}"
   lsof -i :PORT
   ```

2. **Choose unique port range:**
   - Project A: 543x, 638x, 770x
   - Project B: 544x, 639x, 771x
   - Project C: 545x, 640x, 772x

3. **Use environment variables** in docker-compose.yml:
   ```yaml
   ports:
     - "${SERVICE_PORT:-5435}:5432"
   ```

4. **Document ports** in project README

## Key Takeaways

✅ **Problem:** Port conflicts between standalone services and Docker containers  
✅ **Solution:** Use unique, configurable ports via environment variables  
✅ **Result:** All services running without conflicts  
✅ **Future:** Easy to customize and won't break other projects  

---

**Your pharmacy-pos project is now ready to use!** 🚀

No more port conflicts. All services running smoothly. Other projects won't be affected.
