# Pharmacy POS & Smart Replenishment — Web App Implementation Plan (No Mobile Yet)

**Owner:** bon  
**Version:** v1.1 (Sep 28, 2025)  
**Scope change:** **Web app only** for MVP (desktop-first POS + back office). Mobile/React Native postponed. Keep PWA-ready so you can add offline caching later without rewriting.

---

## 0) Guiding Principles

- **Modular monolith** now; seams for future services (forecasting stays separate).  
- **Desktop-first POS UI** (fast keyboard flows, barcode scan, printing).  
- **Strict inventory with batches/expiry (FEFO)** and auditability.  
- **AI replenishment** in a separate Python service.  
- **PWA-ready**: offline cache for static assets and limited offline cart (optional in MVP).

---

## 1) High-Level Architecture (Web-only)

```
apps/
  web/                 # React + Vite (POS + Backoffice in one app, role-gated)
  api-core/            # Fastify + TypeScript (Prisma, BullMQ, REST)
  svc-forecast/        # FastAPI (Python), demand forecasting & reorder
packages/
  shared-types/        # Zod/TS schemas
  sdk-client/          # Typed fetch client for web → api-core
infra/
  docker/              # Compose: postgres, redis, meilisearch, minio, grafana
  db/                  # migrations & seed
```

- **api-core (Node/TS)**: Auth, RBAC, Catalog, Batches, Stock, POS, Pricing, Suppliers, PO/GRN, Search indexer, Reports, Audit, Webhooks, file uploads.  
- **svc-forecast (Python)**: `/recommendations` & `/simulate`.  
- **Data**: PostgreSQL (Prisma), Meilisearch (fast lookup), Redis (queues), S3-compatible object storage.  
- **Observability**: pino + OpenTelemetry, Prometheus/Grafana dashboards.

---

## 2) Web App (React + Vite) Structure

- **Router:** TanStack Router or React Router v6.  
- **State/data:** TanStack Query, Zustand for UI/local state.  
- **Forms/validation:** React Hook Form + Zod.  
- **UI kit:** Radix UI + Tailwind (fast, accessible).  
- **Printing:** Browser print to thermal printers via OS driver; fallback to PDF.  
- **PWA (optional in MVP):** Workbox service worker for asset caching + “resume last cart”.  
- **Role-gated areas:** POS (cashier), Inventory/Purchasing (manager), Reporting (manager/admin).

**Key Screens:**
- **POS:** search/scan, cart grid (keyboard friendly), payments, receipt preview/print, refunds.  
- **Products & Batches:** list, FEFO view, expiry dashboard.  
- **Receiving (GRN):** link to PO or ad-hoc; create batches.  
- **Purchasing:** suppliers, calendars, PO builder, approve/send, GRN reconcile.  
- **Replenishment:** AI suggestions → review/override → draft PO.  
- **Pricing:** rules, rounding, near-expiry markdowns.  
- **Reports:** sales, margins, dead stock, service level.  
- **Settings:** users/roles, stores, taxes, fiscalization adapter.

---

## 3) Domain Modules & Boundaries

(Same as v1.0, minus mobile/offline SQLite)
1) Catalog & Drug Master  
2) Inventory (Batches/Lots, FEFO, Movements)  
3) Sales (POS) — web UI, server validates FEFO and price at sale time  
4) Purchasing & Suppliers (lead time + calendars)  
5) Pricing & Margins  
6) Forecasting & Replenishment (Python)  
7) Compliance & Expiry  
8) Reporting & Audit

---

## 4) Data Model (ERD — unchanged essentials)

