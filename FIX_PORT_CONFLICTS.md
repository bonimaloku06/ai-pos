# Port Conflict Fix - Step by Step

## Current Situation

Your Docker shows:
- ✅ **talent_flow** containers stopped (good - no conflicts from them)
- ⚠️  **pharmacy-pos** containers running on OLD ports (need to restart with new config)
- ❌ Redis failed to start (port 6379 conflict - likely from another Redis instance)

## Step-by-Step Fix

### Step 1: Stop All Pharmacy POS Containers

```bash
cd /Users/shabanmaloku/Desktop/Personal/AiPos/infra/docker
docker-compose down
```

This stops and removes all pharmacy-pos containers.

### Step 2: Verify Port 6379 Availability

Check what's using port 6379:

```bash
lsof -i :6379
```

If something is there:
```bash
# If it's a Docker container
docker ps -a | grep redis
docker stop <container-name>

# If it's a standalone Redis
brew services stop redis

# Or kill the process
kill -9 <PID>
```

### Step 3: Clean Up Old Containers (Optional but Recommended)

```bash
# Remove stopped containers
docker container prune -f

# Remove unused networks
docker network prune -f
```

### Step 4: Verify New Configuration

Check your .env file has the new ports:

```bash
cat /Users/shabanmaloku/Desktop/Personal/AiPos/.env | grep PORT
```

You should see:
```
POSTGRES_PORT=5433
REDIS_PORT=6380
MEILI_PORT=7701
MINIO_API_PORT=9100
MINIO_CONSOLE_PORT=9101
PROMETHEUS_PORT=9091
MAILHOG_SMTP_PORT=1026
MAILHOG_UI_PORT=8026
```

### Step 5: Start Services with New Ports

```bash
cd /Users/shabanmaloku/Desktop/Personal/AiPos/infra/docker
docker-compose up -d
```

### Step 6: Verify Everything Is Running

```bash
docker-compose ps
```

All services should show "Up" status.

### Step 7: Test Connections

```bash
# Test PostgreSQL
docker exec pharmacy-pos-db pg_isready -U pharmacy

# Test Redis
docker exec pharmacy-pos-redis redis-cli ping

# Test Meilisearch
curl http://localhost:7701/health

# Test MinIO
curl http://localhost:9100/minio/health/live
```

## If You Still Get Conflicts

### Find ALL Redis Instances

```bash
# Check system Redis
brew services list | grep redis

# Check all Docker Redis containers
docker ps -a | grep redis

# Check what's on port 6379
lsof -i :6379
```

### Option A: Stop Other Redis

```bash
# If it's from another Docker project
docker stop <other-redis-container>

# If it's system Redis
brew services stop redis
```

### Option B: Change Pharmacy POS to Even Higher Port

Edit `.env`:
```bash
REDIS_PORT=6390
REDIS_URL=redis://localhost:6390
```

Then restart:
```bash
docker-compose down && docker-compose up -d
```

## Quick Commands

### Restart All Services
```bash
cd /Users/shabanmaloku/Desktop/Personal/AiPos/infra/docker
docker-compose restart
```

### View Logs
```bash
# All services
docker-compose logs -f

# Just Redis
docker-compose logs -f redis

# Just Postgres
docker-compose logs -f postgres
```

### Check Port Mappings
```bash
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep pharmacy
```

## Expected Result

After completing these steps, you should see:

```
pharmacy-pos-db        - Running on 5433:5432
pharmacy-pos-redis     - Running on 6380:6379  
pharmacy-pos-search    - Running on 7701:7700
pharmacy-pos-storage   - Running on 9100-9101:9000-9001
pharmacy-pos-prometheus- Running on 9091:9090
pharmacy-pos-grafana   - Running on 3001:3000
pharmacy-pos-mail      - Running on 1026:1025, 8026:8025
```

## Prevention for Future

### Before Starting Any Project

1. **Check your port allocation**:
```bash
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

2. **Document ports in your projects**:
   - Pharmacy POS: Uses 543x, 638x, 770x, 91xx
   - Talent Flow: Uses 543x, 639x, 771x (different ranges)
   - Next Project: Use 544x, 640x, 772x

3. **Create a global port map** (save as `~/docker-ports.md`):
```markdown
# My Docker Port Allocations

## Pharmacy POS
- PostgreSQL: 5433
- Redis: 6380
- Meilisearch: 7701
- MinIO: 9100-9101

## Talent Flow  
- PostgreSQL: 5434
- Typesense: 8108
- ...

## Available Ranges
- PostgreSQL: 5435+
- Redis: 6381+
- ...
```

## Troubleshooting

### "Network not found" error
```bash
docker network create pharmacy-pos-network
```

### "Volume in use" error
```bash
docker-compose down -v  # Warning: deletes data!
# Or
docker volume ls | grep pharmacy
docker volume rm <volume-name>
```

### Services not picking up .env changes
```bash
# Force recreate
docker-compose up -d --force-recreate

# Or completely rebuild
docker-compose down
docker-compose up -d --build
```

### Check if ports are actually free
```bash
# macOS
lsof -i :5433
lsof -i :6380
lsof -i :7701

# Should return nothing if free
```

---

**Next Steps**: Follow the steps above, then your Docker services will start without conflicts!
