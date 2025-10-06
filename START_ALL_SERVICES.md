# 🚀 Start All Services - Quick Guide

Follow these steps in order to start your Pharmacy POS system.

---

## ✅ Prerequisites

- [x] Docker Desktop installed and running
- [x] Node.js 20+ installed
- [x] Python 3.11+ installed
- [x] pnpm installed

---

## 📋 Startup Sequence

### **1. Start Docker Services** 🐳

Open **Docker Desktop** first, then:

```bash
cd /Users/shabanmaloku/Desktop/Personal/AiPos/infra/docker
docker-compose up -d
```

**Wait ~30 seconds** for all services to start. Verify with:
```bash
docker ps
```

You should see 7 containers running:
- ✅ pharmacy-pos-db (PostgreSQL)
- ✅ pharmacy-pos-redis (Redis)
- ✅ pharmacy-pos-search (Meilisearch)
- ✅ pharmacy-pos-storage (MinIO)
- ✅ pharmacy-pos-prometheus
- ✅ pharmacy-pos-grafana
- ✅ pharmacy-pos-mail (Mailhog)

---

### **2. Start Python Forecast Service** 🤖

**Terminal 1:**
```bash
cd /Users/shabanmaloku/Desktop/Personal/AiPos/apps/svc-forecast

# Activate virtual environment
source venv/bin/activate

# Start the service
python main.py
```

**Expected output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

**Test it:**
- Open: http://localhost:8000/health
- Should return: `{"status":"ok","service":"forecast","timestamp":"..."}`

**Leave this terminal running** ✅

---

### **3. Start API Server** 🚀

**Terminal 2:**
```bash
cd /Users/shabanmaloku/Desktop/Personal/AiPos/apps/api-core

# Start the API
pnpm dev
```

**Expected output:**
```
✓ Meilisearch product index initialized
Server listening on http://localhost:4000
API Documentation available at http://localhost:4000/docs
```

**Test it:**
- Health: http://localhost:4000/health
- API Docs: http://localhost:4000/docs

**Leave this terminal running** ✅

---

### **4. Start Frontend** 💻

**Terminal 3:**
```bash
cd /Users/shabanmaloku/Desktop/Personal/AiPos/apps/web

# Start the frontend
pnpm dev
```

**Expected output:**
```
VITE v6.0.1  ready in 523 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

**Leave this terminal running** ✅

---

## 🌐 Access Your Application

Once all services are running:

### **Main Application**
- **Frontend**: http://localhost:5173
- **Login with**: 
  - Admin: `admin@pharmacy.com` / `admin123`
  - Manager: `manager@pharmacy.com` / `manager123`
  - Cashier: `cashier@pharmacy.com` / `cashier123`

### **API & Documentation**
- **API Docs (Swagger)**: http://localhost:4000/docs
- **API Health**: http://localhost:4000/health

### **Infrastructure UIs**
- **Grafana**: http://localhost:3001 (admin/admin123)
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin123)
- **Mailhog**: http://localhost:8025
- **Prometheus**: http://localhost:9090
- **Prisma Studio**: Run `cd apps/api-core && pnpm db:studio` → http://localhost:5555

---

## 🔧 Troubleshooting

### **Port Already in Use**

**Redis (6379):**
```bash
# Stop native Redis if running
brew services stop redis
brew services stop redis-stack-server
killall redis-server
```

**PostgreSQL (5432):**
```bash
# Stop native PostgreSQL if running
brew services stop postgresql
```

**Other ports:**
```bash
# Check what's using a port
lsof -i :PORT_NUMBER

# Kill process
kill PID
```

---

### **Docker Not Starting**

1. Open Docker Desktop app
2. Wait for whale icon to stabilize
3. Check: `docker ps` works without errors

---

### **Meilisearch Connection Failed**

Wait 30 seconds after `docker-compose up -d`, then restart API:
```bash
cd apps/api-core
pnpm dev
```

---

### **Forecast Service Connection Failed**

Make sure Python service is running:
```bash
# Check if running
lsof -i :8000

# If not, start it
cd apps/svc-forecast
source venv/bin/activate
python main.py
```

---

## 🧹 Clean Restart

If things are stuck, clean restart:

```bash
# Stop all services
docker-compose down

# Stop any remaining processes
pkill -f "pnpm dev"
pkill -f "python main.py"

# Start fresh
docker-compose up -d
# Then follow steps 2-4 above
```

---

## 🗄️ Database Management

### **Fresh Start with Seed Data**
```bash
cd apps/api-core
pnpm db:fresh
```

This creates:
- 3 users (admin, manager, cashier)
- 27 products across 7 categories
- 3 suppliers with delivery schedules
- 180+ historical sales (for AI testing)

### **Browse Database**
```bash
cd apps/api-core
pnpm db:studio
```
Opens Prisma Studio at http://localhost:5555

---

## ✅ Verification Checklist

- [ ] Docker Desktop running with 7 containers
- [ ] Python forecast service on port 8000
- [ ] API server on port 4000
- [ ] Frontend on port 5173
- [ ] Can log in at http://localhost:5173/login
- [ ] Can access API docs at http://localhost:4000/docs
- [ ] "Generate Suggestions" button works in Replenishment page

---

## 📊 Summary

**3 Terminal Windows:**
1. **Terminal 1**: Python Forecast Service (port 8000)
2. **Terminal 2**: API Core (port 4000)
3. **Terminal 3**: Frontend (port 5173)

**+ Docker Desktop** running 7 infrastructure containers

---

**Everything working?** 🎉  
Check out the **APP_ANALYSIS_SUMMARY.md** for feature recommendations and next steps!

**Last Updated:** October 2024