```
Product(id, name, sku, barcode, unit, pack_size, category_id, tax_class_id, status)
Batch(id, product_id, supplier_id?, expiry_date, received_at, unit_cost, qty_on_hand)
StockMovement(id, product_id, batch_id?, type, qty, from_loc?, to_loc?, unit_cost?, ref_table, ref_id, created_at, user_id)
Supplier(id, name, lead_time_days, delivery_days text[], moq, currency, terms)
PurchaseOrder(id, supplier_id, status, expected_at, created_at, created_by)
POLine(id, po_id, product_id, qty, unit_cost, notes)
GoodsReceipt(id, po_id, received_at, ref_no)
GRLine(id, gr_id, product_id, batch_id, qty, unit_cost)
Sale(id, store_id, cashier_id, total, tax_total, discount_total, paid, payment_method, created_at)
SaleLine(id, sale_id, product_id, batch_id, qty, unit_price, tax_rate, discount)
PriceRule(id, scope, scope_id, rule_type, value, rounding_mode)
User(id, email, role, store_id, password_hash, is_active)
AuditLog(id, actor_id, action, entity, entity_id, diff_json, at)
ForecastParam(id, store_id, service_level, holiday_calendar, horizon_days)
ReorderSuggestion(id, product_id, store_id, suggestion_date, rop, order_qty, reason_json, supplier_id?)
```

> Money: `numeric(12,4)`; price rounding rules at rule level.

---

## 5) Backend Contracts (selected, REST)

**Auth**
- `POST /auth/login` → `{ accessToken, refreshToken, user }`
- `GET /me` → `user`

**Products & Batches**
- `GET /products?query=&page=`  
- `POST /products`  
- `GET /products/:id/batches`  
- `POST /grn` → create batches + `RECEIVE` movements

**POS**
- `POST /sales` (server picks batches FEFO if client doesn’t)  
- `POST /sales/:id/refund`

**Purchasing**
- `GET /suppliers/:id/calendar`  
- `POST /po/draft` from suggestions  
- `POST /po/:id/approve`  
- `POST /po/:id/cancel`

**Forecasting (Python)**
- `POST /recommendations` (same payload as v1.0)  
- `POST /simulate` for what-if (coverage, service level)

---

## 6) Forecasting Logic (unchanged MVP)

- Weekly seasonality → daily demand → SafetyStock & ROP → OrderQty with MOQs/price breaks → align to delivery days → group by supplier to draft POs.

---

## 7) Printing Strategy (Web)

- Use the OS driver for your thermal printer (80mm recommended).  
- Generate a clean **print-only** HTML/CSS template (A4 or 80mm roll).  
- Provide **PDF fallback** for stores without drivers; a “Print test” page in settings.

---

## 8) Security & Compliance

- JWT + refresh; httpOnly cookies recommended for web.  
- RBAC with route guards in frontend and middleware in backend.  
- Audit all mutations.  
- Backups (daily full + WAL), secrets in env, TLS everywhere.  
- Fiscalization adapter layer (per-country).

---

## 9) DevOps

- Docker Compose for local: Postgres, Redis, Meilisearch, MinIO, Grafana, Mailhog.  
- CI: lint, typecheck, unit/integration, build, Prisma migrate, e2e (Playwright).  
- Observability: dashboards for sales, job durations, forecast MAPE, error rates.

**Env vars (sample):**
```
DATABASE_URL=postgres://...
REDIS_URL=redis://...
MEILI_HOST=http://meili:7700
S3_ENDPOINT=http://minio:9000
JWT_SECRET=...
FORECAST_SVC_URL=http://svc-forecast:8000
```

---

## 10) Step-by-Step Roadmap (6–8 weeks MVP)

### Week 1 — Repos & Foundations
- Turborepo + pnpm workspaces.  
- api-core boot + Prisma models (Product, Batch, StockMovement, Supplier, Sale…).  
- web app shell: auth, layout, RBAC guards.  
- Seed script + Meilisearch sync job.

### Week 2 — Inventory & Receiving
- GRN flow: batches, `RECEIVE` movements, FEFO queries.  
- Expiry dashboard; search with filters; audit trail basics.

### Week 3 — POS (Web)
- Fast search/scan (barcode input focus kept), cart grid, totals, taxes/discounts, receipt print.  
- Server-side FEFO & price validation; refunds/voids.  
- Keyboard shortcuts and error toasts.

### Week 4 — Purchasing
- Suppliers (lead time + delivery calendar).  
- PO builder, approve/cancel; GRN reconciliation with variances.  
- Pricing rules & rounding; suggested retail on receiving.

