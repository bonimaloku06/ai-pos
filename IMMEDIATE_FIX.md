# Immediate Fix for Docker Port Conflict

## Root Cause Identified ✓

You have a **standalone Redis server** (not Docker) running on port 6379:
- Process ID: 2820
- Used by 2 Node.js applications (PIDs: 90159, 90348)
- This is blocking Docker from using that port

## Solution Options

### Option 1: Use the New Ports (RECOMMENDED - No Downtime for Other Apps)

**This is already done!** Your pharmacy-pos project now uses unique ports.

Just restart your pharmacy-pos Docker containers:

```bash
# 1. Stop old containers
cd /Users/shabanmaloku/Desktop/Personal/AiPos/infra/docker
docker-compose down

# 2. Start with new ports
docker-compose up -d

# 3. Verify
docker-compose ps
```

**Your other Node.js apps keep running** - no disruption!

### Option 2: Stop Standalone Redis (If You Don't Need It)

⚠️ **WARNING**: This will stop Redis for your other Node.js applications!

```bash
# If installed via Homebrew
brew services stop redis

# Or kill the process
kill 2820

# Then start pharmacy-pos
cd /Users/shabanmaloku/Desktop/Personal/AiPos/infra/docker
docker-compose up -d
```

## What's Running Right Now

### Standalone Services (System-wide)
- **Redis** → Port 6379 (used by Node.js apps with PIDs 90159, 90348)

### Docker Containers (Pharmacy POS - OLD config)
- **PostgreSQL** → Port 5432 ❌ (conflicts with other projects)
- **Redis** → FAILED (tried port 6379) ❌
- **Meilisearch** → Port 7700 ⚠️
- **MinIO** → Ports 9000-9001 ⚠️
- **Prometheus** → Port 9090 ⚠️
- **MailHog** → Ports 1025, 8025 ✓

### Docker Containers (Pharmacy POS - NEW config will use)
- **PostgreSQL** → Port 5433 ✅
- **Redis** → Port 6380 ✅ (no conflict!)
- **Meilisearch** → Port 7701 ✅
- **MinIO** → Ports 9100-9101 ✅
- **Prometheus** → Port 9091 ✅
- **MailHog** → Ports 1026, 8026 ✅

## Quick Fix Commands

```bash
# Navigate to docker directory
cd /Users/shabanmaloku/Desktop/Personal/AiPos/infra/docker

# Stop existing containers
docker-compose down

# Start with new configuration
docker-compose up -d

# Check status
docker-compose ps

# View logs if needed
docker-compose logs -f
```

## Expected Output After Fix

```bash
$ docker-compose ps

NAME                      STATUS          PORTS
pharmacy-pos-db           Up (healthy)    0.0.0.0:5433->5432/tcp
pharmacy-pos-redis        Up (healthy)    0.0.0.0:6380->6379/tcp
pharmacy-pos-search       Up (healthy)    0.0.0.0:7701->7700/tcp
pharmacy-pos-storage      Up (healthy)    0.0.0.0:9100-9101->9000-9001/tcp
pharmacy-pos-prometheus   Up              0.0.0.0:9091->9090/tcp
pharmacy-pos-grafana      Up              0.0.0.0:3001->3000/tcp
pharmacy-pos-mail         Up              0.0.0.0:1026->1025/tcp, 0.0.0.0:8026->8025/tcp
```

## Verify Everything Works

After starting Docker:

```bash
# Test Redis connection (new port)
redis-cli -p 6380 ping
# Should return: PONG

# Test PostgreSQL (new port)
psql -h localhost -p 5433 -U pharmacy -d pharmacy_pos -c "SELECT 1;"
# Should return: 1

# Test Meilisearch (new port)
curl http://localhost:7701/health
# Should return: {"status":"available"}

# Test MinIO (new port)
curl http://localhost:9100/minio/health/live
# Should return: OK
```

## About Your Other Node.js Apps

The two Node.js processes (90159, 90348) using your standalone Redis won't be affected because:

1. They connect to Redis on port **6379** (standalone)
2. Pharmacy POS now uses Redis on port **6380** (Docker)
3. Both can run simultaneously without conflicts

### Identifying Your Node.js Apps

```bash
# See what these processes are
ps aux | grep 90159
ps aux | grep 90348

# Or get full command
ps -fp 90159
ps -fp 90348
```

## Future-Proof Strategy

### Port Allocation Table

Keep this reference:

| Project       | PostgreSQL | Redis | Meilisearch | Other        |
|---------------|------------|-------|-------------|--------------|
| System-wide   | -          | 6379  | -           | -            |
| Pharmacy POS  | 5433       | 6380  | 7701        | 9100-9101    |
| Talent Flow   | 5434       | 6381  | -           | 8108         |
| Next Project  | 5435       | 6382  | 7702        | 9102-9103    |

### Best Practices

1. **Always use unique ports** for each Docker project
2. **Document ports** in each project's README
3. **Use environment variables** for port configuration
4. **Check before starting**: `docker ps --format "table {{.Names}}\t{{.Ports}}"`
5. **Stop unused projects**: `docker-compose down` when not working on them

## Troubleshooting

### If You Still Get Errors

**"Network not found"**
```bash
docker network create pharmacy-pos-network
```

**"Port still in use"**
```bash
# Check what's on the port
lsof -i :6380

# If it's an old container
docker ps -a | grep redis
docker rm -f <container-id>
```

**"Connection refused" from app**
```bash
# Make sure .env has the new ports
cat .env | grep -E "(REDIS_PORT|DATABASE_URL|MEILI_HOST|S3_ENDPOINT)"

# Restart your Node.js application to pick up new .env
```

**"Unhealthy" container status**
```bash
# View container logs
docker-compose logs <service-name>

# Example
docker-compose logs redis
docker-compose logs postgres
```

## Summary

✅ **Changes Made**:
- Docker Compose: Uses environment variables for ports
- .env: All ports updated to unique values (5433, 6380, 7701, etc.)
- No conflict with your standalone Redis or other projects

✅ **Next Step**: 
Run `docker-compose down && docker-compose up -d` and you're good to go!

✅ **Benefits**:
- Run multiple projects simultaneously
- No port conflicts ever again
- Easy to customize per environment
- Other applications keep running

---

**Run this now:**
```bash
cd /Users/shabanmaloku/Desktop/Personal/AiPos/infra/docker && docker-compose down && docker-compose up -d && docker-compose ps
```
