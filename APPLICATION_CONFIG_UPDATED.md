# Application Configuration Updated ✅

## Problem

After fixing Docker port conflicts, the application tried to connect to services on **old ports**:
- Meilisearch: 7700 (old) instead of 7701 (new)
- Redis: 6379 (old) instead of 6380 (new)
- MinIO: 9000 (old) instead of 9100 (new)

**Error:**
```
Failed to initialize Meilisearch: MeiliSearchRequestError: 
Request to http://localhost:7700/indexes/products/settings/searchable-attributes has failed
```

## Solution Applied ✅

### 1. Updated Default Ports in `apps/api-core/src/config.ts`

**Changed:**
```typescript
// Before
redis: {
  url: process.env.REDIS_URL || "redis://localhost:6379",
},
meilisearch: {
  host: process.env.MEILI_HOST || "http://localhost:7700",
},
s3: {
  endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
},

// After
redis: {
  url: process.env.REDIS_URL || "redis://localhost:6380",
},
meilisearch: {
  host: process.env.MEILI_HOST || "http://localhost:7701",
},
s3: {
  endpoint: process.env.S3_ENDPOINT || "http://localhost:9100",
},
```

### 2. Fixed .env Loading Path

**Changed:**
```typescript
// Before
import dotenv from "dotenv";
dotenv.config();

// After
import dotenv from "dotenv";
import path from "path";

// Load .env from project root (works when running from monorepo)
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
```

This ensures the `.env` file is loaded correctly when running from the monorepo root with Turbo.

### 3. Updated README.md

All documentation now reflects the new ports:
- PostgreSQL: 5433
- Redis: 6380
- Meilisearch: 7701
- MinIO: 9100/9101
- Prometheus: 9091
- Grafana: 3003
- MailHog: 1026/8026

## How to Start the Application

### 1. Start Docker Services

```bash
./infra/docker/start.sh
```

Or manually:
```bash
cd infra/docker
docker-compose --env-file ../../.env up -d
```

### 2. Start Application Services

**Option A: All services at once (using Turbo)**
```bash
pnpm dev
```

**Option B: Individual services**
```bash
# Terminal 1: API
cd apps/api-core
pnpm dev              # http://localhost:4000

# Terminal 2: Web
cd apps/web
pnpm dev              # http://localhost:5173
```

## Environment Variables

Your `.env` file should have these port configurations:

```bash
# Docker Port Mappings
POSTGRES_PORT=5433
REDIS_PORT=6380
MEILI_PORT=7701
MINIO_API_PORT=9100
MINIO_CONSOLE_PORT=9101
PROMETHEUS_PORT=9091
GRAFANA_PORT=3003
MAILHOG_SMTP_PORT=1026
MAILHOG_UI_PORT=8026

# Application Connection URLs
DATABASE_URL=postgresql://pharmacy:pharmacy123@localhost:5433/pharmacy_pos
REDIS_URL=redis://localhost:6380
MEILI_HOST=http://localhost:7701
MEILI_MASTER_KEY=masterKey123456
S3_ENDPOINT=http://localhost:9100
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
SMTP_PORT=1026
```

## Verification

After starting, verify all services are connected:

### Check Docker Services
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Should show all containers as "Up" and "healthy".

### Check API Logs
The API should start without errors:
```
✅ Server listening on http://localhost:4000
✅ API Documentation available at http://localhost:4000/docs
✅ Meilisearch initialized
✅ Redis connected
```

### Test Connections

**API Health:**
```bash
curl http://localhost:4000/health
```

**Meilisearch:**
```bash
curl http://localhost:7701/health
```

**Redis:**
```bash
redis-cli -p 6380 ping
```

**PostgreSQL:**
```bash
psql -h localhost -p 5433 -U pharmacy -d pharmacy_pos -c "SELECT 1;"
```

## Access Points

### Application URLs
- **Web App**: http://localhost:5173
- **API Core**: http://localhost:4000
- **API Docs**: http://localhost:4000/docs

### Service URLs
- **Grafana**: http://localhost:3003 (admin/admin123)
- **MinIO Console**: http://localhost:9101 (minioadmin/minioadmin123)
- **MailHog UI**: http://localhost:8026
- **Prometheus**: http://localhost:9091
- **Meilisearch**: http://localhost:7701

## Files Modified

1. ✅ `apps/api-core/src/config.ts` - Updated default ports
2. ✅ `README.md` - Updated port documentation
3. ✅ `.env` - Contains all new port configurations (already updated)
4. ✅ `infra/docker/docker-compose.yml` - Uses environment variables (already updated)

## Troubleshooting

### "Connection refused" errors

1. **Check Docker is running:**
   ```bash
   docker ps
   ```

2. **Check .env is loaded:**
   ```bash
   # In api-core directory
   node -e "require('dotenv').config({path:'../../.env'}); console.log(process.env.MEILI_HOST)"
   ```
   Should output: `http://localhost:7701`

3. **Restart services:**
   ```bash
   # Stop Docker
   ./infra/docker/stop.sh
   
   # Start Docker
   ./infra/docker/start.sh
   
   # Restart app
   pnpm dev
   ```

### "Port already in use"

If you see this for ports 5173 or 4000:
```bash
# Find what's using the port
lsof -i :4000
lsof -i :5173

# Kill the process
kill -9 <PID>
```

### Environment not loading

Make sure you're running `pnpm dev` from the **project root**, not from individual app directories, so the `.env` path resolution works correctly.

## Summary

✅ **All default ports updated** to match new Docker configuration  
✅ **Environment loading fixed** for monorepo structure  
✅ **Documentation updated** with correct ports  
✅ **Ready to start** - Run `pnpm dev` from project root  

Your application should now connect to all Docker services successfully! 🚀
