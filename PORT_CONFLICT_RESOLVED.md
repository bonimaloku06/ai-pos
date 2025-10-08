# Port Conflict Issue - RESOLVED ✅

## Problem

Docker Compose was failing to start with the error:

```
Error response from daemon: failed to set up container networking:
driver failed programming external connectivity on endpoint pharmacy-pos-db:
Bind for 0.0.0.0:5433 failed: port is already allocated
```

Port 5433 (and potentially other ports) were already in use by other projects.

## Solution

Updated all service ports to use **higher port ranges (10000+)** which are less likely to conflict with other development projects.

## Changes Made

### 1. Updated `docker-compose.yml`

Changed all port mappings to use environment variables with new defaults:

- API Core: `4000` → `14000`
- Forecast Service: `8000` → `18000`
- Web Frontend: `5174` → `15174`
- PostgreSQL: `5433` → `15433`
- Redis: `6380` → `16380`
- Meilisearch: `7701` → `17701`
- MinIO API: `9100` → `19100`
- MinIO Console: `9101` → `19101`
- Prometheus: `9091` → `19091`
- Grafana: `3002` → `13002`
- MailHog SMTP: `1026` → `11026`
- MailHog UI: `8026` → `18026`

### 2. Updated `.env` file

Updated all port references in the environment configuration file to match the new port scheme.

### 3. Updated Scripts

- `infra/docker/start.sh` - Made `.env` file optional, updated displayed port numbers
- `infra/docker/stop.sh` - Made `.env` file optional

### 4. Updated Documentation

- `QUICK_START.md` - Updated all port references
- `PORT_CONFIGURATION.md` - Created comprehensive port documentation

## New Port Configuration

| Service          | Old Port | New Port  | Description            |
| ---------------- | -------- | --------- | ---------------------- |
| API Core         | 4000     | **14000** | Main API server        |
| Forecast Service | 8000     | **18000** | AI forecasting service |
| Web UI           | 5174     | **15174** | Frontend application   |
| PostgreSQL       | 5433     | **15433** | Database server        |
| Redis            | 6380     | **16380** | Cache & queue          |
| Meilisearch      | 7701     | **17701** | Search engine          |
| MinIO API        | 9100     | **19100** | Object storage API     |
| MinIO Console    | 9101     | **19101** | Object storage UI      |
| Prometheus       | 9091     | **19091** | Metrics collection     |
| Grafana          | 3002     | **13002** | Metrics dashboard      |
| MailHog SMTP     | 1026     | **11026** | Email testing (SMTP)   |
| MailHog UI       | 8026     | **18026** | Email testing (Web UI) |

## Verification

All services are now running successfully:

```bash
$ docker-compose ps
NAME                      STATUS                    PORTS
pharmacy-pos-db           Up (healthy)              0.0.0.0:15433->5432/tcp
pharmacy-pos-grafana      Up                        0.0.0.0:13002->3000/tcp
pharmacy-pos-mail         Up                        0.0.0.0:11026->1025/tcp, 0.0.0.0:18026->8025/tcp
pharmacy-pos-prometheus   Up                        0.0.0.0:19091->9090/tcp
pharmacy-pos-redis        Up (healthy)              0.0.0.0:16380->6379/tcp
pharmacy-pos-search       Up (healthy)              0.0.0.0:17701->7700/tcp
pharmacy-pos-storage      Up (healthy)              0.0.0.0:19100->9000/tcp, 0.0.0.0:19101->9001/tcp
```

## Access URLs (Updated)

After starting services, access them at:

- **Web Application**: http://localhost:15174
- **API Server**: http://localhost:14000
- **Forecast Service**: http://localhost:18000
- **Grafana Dashboard**: http://localhost:13002 (admin/admin123)
- **MinIO Console**: http://localhost:19101 (minioadmin/minioadmin123)
- **MailHog UI**: http://localhost:18026
- **Prometheus**: http://localhost:19091

## Database Connection String (Updated)

```
postgresql://pharmacy:pharmacy123@localhost:15433/pharmacy_pos
```

## How to Start Services

```bash
# Start infrastructure services
./infra/docker/start.sh

# Start application (in separate terminal)
pnpm dev

# Stop services
./infra/docker/stop.sh
```

## Custom Port Configuration

To use different ports, edit `.env` file and change any of these variables:

- `API_PORT`
- `FORECAST_PORT`
- `WEB_PORT`
- `POSTGRES_PORT`
- `REDIS_PORT`
- `MEILI_PORT`
- `MINIO_API_PORT`
- `MINIO_CONSOLE_PORT`
- `PROMETHEUS_PORT`
- `GRAFANA_PORT`
- `MAILHOG_SMTP_PORT`
- `MAILHOG_UI_PORT`

## Benefits

✅ **No More Port Conflicts** - High port numbers (10000+) rarely conflict with other projects
✅ **Easy Customization** - All ports configurable via environment variables
✅ **Clear Documentation** - Comprehensive port mapping documentation
✅ **Flexible Setup** - `.env` file is optional; defaults work out of the box

## Files Modified

1. `/infra/docker/docker-compose.yml` - Updated all port mappings
2. `/.env` - Updated all port references
3. `/infra/docker/start.sh` - Updated port display and made .env optional
4. `/infra/docker/stop.sh` - Made .env optional
5. `/QUICK_START.md` - Updated documentation
6. `/PORT_CONFIGURATION.md` - Created (new file)
7. `/PORT_CONFLICT_RESOLVED.md` - This document (new file)

---

**Issue Status**: ✅ **RESOLVED**  
**Date**: October 8, 2025  
**All services are running successfully with no port conflicts!**