### Week 5 — Forecasting
- FastAPI service; cron/BullMQ nightly job to persist `ReorderSuggestion`.  
- Replenishment screen to review/override → `PO DRAFT` per supplier.  
- Metrics (MAPE) & simple what-if simulator.

### Week 6 — Reporting & Hardening
- Sales/margin, dead stock, service level; CSV export.  
- E2E tests (Playwright); load test POS endpoints; back-ups & restore drill.  
- PWA toggle (optional): cache shell + “resume last cart”.

### Week 7–8 — Compliance, Polish, Pilot
- Fiscalization adapter stub for your region.  
- Roles & permissions review; accessibility pass.  
- Pilot with real data; bugbash; release notes.

---

## 11) Implementation Checklists

**api-core**
- [ ] Auth/JWT + RBAC
- [ ] Product/Catalog CRUD + search sync
- [ ] Batches + FEFO resolver
- [ ] Stock movements invariants
- [ ] Sales & Refunds
- [ ] Suppliers + PO/GRN
- [ ] Price rules & rounding
- [ ] ReorderSuggestion endpoints + jobs
- [ ] AuditLog on all mutations
- [ ] Reports API

**svc-forecast**
- [ ] History fetch (secure token)
- [ ] Clean series/outliers
- [ ] Forecast & residual stddev
- [ ] SafetyStock/ROP/OrderQty
- [ ] Calendars/MOQs/price breaks
- [ ] Metrics (MAE/MAPE)
- [ ] What-if simulate

**web**
- [ ] Auth, layout, RBAC guards
- [ ] POS screen (scan/add, cart, pay, print)
- [ ] Inventory & expiry views
- [ ] Purchasing (PO/GRN)
- [ ] Pricing UI
- [ ] Replenishment review/approve
- [ ] Reports
- [ ] Print templates & PDF fallback
- [ ] (Optional) PWA shell

---

## 12) Example Snippets

### 12.1 POS: Keep input focused for barcode
```tsx
const inputRef = useRef<HTMLInputElement>(null);
useEffect(() => {
  const i = setInterval(() => inputRef.current?.focus(), 2000);
  return () => clearInterval(i);
}, []);
```

### 12.2 FEFO on server (Prisma)
```ts
const batches = await prisma.batch.findMany({
  where: { productId, qtyOnHand: { gt: 0 } },
  orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }],
});
```

### 12.3 Suggest retail (rounding)
```ts
export function suggestRetail(unitCost: number, marginPct: number) {
  const raw = unitCost * (1 + marginPct/100);
  return Math.floor(raw) + 0.99; // 9.99 style
}
```

### 12.4 Forecasting API (FastAPI skeleton)
```py
from fastapi import FastAPI
from pydantic import BaseModel
from math import sqrt
app = FastAPI()

class Req(BaseModel):
    storeId: str
    asOf: str
    skus: list[str]
    leadTimes: dict[str, int]
    serviceLevel: float = 0.95

@app.post("/recommendations")
def rec(req: Req):
    z = 1.65 if req.serviceLevel >= 0.95 else 1.28
    # TODO: fetch history from api-core and compute mean/sd
    return {"suggestions": []}
```

---

## 13) “Done” Criteria (MVP — Web)

- Sell via web POS; print receipt; refund.  
- Receive stock in batches; FEFO enforced; near-expiry dashboard.  
- Suppliers with lead times; approve POs; GRN reconciles stock.  
- Nightly AI suggestions → draft POs with reasons.  
- Sales/margin/dead-stock reports.  
- Full audit trail; backups; RBAC; basic dashboards.

---

## 14) Next Steps (Today)

1) Initialize mono-repo & Docker Compose.  
2) Implement Prisma schema & first migration; seed example data.  
3) Scaffold web app shell with auth + protected routes.  
4) Build Products/Batches screen.  
5) Start POS screen + sale API.  
6) Bring up FastAPI skeleton (no modeling yet).

---

## 15) Future (post-MVP)

- Advanced probabilistic forecasting & promo effects.  
- Multi-store & central warehouse.  
- Loyalty/CRM, digital receipts.  
- Full PWA offline sales buffer.  
- Mobile/React Native client (shares `sdk-client` and API contracts).

*End of web-app plan.*
