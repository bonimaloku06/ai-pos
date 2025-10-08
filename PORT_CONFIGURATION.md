# Port Configuration for Pharmacy POS

This document lists all the ports used by the Pharmacy POS application. All ports use higher ranges (10000+) to minimize conflicts with other projects.

## Default Port Mappings

### Application Services

| Service          | External Port | Internal Port | Description            |
| ---------------- | ------------- | ------------- | ---------------------- |
| API Core         | **14000**     | 4000          | Main API server        |
| Forecast Service | **18000**     | 8000          | AI forecasting service |
| Web UI           | **15174**     | 5174          | Frontend application   |

### Infrastructure Services

| Service       | External Port | Internal Port | Description        |
| ------------- | ------------- | ------------- | ------------------ |
| PostgreSQL    | **15433**     | 5432          | Database server    |
| Redis         | **16380**     | 6379          | Cache & queue      |
| Meilisearch   | **17701**     | 7700          | Search engine      |
| MinIO API     | **19100**     | 9000          | Object storage API |
| MinIO Console | **19101**     | 9001          | Object storage UI  |

### Monitoring Services

| Service    | External Port | Internal Port | Description        |
| ---------- | ------------- | ------------- | ------------------ |
| Prometheus | **19091**     | 9090          | Metrics collection |
| Grafana    | **13002**     | 3000          | Metrics dashboard  |

### Development Services

| Service      | External Port | Internal Port | Description            |
| ------------ | ------------- | ------------- | ---------------------- |
| MailHog SMTP | **11026**     | 1025          | Email testing (SMTP)   |
| MailHog UI   | **18026**     | 8025          | Email testing (Web UI) |

## Access URLs

After starting the services with `docker-compose up -d`, you can access:

- **Web Application**: http://localhost:15174
- **API Server**: http://localhost:14000
- **Forecast Service**: http://localhost:18000
- **Grafana Dashboard**: http://localhost:13002 (admin/admin123)
- **MinIO Console**: http://localhost:19101 (minioadmin/minioadmin123)
- **MailHog UI**: http://localhost:18026
- **Prometheus**: http://localhost:19091

## Database Connections

- **PostgreSQL**: `localhost:15433`
  - User: `pharmacy`
  - Password: `pharmacy123`
  - Database: `pharmacy_pos`

- **Redis**: `localhost:16380`

## Customizing Ports

To override any default port, create a `.env` file in the root directory with your custom values:

```env
# Example: Override specific ports
API_PORT=14000
WEB_PORT=15174
POSTGRES_PORT=15433
REDIS_PORT=16380
# ... add any other port overrides as needed
```

## Environment Variables

All ports can be customized using environment variables:

- `API_PORT` - API Core service port
- `FORECAST_PORT` - Forecast service port
- `WEB_PORT` - Web frontend port
- `POSTGRES_PORT` - PostgreSQL port
- `REDIS_PORT` - Redis port
- `MEILI_PORT` - Meilisearch port
- `MINIO_API_PORT` - MinIO API port
- `MINIO_CONSOLE_PORT` - MinIO Console port
- `PROMETHEUS_PORT` - Prometheus port
- `GRAFANA_PORT` - Grafana port
- `MAILHOG_SMTP_PORT` - MailHog SMTP port
- `MAILHOG_UI_PORT` - MailHog Web UI port

## Troubleshooting Port Conflicts

If you still experience port conflicts:

1. Check which process is using the port:

   ```bash
   lsof -i :PORT_NUMBER
   ```

2. Either stop the conflicting service or override the port in a `.env` file

3. Restart Docker Compose:
   ```bash
   cd infra/docker
   docker-compose down
   docker-compose up -d
   ```
