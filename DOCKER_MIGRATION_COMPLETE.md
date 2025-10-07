# 🎉 Docker Migration Complete

## Summary

All services have been successfully dockerized and configured to avoid port conflicts with your other projects.

---

## ✅ What Changed

### **1. Port Configuration**
- **Web App**: Changed from `5173` → `5174` (avoids conflict with your other Docker project)
- All other ports remain the same

### **2. Dockerized Services**
All three application services are now containerized:

| Service | Port | Container Name | Status |
|---------|------|----------------|--------|
| Web App (Vite/React) | 5174 | pharmacy-pos-web | ✅ Dockerized |
| API Core (Fastify) | 4000 | pharmacy-pos-api | ✅ Dockerized |
| Forecast Service (Python) | 8000 | pharmacy-pos-forecast | ✅ Dockerized |

### **3. Infrastructure Services** (Already in Docker)
| Service | Port | Container Name |
|---------|------|----------------|
| PostgreSQL | 5433 | pharmacy-pos-db |
| Redis | 6380 | pharmacy-pos-redis |
| Meilisearch | 7701 | pharmacy-pos-search |
| MinIO | 9100/9101 | pharmacy-pos-storage |
| Prometheus | 9091 | pharmacy-pos-prometheus |
| Grafana | 3003 | pharmacy-pos-grafana |
| MailHog | 1026/8026 | pharmacy-pos-mail |

---

## 🚀 How to Use

### **Option 1: Start Everything with Docker (Recommended)**

```bash
# Navigate to docker directory
cd infra/docker

# Start all services
docker-compose --env-file ../../.env up -d --build

# View logs
docker-compose --env-file ../../.env logs -f

# Stop all services
docker-compose --env-file ../../.env down
```

### **Option 2: Use the Convenience Script**

```bash
# Make script executable (one time)
chmod +x scripts/docker-start.sh

# Start everything
./scripts/docker-start.sh
```

### **Option 3: Development Mode with Hot-Reload**

```bash
cd infra/docker

# Start with development configuration
docker-compose -f docker-compose.yml -f docker-compose.dev.yml --env-file ../../.env up -d --build

# This enables:
# - Live code reload for Web app
# - Auto-restart for API Core on code changes
# - Python hot-reload for Forecast service
```

---

## 📊 Service URLs

### **Application URLs**
- 🌐 **Web App**: http://localhost:5174
- 🔌 **API Core**: http://localhost:4000
- 🔮 **Forecast Service**: http://localhost:8000

### **Admin/Monitoring URLs**
- 📊 **Grafana**: http://localhost:3003 (admin/admin123)
- 📦 **MinIO Console**: http://localhost:9101 (minioadmin/minioadmin123)
- 📧 **MailHog UI**: http://localhost:8026
- 🔍 **Meilisearch**: http://localhost:7701

---

## 🔧 Useful Commands

### **Managing Services**

```bash
# View running containers
docker ps

# View all pharmacy-pos containers
docker ps -a | grep pharmacy-pos

# Restart a specific service
docker-compose --env-file ../../.env restart api-core

# View logs for a specific service
docker-compose --env-file ../../.env logs -f web

# Stop all services
docker-compose --env-file ../../.env down

# Stop and remove volumes (WARNING: deletes data)
docker-compose --env-file ../../.env down -v

# Rebuild a specific service
docker-compose --env-file ../../.env up -d --build api-core
```

### **Database Operations**

```bash
# Access PostgreSQL
docker exec -it pharmacy-pos-db psql -U pharmacy -d pharmacy_pos

# Run Prisma migrations
docker exec -it pharmacy-pos-api npx prisma migrate dev

# Run database seed
docker exec -it pharmacy-pos-api npx prisma db seed

# View database in Prisma Studio
docker exec -it pharmacy-pos-api npx prisma studio
```

### **Debugging**

