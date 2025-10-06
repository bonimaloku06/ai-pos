# Pharmacy POS & Smart Replenishment System

A complete Pharmacy Point of Sale system with AI-powered inventory replenishment, built as a web application with desktop-first UI.

## Architecture

This is a **monorepo** using Turborepo and pnpm workspaces containing:

### Apps
- **web** - React + Vite frontend (POS + Back Office)
- **api-core** - Node.js/Fastify REST API (auth, inventory, sales, purchasing)
- **svc-forecast** - Python/FastAPI service for demand forecasting

### Packages
- **shared-types** - Zod schemas shared across apps
- **sdk-client** - Typed API client for frontend

### Infrastructure
- **infra/docker** - Docker Compose with Postgres, Redis, Meilisearch, MinIO, Grafana
- **infra/db** - Database migrations and seeds

## Features

### Core Functionality
- ✅ **POS System** - Fast checkout with barcode scanning, keyboard shortcuts
- ✅ **Inventory Management** - Batch/lot tracking with FEFO (First Expiry, First Out)
- ✅ **Expiry Management** - Track expiration dates, near-expiry alerts
- ✅ **Purchasing** - Purchase orders, goods receipt notes (GRN)
- ✅ **AI Replenishment** - Automated reorder suggestions based on demand forecasting
- ✅ **Supplier Management** - Lead times, delivery calendars, MOQ
- ✅ **Pricing Rules** - Flexible pricing with markdowns, rounding modes
- ✅ **Reports** - Sales, margins, dead stock, service levels
- ✅ **Audit Trail** - Complete audit log of all changes
- ✅ **RBAC** - Role-based access control (Admin, Manager, Cashier)

### Technical Features
- 🔒 JWT authentication with refresh tokens
- 🔍 Fast product search with Meilisearch
- 📊 Metrics and observability with Prometheus + Grafana
- 🖨️ Receipt printing (thermal + PDF fallback)
- 📱 PWA-ready for offline support (optional)

## Tech Stack

**Frontend:**
- React 18, TypeScript, Vite
- TanStack Router + TanStack Query
- Radix UI + Tailwind CSS
- Zustand for state management
- React Hook Form + Zod validation

**Backend:**
- Node.js, Fastify, TypeScript
- Prisma ORM + PostgreSQL
- BullMQ (job queues)
- Meilisearch (search)
- MinIO (S3-compatible storage)
- Redis (caching/queues)

**Forecasting:**
- Python 3.11+, FastAPI
- Pandas, NumPy, SciPy

**DevOps:**
- Docker & Docker Compose
- Prometheus + Grafana
- Pino logging + OpenTelemetry

## Getting Started

### Prerequisites

- Node.js 20+ and pnpm 9+
- Python 3.11+
- Docker & Docker Compose

### Installation

1. **Clone and install dependencies:**

