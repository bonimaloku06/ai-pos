# Docker Port Management Guide

## Problem Explanation

When running multiple Docker projects on the same machine, port conflicts occur because:

1. **Ports are shared system resources** - Only one process can bind to a specific port at a time
2. **Docker default ports clash** - Most projects use standard ports (5432 for PostgreSQL, 6379 for Redis, etc.)
3. **First-come-first-served** - The first container to start claims the port; subsequent containers fail

### The Error You Saw

```
Error: ports are not available: exposing port TCP 0.0.0.0:6379 -> 127.0.0.1:0: 
listen tcp 0.0.0.0:6379: bind: address already in use
```

This means another Docker container or service is already using port 6379.

## The Solution: Project-Specific External Ports

### How It Works

Docker port mapping format: `HOST_PORT:CONTAINER_PORT`

- **CONTAINER_PORT** (right side) - Internal port inside the container (stays standard)
- **HOST_PORT** (left side) - External port on your machine (made unique per project)

**Example:** `6380:6379` means:
- Container internally uses port 6379 (Redis default)
- Your machine exposes it on port 6380 (unique to this project)
- Your app connects to `localhost:6380`

### Changes Made

#### 1. Docker Compose with Environment Variables

Each service now uses configurable external ports with sensible defaults:

| Service       | Old Port(s) | New Port(s) | Environment Variable(s)           |
|--------------|-------------|-------------|-----------------------------------|
| PostgreSQL   | 5432        | 5433        | `POSTGRES_PORT`                   |
| Redis        | 6379        | 6380        | `REDIS_PORT`                      |
| Meilisearch  | 7700        | 7701        | `MEILI_PORT`                      |
| MinIO API    | 9000        | 9100        | `MINIO_API_PORT`                  |
| MinIO Console| 9001        | 9101        | `MINIO_CONSOLE_PORT`              |
| Prometheus   | 9090        | 9091        | `PROMETHEUS_PORT`                 |
| MailHog SMTP | 1025        | 1026        | `MAILHOG_SMTP_PORT`               |
| MailHog UI   | 8025        | 8026        | `MAILHOG_UI_PORT`                 |
| Grafana      | 3000        | 3001        | (already unique)                  |

#### 2. Updated .env File

All connection URLs now reference the new ports:

```bash
DATABASE_URL=postgresql://pharmacy:pharmacy123@localhost:5433/pharmacy_pos
REDIS_URL=redis://localhost:6380
MEILI_HOST=http://localhost:7701
S3_ENDPOINT=http://localhost:9100
SMTP_PORT=1026
```

## Usage

### Starting Services

```bash
cd infra/docker
docker-compose up -d
```

The services will now start on their unique ports without conflicts.

### Stopping Services

```bash
docker-compose down
```

### Checking Service Status

```bash
docker-compose ps
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f redis
docker-compose logs -f postgres
```

## Accessing Services

After starting Docker:

- **PostgreSQL**: `localhost:5433`
- **Redis**: `localhost:6380`
- **Meilisearch**: http://localhost:7701
- **MinIO Console**: http://localhost:9101
- **MinIO API**: http://localhost:9100
- **Prometheus**: http://localhost:9091
- **Grafana**: http://localhost:3001 (admin/admin123)
- **MailHog UI**: http://localhost:8026

## Customizing Ports

### For This Project

Edit `.env` file to change ports:

```bash
# Change Redis to port 6381 instead of 6380
REDIS_PORT=6381
REDIS_URL=redis://localhost:6381
```

### For Different Environments

Create environment-specific files:

```bash
# .env.local - for local development
POSTGRES_PORT=5433

# .env.staging - for staging environment
POSTGRES_PORT=5434
```

Then start with:
```bash
docker-compose --env-file .env.staging up -d
```

## Troubleshooting

### Finding What's Using a Port

```bash
# macOS/Linux
lsof -i :6379

# See all Docker containers
docker ps -a

# See which containers are using your ports
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

### Stopping Conflicting Containers

```bash
# Stop specific container
docker stop container-name

# Stop all containers from another project
cd /path/to/other/project
docker-compose down
```

### Port Already in Use Despite Stopping

```bash
# Force remove all stopped containers
docker container prune -f

# Restart Docker Desktop (macOS)
# Or restart Docker daemon (Linux)
```

### Checking Available Ports

```bash
# Test if a port is free
nc -zv localhost 6379

# If port is free: "Connection refused" ✓
# If port is in use: "succeeded!" ✗
```

## Best Practices

1. **Use environment variables** - Never hardcode ports in docker-compose.yml
2. **Document your ports** - Keep a port allocation table for all your projects
3. **Use consistent port ranges** - E.g., Project A: 5430-5439, Project B: 5440-5449
4. **Include Grafana port** - Already at 3001 to avoid conflict with common dev servers
5. **Stop services when not in use** - Free up resources and prevent conflicts
6. **Use `.env` for local overrides** - Keep `.env.example` with defaults, `.env` for personal settings

## Port Allocation Strategy

For multiple projects, consider this approach:

```
Pharmacy POS:     5433, 6380, 7701, 9100-9101, 9091, 1026, 8026
E-commerce App:   5434, 6381, 7702, 9102-9103, 9092, 1027, 8027
Blog Platform:    5435, 6382, 7703, 9104-9105, 9093, 1028, 8028
```

## Preventing Future Conflicts

1. **Before starting a new project**, check existing port allocations
2. **Use high port numbers** (> 5000) to avoid system service conflicts
3. **Document port assignments** in each project's README
4. **Use Docker networks** for inter-service communication (doesn't need port exposure)
5. **Consider Docker profiles** for optional services

## Quick Reference

### Start This Project
```bash
cd infra/docker && docker-compose up -d
```

### Stop This Project
```bash
cd infra/docker && docker-compose down
```

### Start Without Conflicts
The configuration now ensures this project won't conflict with others using standard ports.

### Check All Running Containers
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

---

**Note**: Remember to restart your application after changing port configurations to pick up the new `.env` values.
