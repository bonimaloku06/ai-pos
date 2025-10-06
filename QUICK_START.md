# 🚀 Quick Start Guide

## Start Everything

### 1. Start Docker Services
```bash
./infra/docker/start.sh
```

Wait until all containers show "healthy" status.

### 2. Start Application
```bash
pnpm dev
```

This starts:
- API Core on http://localhost:4000
- Web App on http://localhost:5173

## Access Your Application

**Main App:**
- Web Interface: http://localhost:5173
- API Documentation: http://localhost:4000/docs

**Management Tools:**
- Grafana: http://localhost:3003 (admin/admin123)
- MinIO Console: http://localhost:9101 (minioadmin/minioadmin123)
- MailHog: http://localhost:8026
- Prometheus: http://localhost:9091

## Stop Everything

### Stop Application
Press `Ctrl+C` in the terminal running `pnpm dev`

### Stop Docker
```bash
./infra/docker/stop.sh
```

## Troubleshooting

### Application won't connect to services?

1. **Make sure Docker is running:**
   ```bash
   docker ps
   ```
   Should show 7 containers running.

2. **Restart everything:**
   ```bash
   ./infra/docker/stop.sh
   ./infra/docker/start.sh
   # Wait 10 seconds
   pnpm dev
   ```

### Port conflicts?

See [PROBLEM_SOLVED.md](PROBLEM_SOLVED.md) for detailed troubleshooting.

## Port Configuration

All services use **unique ports** to avoid conflicts:

| Service      | Port  |
|--------------|-------|
| Web App      | 5173  |
| API Core     | 4000  |
| PostgreSQL   | 5433  |
| Redis        | 6380  |
| Meilisearch  | 7701  |
| MinIO API    | 9100  |
| MinIO Console| 9101  |
| Prometheus   | 9091  |
| Grafana      | 3003  |
| MailHog UI   | 8026  |

## First Time Setup

If this is your first time:

```bash
# 1. Install dependencies
pnpm install

# 2. Start Docker
./infra/docker/start.sh

# 3. Setup database
cd apps/api-core
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 4. Go back to root and start
cd ../..
pnpm dev
```

## Development Workflow

```bash
# Start Docker (once)
./infra/docker/start.sh

# Start development
pnpm dev

# Keep Docker running while you work...
# When done for the day:
./infra/docker/stop.sh
```

---

**That's it!** You're ready to develop. 🎉

For more details, see:
- [README.md](README.md) - Full documentation
- [PROBLEM_SOLVED.md](PROBLEM_SOLVED.md) - Port configuration details
- [APPLICATION_CONFIG_UPDATED.md](APPLICATION_CONFIG_UPDATED.md) - Configuration changes
