# 🚀 Docker Quick Start Guide

## TL;DR - Start Everything

```bash
cd infra/docker
docker-compose --env-file ../../.env up -d --build
```

Access your app at: **http://localhost:5174** 🎉

---

## 📊 Port Summary

### **No Conflicts!**

| Service | Your AiPos | Other Project |
|---------|-----------|---------------|
| **Web App** | **5174** ✅ | 5173 |
| PostgreSQL | 5433 | 5433 (stopped) |
| API Core | 4000 | - |
| Forecast | 8000 | - |

---

## 🎯 Common Commands

### **Start Services**
```bash
cd infra/docker
docker-compose --env-file ../../.env up -d
```

### **Stop Services**
```bash
cd infra/docker
docker-compose --env-file ../../.env down
```

### **View Logs**
```bash
# All services
docker-compose --env-file ../../.env logs -f

# Specific service
docker-compose --env-file ../../.env logs -f api-core
docker-compose --env-file ../../.env logs -f web
docker-compose --env-file ../../.env logs -f svc-forecast
```

### **Restart a Service**
```bash
docker-compose --env-file ../../.env restart api-core
```

### **Rebuild After Code Changes**
```bash
docker-compose --env-file ../../.env up -d --build api-core
```

---

## 🔧 Development Mode

For hot-reload (recommended during development):

```bash
cd infra/docker
docker-compose -f docker-compose.yml -f docker-compose.dev.yml --env-file ../../.env up -d
```

This enables:
- ✅ Live code updates
- ✅ Auto-restart on changes
- ✅ Volume mounting for instant updates

---

## 📝 Service Health Check

```bash
# Check all containers
docker ps | grep pharmacy-pos

# Check specific service health
docker inspect pharmacy-pos-api | grep -A 5 Health
```

---

## 🗄️ Database Commands

```bash
# Run migrations
docker exec -it pharmacy-pos-api npx prisma migrate dev

# Seed database
docker exec -it pharmacy-pos-api npx prisma db seed

# Access database
docker exec -it pharmacy-pos-db psql -U pharmacy -d pharmacy_pos
```

---

## 🆘 Troubleshooting

### **Port already in use?**
```bash
lsof -i :5174  # Check what's using the port
```

### **Service won't start?**
```bash
docker-compose --env-file ../../.env logs <service-name>
```

### **Need fresh start?**
```bash
docker-compose --env-file ../../.env down -v
docker-compose --env-file ../../.env up -d --build
```

---

## 🌐 Access URLs

- Web: http://localhost:5174
- API: http://localhost:4000
- Forecast: http://localhost:8000
- Grafana: http://localhost:3003
- MinIO: http://localhost:9101

**Login**: admin@pharmacy.com / admin123

---

For detailed documentation, see: **DOCKER_MIGRATION_COMPLETE.md**
