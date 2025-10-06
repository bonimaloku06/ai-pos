# Pharmacy POS Docker Services

## Quick Start

### Start All Services
```bash
./start.sh
```

### Stop All Services
```bash
./stop.sh
```

## Service Ports

All services use **unique ports** to avoid conflicts with other Docker projects:

| Service       | External Port | Internal Port | URL                          |
|---------------|---------------|---------------|------------------------------|
| PostgreSQL    | 5433          | 5432          | localhost:5433               |
| Redis         | 6380          | 6379          | localhost:6380               |
| Meilisearch   | 7701          | 7700          | http://localhost:7701        |
| MinIO API     | 9100          | 9000          | http://localhost:9100        |
| MinIO Console | 9101          | 9001          | http://localhost:9101        |
| Prometheus    | 9091          | 9090          | http://localhost:9091        |
| Grafana       | 3003          | 3000          | http://localhost:3003        |
| MailHog SMTP  | 1026          | 1025          | localhost:1026               |
| MailHog UI    | 8026          | 8025          | http://localhost:8026        |

**Note:** External ports are what your application uses. Internal ports are what the service uses inside the container.

## Web Interfaces

- **Grafana**: http://localhost:3003
  - Username: `admin`
  - Password: `admin123`

- **MinIO Console**: http://localhost:9101
  - Username: `minioadmin`
  - Password: `minioadmin123`

- **MailHog**: http://localhost:8026
  - Email testing interface (no login required)

- **Prometheus**: http://localhost:9091
  - Metrics dashboard (no login required)

- **Meilisearch**: http://localhost:7701
  - Search API endpoint

## Manual Commands

If you prefer not to use the scripts:

### Start Services
```bash
cd /path/to/AiPos/infra/docker
docker-compose --env-file ../../.env up -d
```

### Stop Services
```bash
docker-compose --env-file ../../.env down
```

### View Logs
```bash
# All services
docker-compose --env-file ../../.env logs -f

# Specific service
docker-compose --env-file ../../.env logs -f redis
docker-compose --env-file ../../.env logs -f postgres
```

### Check Status
```bash
docker-compose --env-file ../../.env ps
```

### Restart a Service
```bash
docker-compose --env-file ../../.env restart redis
```

## Testing Connections

### Redis
```bash
# From host machine
redis-cli -p 6380 ping

# Inside container
docker exec pharmacy-pos-redis redis-cli ping
```

### PostgreSQL
```bash
# From host machine
psql -h localhost -p 5433 -U pharmacy -d pharmacy_pos

# Inside container
docker exec pharmacy-pos-db pg_isready -U pharmacy
```

### MinIO
```bash
curl http://localhost:9100/minio/health/live
```

### Meilisearch
```bash
curl http://localhost:7701/health
```

## Configuration

Port configuration is stored in `../../.env` (project root):

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
```

To change a port:
1. Edit `.env` in project root
2. Update corresponding URL in `.env` (e.g., `REDIS_URL=redis://localhost:NEW_PORT`)
3. Restart services: `./stop.sh && ./start.sh`

## Troubleshooting

### Port Already in Use

If you see "address already in use" error:

1. **Check what's using the port:**
   ```bash
   lsof -i :PORT
   ```

2. **Option A - Stop the conflicting service:**
   ```bash
   # If it's another Docker container
   docker stop container-name
   
   # If it's a system service
   brew services stop service-name
   ```

3. **Option B - Change the port in .env:**
   ```bash
   # Edit .env and change to a free port
   REDIS_PORT=6381
   REDIS_URL=redis://localhost:6381
   ```

### Container Won't Start

**View logs:**
```bash
docker-compose --env-file ../../.env logs service-name
```

**Force recreate:**
```bash
docker-compose --env-file ../../.env up -d --force-recreate service-name
```

### Environment Variables Not Loading

Make sure you're using `--env-file ../../.env` flag or use the provided scripts which handle this automatically.

### Check Container Health

```bash
docker-compose --env-file ../../.env ps
```

Look for "healthy" or "unhealthy" in the STATUS column.

### Reset Everything

⚠️ **WARNING:** This will delete all data!

```bash
docker-compose --env-file ../../.env down -v
docker-compose --env-file ../../.env up -d
```

## Data Persistence

Data is stored in Docker volumes:
- `postgres_data` - PostgreSQL database
- `redis_data` - Redis cache
- `meilisearch_data` - Search indices
- `minio_data` - Object storage
- `prometheus_data` - Metrics
- `grafana_data` - Dashboards

Volumes persist even when containers are stopped. Use `down -v` to delete them.

## Architecture

```
Host Machine (Your Mac)
├── Port 5433 → PostgreSQL Container (5432)
├── Port 6380 → Redis Container (6379)
├── Port 7701 → Meilisearch Container (7700)
├── Port 9100 → MinIO API Container (9000)
├── Port 9101 → MinIO Console Container (9001)
├── Port 9091 → Prometheus Container (9090)
├── Port 3003 → Grafana Container (3000)
└── Port 8026 → MailHog UI Container (8025)
```

**Why different ports?**
- Avoids conflicts with other Docker projects
- Avoids conflicts with system services (like standalone Redis on 6379)
- Allows multiple projects to run simultaneously

## Performance

All services are running as Docker containers on your machine. They use:
- Minimal CPU when idle
- RAM varies by service (check with `docker stats`)
- Data stored in Docker volumes (persistent)

To free up resources when not developing:
```bash
./stop.sh
```

## See Also

- **PROBLEM_SOLVED.md** - Detailed explanation of port conflicts and solution
- **PORT_SUMMARY.md** - Quick port reference
- **DOCKER_PORT_MANAGEMENT.md** - Best practices and port management guide
