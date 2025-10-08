# Configuration Errors Fixed ✅

## Problem Summary

After updating Docker ports to avoid conflicts, the application code was still trying to connect to the **old ports**, causing connection errors:

```
Error: connect ECONNREFUSED 127.0.0.1:6380  (Redis - should be 16380)
Request to http://localhost:7701/...has failed (Meilisearch - should be 17701)
```

## Root Cause

Multiple configuration files had **hardcoded old port numbers** that weren't updated when we changed the Docker ports. The application was reading from these files instead of using the new port configuration.

## Files Fixed

### 1. `/apps/api-core/src/config.ts`

**Changed:**

- Default port: `3000` → `14000`
- Redis URL: `redis://localhost:6380` → `redis://localhost:16380`
- Meilisearch: `http://localhost:7701` → `http://localhost:17701`
- S3 endpoint: `http://localhost:9100` → `http://localhost:19100`
- Forecast service: `http://localhost:8000` → `http://localhost:18000`
- CORS origins: `http://localhost:5174` → `http://localhost:15174`

### 2. `/apps/api-core/.env`

**Updated all ports:**

```env
DATABASE_URL=postgresql://pharmacy:pharmacy123@localhost:15433/pharmacy_pos
REDIS_URL=redis://localhost:16380
REDIS_PORT=16380
MEILI_HOST=http://localhost:17701
S3_ENDPOINT=http://localhost:19100
FORECAST_SVC_URL=http://localhost:18000
API_CORE_URL=http://localhost:14000
SMTP_PORT=11026
PORT=14000
```

### 3. `/apps/svc-forecast/main.py`

**Changed:**

- Default API_CORE_URL: `http://localhost:4000` → `http://localhost:14000`
- Default PORT: `8000` → `18000`
- Port conflict check: Now checks for ports 3000 and 4000 to redirect to 14000

### 4. `/apps/svc-forecast/.env`

**Updated:**

```env
API_CORE_URL=http://localhost:14000
PORT=18000
```

### 5. `/apps/web/vite.config.ts`

**Changed:**

- Server port: `5174` → `15174`
- Proxy target: `http://localhost:4000` → `http://localhost:14000`

### 6. `/scripts/start-all.sh`

**Updated:**

- Wait for service checks: Updated to use new ports
- Port check: `8000` → `18000` for forecast service
- Display URLs: All updated to show new ports

## Port Mapping Summary

| Service       | Old Port | New Port  | Status |
| ------------- | -------- | --------- | ------ |
| API Core      | 4000     | **14000** | ✅     |
| Web Frontend  | 5174     | **15174** | ✅     |
| Forecast Svc  | 8000     | **18000** | ✅     |
| PostgreSQL    | 5433     | **15433** | ✅     |
| Redis         | 6380     | **16380** | ✅     |
| Meilisearch   | 7701     | **17701** | ✅     |
| MinIO API     | 9100     | **19100** | ✅     |
| MinIO Console | 9101     | **19101** | ✅     |
| Prometheus    | 9091     | **19091** | ✅     |
| Grafana       | 3002     | **13002** | ✅     |
| MailHog SMTP  | 1026     | **11026** | ✅     |
| MailHog UI    | 8026     | **18026** | ✅     |

## How to Apply Changes

### Option 1: Restart Your Development Server (Recommended)

1. **Stop the current dev server** (Ctrl+C in the terminal)

2. **Restart with the new configuration:**
   ```bash
   pnpm dev
   ```

### Option 2: Full Clean Restart

If you want to be extra sure everything is fresh:

1. **Stop all services:**

   ```bash
   # Stop dev server (Ctrl+C)
   ./scripts/stop-all.sh
   ./infra/docker/stop.sh
   ```

2. **Stop the forecast service if running separately:**

   ```bash
   # If you see a forecast.pid file
   kill $(cat apps/svc-forecast/forecast.pid) 2>/dev/null
   rm apps/svc-forecast/forecast.pid
   ```

3. **Start everything fresh:**
   ```bash
   pnpm dev
   ```

## Verification

After restarting, you should see:

✅ **No more connection errors**
✅ API Core connects to Redis on port 16380
✅ API Core connects to Meilisearch on port 17701
✅ Web app accessible at http://localhost:15174
✅ API accessible at http://localhost:14000
✅ Forecast service at http://localhost:18000

## What Was NOT Changed

These files were intentionally not modified because they use relative paths or environment variables:

- `/apps/web/src/lib/api-client.ts` - Uses relative "/api" path (proxied by Vite)
- Root `/.env` file - Already updated in previous step
- `docker-compose.yml` - Already updated in previous step

---

**Status**: ✅ **ALL CONFIGURATION FILES UPDATED**  
**Next Step**: **Restart your dev server** (`pnpm dev`)