\`\`\`bash
git clone <your-repo>
cd pharmacy-pos
pnpm install
\`\`\`

2. **Set up environment variables:**

\`\`\`bash
cp .env.example .env
# Edit .env with your configuration
\`\`\`

3. **Start infrastructure services:**

\`\`\`bash
cd infra/docker
docker-compose up -d
\`\`\`

This starts:
- PostgreSQL (port 5433)
- Redis (port 6380)
- Meilisearch (port 7701)
- MinIO (ports 9100, 9101)
- Prometheus (port 9091)
- Grafana (port 3003)
- Mailhog (ports 1026, 8026)

4. **Set up the database:**

\`\`\`bash
cd apps/api-core
pnpm db:generate      # Generate Prisma client
pnpm db:migrate       # Run migrations
pnpm db:seed          # Seed example data (optional)
\`\`\`

5. **Start all services:**

\`\`\`bash
pnpm dev
\`\`\`

This single command starts **everything**:
- ✅ Docker services (PostgreSQL, Redis, Meilisearch, etc.)
- ✅ Python AI forecast service (port 8000)
- ✅ API Core (port 4000)  
- ✅ Web App (port 5173)

**To stop all services:**

\`\`\`bash
pnpm stop
\`\`\`

See [ONE_COMMAND_START.md](ONE_COMMAND_START.md) for details.

6. **Access the application:**

- **Web App**: http://localhost:5173
- **API Core**: http://localhost:4000
- **Forecast Service**: http://localhost:8000
- **Grafana**: http://localhost:3003 (admin/admin123)
- **Meilisearch**: http://localhost:7701
- **MinIO Console**: http://localhost:9101 (minioadmin/minioadmin123)

## Project Structure

\`\`\`
pharmacy-pos/
├── apps/
│   ├── web/                 # React frontend
│   │   ├── src/
│   │   │   ├── routes/      # TanStack Router pages
│   │   │   ├── components/  # React components
│   │   │   └── lib/         # Utils and hooks
│   │   └── package.json
│   │
│   ├── api-core/            # Node.js backend
│   │   ├── src/
│   │   │   ├── routes/      # API routes
│   │   │   ├── lib/         # Prisma, utils
│   │   │   └── middleware/  # Auth, RBAC
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── package.json
│   │
│   └── svc-forecast/        # Python forecasting service
│       ├── main.py
│       └── requirements.txt
│
├── packages/
│   ├── shared-types/        # Zod schemas
│   └── sdk-client/          # API client
│
├── infra/
│   ├── docker/
│   │   ├── docker-compose.yml
│   │   └── prometheus.yml
│   └── db/                  # Seed scripts
│
├── package.json             # Root package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
\`\`\`

## Development

### Available Scripts

**Root:**
- `pnpm dev` - Start all apps in dev mode
- `pnpm build` - Build all apps
- `pnpm lint` - Lint all apps
- `pnpm typecheck` - Type check all apps

**API Core:**
- `pnpm dev` - Start dev server
- `pnpm build` - Build for production
- `pnpm db:migrate` - Run database migrations
- `pnpm db:seed` - Seed database
- `pnpm db:studio` - Open Prisma Studio

**Web:**
- `pnpm dev` - Start dev server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build

### Database Migrations

\`\`\`bash
cd apps/api-core

# Create a new migration
pnpm prisma migrate dev --name description_of_change

# Apply migrations to production
pnpm prisma migrate deploy

# Reset database (dev only)
pnpm prisma migrate reset
\`\`\`

## Key Business Logic

### FEFO (First Expiry, First Out)

The system automatically allocates stock from batches with the earliest expiry date first:

\`\`\`typescript
// In api-core/src/lib/fefo.ts
const batches = await prisma.batch.findMany({
  where: { productId, qtyOnHand: { gt: 0 } },
  orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }],
});
\`\`\`

### Demand Forecasting

The Python service calculates:
1. **Mean demand** from historical sales
2. **Standard deviation** for variability
3. **Safety stock** = Z-score × std dev × √(lead time)
4. **Reorder point (ROP)** = (mean demand × lead time) + safety stock
5. **Order quantity** based on MOQ, price breaks, and delivery schedule

### Pricing Rules

Supports multiple pricing strategies:
- **Markup %** - Add percentage on cost
- **Fixed price** - Set specific price
- **Discount** - Percentage off
- **Rounding** - 0.99, 0.95, 0.50, etc.

## Deployment

### Production Build

\`\`\`bash
# Build all apps
pnpm build

# Build specific app
pnpm --filter api-core build
pnpm --filter web build
\`\`\`

### Docker Deployment

\`\`\`dockerfile
# Example Dockerfile for api-core
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
CMD ["pnpm", "start"]
\`\`\`

### Environment Variables

See `.env.example` for all required environment variables. Key ones:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Secret for JWT signing
- `MEILI_HOST` - Meilisearch host
- `FORECAST_SVC_URL` - Forecast service URL

## Testing

\`\`\`bash
# Run all tests
pnpm test

# Run tests for specific app
pnpm --filter api-core test
pnpm --filter web test
\`\`\`

## Roadmap

**Week 1-2:** ✅ Foundation (repos, DB, auth, basic UI)
**Week 3-4:** Inventory, POS, Purchasing flows
**Week 5-6:** Forecasting service, Reports
**Week 7-8:** Testing, Compliance, Pilot

**Post-MVP:**
- Advanced probabilistic forecasting
- Multi-store & central warehouse
- Loyalty/CRM integration
- Full offline PWA support
- Mobile app (React Native)

## Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit: `git commit -m "Add my feature"`
3. Push and create a PR: `git push origin feature/my-feature`

## License

MIT

## Support

For issues or questions, please open a GitHub issue.

---

**Built with ❤️ for modern pharmacy operations**