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

- API Core on http://localhost:14000
- Web App on http://localhost:15174

## Access Your Application

**Main App:**

- Web Interface: http://localhost:15174
- API Documentation: http://localhost:14000/docs

**Management Tools:**

- Grafana: http://localhost:13002 (admin/admin123)
- MinIO Console: http://localhost:19101 (minioadmin/minioadmin123)
- MailHog: http://localhost:18026
- Prometheus: http://localhost:19091

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

All services use **high-range ports (10000+)** to avoid conflicts:

| Service       | Port  |
| ------------- | ----- |
| Web App       | 15174 |
| API Core      | 14000 |
| Forecast Svc  | 18000 |
| PostgreSQL    | 15433 |
| Redis         | 16380 |
| Meilisearch   | 17701 |
| MinIO API     | 19100 |
| MinIO Console | 19101 |
| Prometheus    | 19091 |
| Grafana       | 13002 |
| MailHog SMTP  | 11026 |
| MailHog UI    | 18026 |

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