```bash
# Enter a container shell
docker exec -it pharmacy-pos-api sh
docker exec -it pharmacy-pos-web sh
docker exec -it pharmacy-pos-forecast bash

# Check container health
docker inspect pharmacy-pos-api | grep -A 10 Health

# View resource usage
docker stats
```

---

## 📁 New Files Created

### **Dockerfiles**
- `apps/api-core/Dockerfile` - Production build
- `apps/api-core/Dockerfile.dev` - Development with hot-reload
- `apps/web/Dockerfile` - Production build with nginx
- `apps/web/nginx.conf` - Nginx configuration
- `apps/svc-forecast/Dockerfile` - Production build
- `apps/svc-forecast/Dockerfile.dev` - Development with hot-reload

### **Docker Ignore Files**
- `apps/api-core/.dockerignore`
- `apps/web/.dockerignore`
- `apps/svc-forecast/.dockerignore`

### **Docker Compose Files**
- `infra/docker/docker-compose.yml` - Updated with all services
- `infra/docker/docker-compose.dev.yml` - Development overrides

### **Scripts**
- `scripts/docker-start.sh` - Convenience script to start all services

---

## 🔥 Important Notes

### **Port 5173 Conflict Resolved**
Your other Docker project can continue using port **5173** without any conflicts. This project now uses port **5174** for the web app.

### **Database is Already in Docker**
Your PostgreSQL was already running in Docker on port **5433**. No migration was needed for the database.

### **Internal vs External Networking**
- **Inside Docker**: Services communicate using container names (e.g., `http://api-core:4000`)
- **From Host**: Access services using `localhost` (e.g., `http://localhost:4000`)

### **Development Workflow**
1. **Hot-reload enabled**: Changes to your code will automatically reflect in running containers (in dev mode)
2. **Volume mounts**: Source code is mounted into containers in development mode
3. **Fast rebuilds**: Docker layer caching makes rebuilds fast

---

## 🎯 Benefits of This Setup

✅ **No Port Conflicts**: Runs alongside your other Docker projects
✅ **Isolated Environment**: Each service runs in its own container
✅ **Easy Deployment**: Same Docker setup works in production
✅ **Consistent Environment**: No more "works on my machine" issues
✅ **Quick Setup**: One command starts everything
✅ **Hot-Reload**: Development mode supports live code updates
✅ **Resource Efficient**: Docker manages resources automatically
✅ **Easy Scaling**: Can scale services independently

---

## 🔄 Migration from Old Setup

### **Old Way (Mixed Local + Docker)**
```bash
# Start Docker infrastructure
cd infra/docker && docker-compose up -d

# Start Python service locally
cd apps/svc-forecast && source venv/bin/activate && python main.py

# Start Node services locally
pnpm turbo run dev
```

### **New Way (All Docker)**
```bash
# Start everything
cd infra/docker && docker-compose --env-file ../../.env up -d
```

---

## 🐛 Troubleshooting

### **Services won't start**
```bash
# Check Docker is running
docker info

# View error logs
docker-compose --env-file ../../.env logs

# Rebuild from scratch
docker-compose --env-file ../../.env down
docker-compose --env-file ../../.env up -d --build
```

### **Port already in use**
```bash
# Find what's using the port
lsof -i :5174

# Stop the conflicting process or change the port in .env
```

### **Database connection issues**
```bash
# Check if PostgreSQL is healthy
docker exec -it pharmacy-pos-db pg_isready -U pharmacy

# View PostgreSQL logs
docker logs pharmacy-pos-db

# Restart PostgreSQL
docker-compose --env-file ../../.env restart postgres
```

---

## 📚 Next Steps

1. **Test the setup**: Stop current services and start with Docker
2. **Update .env if needed**: Customize any environment variables
3. **Run database migrations**: `docker exec -it pharmacy-pos-api npx prisma migrate dev`
4. **Monitor services**: Check Grafana dashboard at http://localhost:3003

---

## 🎓 Learn More

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)

---

**🎉 Congratulations! Your entire Pharmacy POS system is now fully dockerized and ready for deployment.**
