# Port Configuration Summary

## What Changed

Your pharmacy-pos project now uses **unique ports** to avoid conflicts with other Docker projects and services.

## Quick Reference

### Old Ports → New Ports

| Service       | Old        | New        |
|---------------|------------|------------|
| PostgreSQL    | 5432       | **5433**   |
| Redis         | 6379       | **6380**   |
| Meilisearch   | 7700       | **7701**   |
| MinIO API     | 9000       | **9100**   |
| MinIO Console | 9001       | **9101**   |
| Prometheus    | 9090       | **9091**   |
| MailHog SMTP  | 1025       | **1026**   |
| MailHog UI    | 8025       | **8026**   |
| Grafana       | 3001       | **3003**   |

## Connection URLs

### From Your Application

```bash
DATABASE_URL=postgresql://pharmacy:pharmacy123@localhost:5433/pharmacy_pos
REDIS_URL=redis://localhost:6380
MEILI_HOST=http://localhost:7701
S3_ENDPOINT=http://localhost:9100
SMTP_PORT=1026
```

### Web Interfaces

- MinIO Console: http://localhost:9101
- MailHog UI: http://localhost:8026
- Grafana: http://localhost:3003
- Prometheus: http://localhost:9091
- Meilisearch: http://localhost:7701

## Files Modified

1. **infra/docker/docker-compose.yml** - Port mappings now use environment variables
2. **.env** - All connection URLs updated with new ports

## How to Start

### Option 1: Using the Startup Script (Recommended)
```bash
./infra/docker/start.sh
```

### Option 2: Manual Start
```bash
cd infra/docker
docker-compose --env-file ../../.env up -d
```

## Why This Works

**Port Mapping**: `HOST:CONTAINER`

Example: `6380:6379` means:
- **6380** = Port on your machine (unique to this project)
- **6379** = Port inside container (Redis default, unchanged)

**Benefits**:
- ✅ No conflicts with other Docker projects
- ✅ No conflicts with system Redis (port 6379)
- ✅ Run multiple projects simultaneously
- ✅ Easy to customize per environment

## Customization

To change ports, edit `.env`:

```bash
# Example: Use different Redis port
REDIS_PORT=6390
REDIS_URL=redis://localhost:6390
```

Then restart:
```bash
docker-compose down && docker-compose up -d
```

## Documentation

- **DOCKER_PORT_MANAGEMENT.md** - Detailed explanation and best practices
- **FIX_PORT_CONFLICTS.md** - Step-by-step troubleshooting guide
- **IMMEDIATE_FIX.md** - Quick fix for current situation

## Your Current Setup

### System-wide Services
- Redis on port **6379** (used by other Node.js apps)

### Pharmacy POS (Docker)
- All services on unique ports (5433, 6380, 7701, etc.)

### Other Projects (Docker)
- Talent Flow - Stopped, no conflicts

**Everything can run simultaneously without conflicts!**
