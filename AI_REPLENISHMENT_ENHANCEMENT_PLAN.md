# 🤖 AI Replenishment Enhancement Plan

## Overview

Enhanced AI-powered reorder suggestion system with supplier delivery schedules, flexible historical analysis, multi-supplier tracking, and intelligent stock duration projections.

---

## 📋 Business Requirements

### 1. Supplier Delivery Schedules
- **Problem**: Different suppliers have different delivery days
- **Examples**:
  - Company A: Daily delivery (Monday-Sunday)
  - Company B: Specific days only (e.g., Wednesday & Friday)
  - Company C: Weekly (e.g., Every Monday)
- **Need**: AI must consider delivery schedules when suggesting orders

### 2. Flexible Historical Analysis
- **Problem**: Fixed 30-day period doesn't match business needs
- **Solution**: User selects analysis period
  - Last 7 days (weekly pattern)
  - Last 30 days (monthly pattern)
  - Last 90 days (quarterly pattern)
  - Last 365 days (annual pattern with seasonality)
- **Use Case**: Compare week-to-week, identify seasonal trends

### 3. Multi-Supplier Product Tracking
- **Problem**: Same product available from multiple suppliers
- **Tracking Needs**:
  - Purchase history per supplier
  - Price comparison
  - Quality/reliability tracking
  - Delivery reliability
- **Example**: Paracetamol 500mg available from:
  - Company A: $0.50/unit, daily delivery
  - Company B: $0.45/unit, Wed/Fri delivery

### 4. Delivery Day Intelligence
- **Smart Suggestions**:
  - "Order TODAY for tomorrow delivery"
  - "Next delivery: Wednesday - order 2 days of stock"
  - "Last chance to order before weekend"
  - "Too late for this week, order for next week"
- **Calendar Integration**: Show delivery schedule

### 5. Stock Duration Projections
- **Current State**: Only shows current stock
- **Enhanced View**:
  ```
  Current: 50 units
  Daily usage: 8 units/day
  Will last: 6.25 days

  Scenarios:
  • Order  20 → Total  70 → Lasts  8.75 days
  • Order  50 → Total 100 → Lasts 12.50 days
  • Order 100 → Total 150 → Lasts 18.75 days
  ```

### 6. Smart Urgency Indicators
- **Critical** (Red): <3 days stock remaining
- **Warning** (Yellow): 3-7 days stock remaining
- **Good** (Green): >7 days stock remaining
- **Overstocked** (Blue): >30 days stock remaining

---

## 🎯 Feature Examples

### Example 1: Urgent Order Needed
```
╔══════════════════════════════════════════════════════════╗
║ 📦 Paracetamol 500mg (SKU: PARA500)                     ║
╚══════════════════════════════════════════════════════════╝

Status: 🚨 CRITICAL
Current Stock: 30 tablets
Daily Average: 8 tablets (last 30 days)
Stock Duration: 3.75 days

┌─ Suppliers ────────────────────────────────────────────┐
│ ✓ Company A - $0.50/unit - Daily delivery             │
│   Next delivery: Tomorrow (order TODAY)                │
│                                                         │
│   Company B - $0.45/unit - Wed/Fri only               │
│   Next delivery: Wednesday (2 days away)               │
└─────────────────────────────────────────────────────────┘

┌─ Recommendation ───────────────────────────────────────┐
│ 🚨 URGENT: Order TODAY from Company A                  │
│                                                         │
│ Suggested Quantities:                                  │
│ • Conservative: 40 units → Lasts  8.75 days ($20.00)  │
│ • ⭐ Recommended: 60 units → Lasts 11.25 days ($30.00) │
│ • Bulk:         100 units → Lasts 16.25 days ($50.00) │
│                                                         │
│ Why Company A?                                          │
│ → Stock critically low, need immediate delivery        │
│ → Extra cost: $3.00 vs waiting for Company B          │
└─────────────────────────────────────────────────────────┘
```

### Example 2: Plan Ahead Order
```
╔══════════════════════════════════════════════════════════╗
║ 📦 Ibuprofen 400mg (SKU: IBU400)                        ║
╚══════════════════════════════════════════════════════════╝

Status: ✅ GOOD
Current Stock: 85 tablets
Daily Average: 5 tablets (last 30 days)
Stock Duration: 17 days

┌─ Suppliers ────────────────────────────────────────────┐
│   Company A - $0.60/unit - Daily delivery             │
│                                                         │
│ ✓ Company B - $0.55/unit - Wed/Fri only               │
│   Next delivery: Wednesday (2 days away)               │
└─────────────────────────────────────────────────────────┘

┌─ Recommendation ───────────────────────────────────────┐
│ ℹ️  No urgent action needed                            │
│                                                         │
│ Suggested: Order 50 units on Wednesday from Company B │
│ → Total stock: 135 units                               │
│ → Will last: 27 days                                   │
│ → Cost: $27.50 (saves $2.50 vs Company A)             │
│                                                         │
│ Reorder in: ~12 days (before running low)             │
└─────────────────────────────────────────────────────────┘
```

### Example 3: Multiple Analysis Periods
```
╔══════════════════════════════════════════════════════════╗
║ 📦 Amoxicillin 500mg - Historical Analysis              ║
╚══════════════════════════════════════════════════════════╝

Period Comparison:
┌───────────┬──────────────┬──────────────┬──────────────┐
│ Period    │ Avg/Day      │ Peak Day     │ Trend        │
├───────────┼──────────────┼──────────────┼──────────────┤
│ Last Week │ 15 units/day │ 22 units     │ ↑ +12%       │
│ Last Month│ 12 units/day │ 28 units     │ → Stable     │
│ Last Year │ 10 units/day │ 35 units     │ ↑ Growing    │
└───────────┴──────────────┴──────────────┴──────────────┘

Insights:
• Demand increasing (seasonal winter pattern)
• Peak usage typically in December-February
• Current period showing above-average demand

Recommendation:
• Use last 30 days average (12 units/day)
• Order extra 20% buffer for seasonal increase
• Suggested: 120 units → Lasts 10 days
```

---

## 🏗️ Technical Implementation Plan

### Phase 1: Database & Data Model Enhancements

#### 1.1 Supplier Delivery Schedule
**Database Changes:**
```sql
-- Add to Supplier table
ALTER TABLE suppliers ADD COLUMN delivery_schedule JSONB;

-- Example values:
{
  "type": "daily",
  "days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
}

{
  "type": "specific_days",
  "days": ["wednesday", "friday"]
}

{
  "type": "weekly",
  "day": "monday"
}
```

**Prisma Schema Update:**
```prisma
model Supplier {
  id                String   @id @default(cuid())
  name              String
  deliverySchedule  Json?    // New field
  // ... existing fields
}
```

#### 1.2 Product-Supplier Relationships
**New Table:**
```prisma
model ProductSupplier {
  id          String   @id @default(cuid())
  productId   String
  supplierId  String
  unitCost    Decimal
  moq         Int      @default(1)
  isPrimary   Boolean  @default(false)
  lastOrdered DateTime?

  product     Product  @relation(fields: [productId], references: [id])
  supplier    Supplier @relation(fields: [supplierId], references: [id])

  @@unique([productId, supplierId])
}
```

#### 1.3 Enhanced ReorderSuggestion
```prisma
model ReorderSuggestion {
  // ... existing fields

  // New fields
  analysisPeriodDays Int       @default(30)
  stockDuration      Float?    // Days of stock remaining
  urgencyLevel       String?   // CRITICAL, WARNING, GOOD, OVERSTOCKED
  nextDeliveryDate   DateTime?
  scenarios          Json?     // Array of quantity scenarios

  // ... existing fields
}
```

---

### Phase 2: Backend API Enhancements

#### 2.1 Supplier Delivery Calendar Endpoint
```typescript
// GET /suppliers/:id/next-delivery
// Returns: { nextDeliveryDate: "2025-10-02", daysUntil: 2 }

server.get("/:id/next-delivery", async (request, reply) => {
  const { id } = request.params;

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    select: { deliverySchedule: true }
  });

  const nextDate = calculateNextDeliveryDate(supplier.deliverySchedule);

  return {
    nextDeliveryDate: nextDate,
    daysUntil: Math.ceil((nextDate - new Date()) / (1000 * 60 * 60 * 24))
  };
});
```

#### 2.2 Flexible Sales History Endpoint
```typescript
// POST /sales/history
// Body: { storeId, skus, days, period: "week" | "month" | "year" }

server.post("/history", async (request, reply) => {
  const { storeId, skus, period = "month" } = request.body;

  const days = {
    week: 7,
    month: 30,
    quarter: 90,
    year: 365
  }[period] || 30;

  // Fetch sales with custom period
  // ... existing logic with dynamic days
});
```

#### 2.3 Stock Duration Calculator
```typescript
// POST /reorder-suggestions/calculate-duration
// Body: { productId, currentStock, orderQty }

server.post("/calculate-duration", async (request, reply) => {
  const { productId, currentStock, orderQty, days = 30 } = request.body;

  // Get average daily demand
  const avgDemand = await getAverageDailyDemand(productId, days);

  const totalStock = currentStock + orderQty;
  const duration = avgDemand > 0 ? totalStock / avgDemand : 999;

  return {
    currentDuration: currentStock / avgDemand,
    projectedDuration: duration,
    avgDailyDemand: avgDemand
  };
});
```

---

### Phase 3: Python AI Service Enhancements

#### 3.1 Enhanced Recommendation Logic
```python
# apps/svc-forecast/main.py

@app.post("/recommendations-v2")
async def generate_recommendations_v2(req: EnhancedRecommendationRequest):
    """
    Enhanced recommendations with:
    - Custom analysis period
    - Delivery schedule awareness
    - Multi-supplier comparison
    - Stock duration projections
    - Urgency levels
    """

    # Fetch sales history for custom period
    sales_history = await fetch_sales_history(
        req.storeId,
        req.skus,
        req.analysisPeriodDays
    )

    # Fetch supplier delivery schedules
    suppliers = await fetch_supplier_schedules(req.skus)

    suggestions = []

    for sku in req.skus:
        history = sales_history.get(sku, [])

        # Calculate statistics
        mean_demand = sum(history) / len(history) if history else 0
        std_dev = calculate_std_dev(history)

        # Get current stock
        current_stock = await fetch_current_stock(req.storeId, sku)

        # Calculate stock duration
        days_remaining = current_stock / mean_demand if mean_demand > 0 else 999

        # Determine urgency
        urgency = "CRITICAL" if days_remaining < 3 else \
                  "WARNING" if days_remaining < 7 else \
                  "GOOD" if days_remaining < 30 else \
                  "OVERSTOCKED"

        # Get supplier options
        product_suppliers = suppliers.get(sku, [])

        # Calculate next delivery dates
        delivery_options = []
        for supplier in product_suppliers:
            next_delivery = calculate_next_delivery(supplier['deliverySchedule'])
            days_until = (next_delivery - datetime.now()).days

            delivery_options.append({
                "supplierId": supplier['id'],
                "supplierName": supplier['name'],
                "unitCost": supplier['unitCost'],
                "nextDelivery": next_delivery,
                "daysUntil": days_until,
                "deliverySchedule": supplier['deliverySchedule']
            })

        # Sort by urgency - if critical, prefer soonest delivery
        if urgency == "CRITICAL":
            delivery_options.sort(key=lambda x: x['daysUntil'])
        else:
            # Otherwise prefer cheapest
            delivery_options.sort(key=lambda x: x['unitCost'])

        # Calculate scenarios (multiple order quantities)
        scenarios = []
        for multiplier in [0.5, 1.0, 1.5]:
            lead_time = delivery_options[0]['daysUntil'] if delivery_options else 7
            base_qty = int(mean_demand * lead_time * 2)
            order_qty = int(base_qty * multiplier)

            projected_stock = current_stock + order_qty
            projected_duration = projected_stock / mean_demand if mean_demand > 0 else 999

            scenarios.append({
                "orderQty": order_qty,
                "projectedStock": projected_stock,
                "projectedDuration": round(projected_duration, 2),
                "cost": order_qty * delivery_options[0]['unitCost'] if delivery_options else 0
            })

        # Calculate ROP and safety stock
        lead_time = delivery_options[0]['daysUntil'] if delivery_options else 7
        safety_stock = calculate_safety_stock(std_dev, lead_time, req.zScore)
        rop = calculate_rop(mean_demand, lead_time, safety_stock)

        suggestions.append({
            "sku": sku,
            "currentStock": current_stock,
            "daysRemaining": round(days_remaining, 2),
            "urgency": urgency,
            "meanDemand": round(mean_demand, 2),
            "stdDevDemand": round(std_dev, 2),
            "rop": rop,
            "safetyStock": safety_stock,
            "deliveryOptions": delivery_options,
            "scenarios": scenarios,
            "recommendedSupplier": delivery_options[0] if delivery_options else None,
            "recommendedQty": scenarios[1]['orderQty'] if len(scenarios) > 1 else 0,
            "analysisPeriodDays": req.analysisPeriodDays
        })

    return {
        "suggestions": suggestions,
        "generatedAt": datetime.now().isoformat()
    }
```

#### 3.2 Delivery Date Calculator
```python
def calculate_next_delivery(schedule: dict) -> datetime:
    """Calculate next delivery date based on supplier schedule"""
    today = datetime.now()
    schedule_type = schedule.get('type')

    if schedule_type == 'daily':
        # Next day
        return today + timedelta(days=1)

    elif schedule_type == 'specific_days':
        days = schedule.get('days', [])
        # Find next occurrence of any of these days
        for i in range(1, 8):
            next_date = today + timedelta(days=i)
            day_name = next_date.strftime('%A').lower()
            if day_name in days:
                return next_date
        return today + timedelta(days=7)  # Fallback

    elif schedule_type == 'weekly':
        target_day = schedule.get('day', 'monday')
        # Find next occurrence of this day
        for i in range(1, 8):
            next_date = today + timedelta(days=i)
            if next_date.strftime('%A').lower() == target_day:
                return next_date
        return today + timedelta(days=7)

    else:
        # Unknown schedule, assume weekly
        return today + timedelta(days=7)
```

---

### Phase 4: Frontend UI Enhancements

#### 4.1 Period Selector Component
```tsx
// components/PeriodSelector.tsx
<div className="flex gap-2">
  <button
    onClick={() => setPeriod('week')}
    className={period === 'week' ? 'active' : ''}
  >
    Last Week
  </button>
  <button
    onClick={() => setPeriod('month')}
    className={period === 'month' ? 'active' : ''}
  >
    Last Month
  </button>
  <button
    onClick={() => setPeriod('quarter')}
    className={period === 'quarter' ? 'active' : ''}
  >
    Last 90 Days
  </button>
  <button
    onClick={() => setPeriod('year')}
    className={period === 'year' ? 'active' : ''}
  >
    Last Year
  </button>
</div>
```

#### 4.2 Enhanced Suggestion Card
```tsx
<div className={`suggestion-card urgency-${suggestion.urgency.toLowerCase()}`}>
  {/* Header with urgency indicator */}
  <div className="header">
    <div className="product-info">
      <h3>{suggestion.product.name}</h3>
      <span className="sku">{suggestion.sku}</span>
    </div>
    <div className={`urgency-badge ${suggestion.urgency}`}>
      {suggestion.urgency}
    </div>
  </div>

  {/* Stock info */}
  <div className="stock-info">
    <div className="metric">
      <label>Current Stock</label>
      <span>{suggestion.currentStock} units</span>
    </div>
    <div className="metric">
      <label>Will Last</label>
      <span className="highlight">{suggestion.daysRemaining} days</span>
    </div>
    <div className="metric">
      <label>Daily Usage</label>
      <span>{suggestion.meanDemand} units/day</span>
    </div>
  </div>

  {/* Delivery options */}
  <div className="delivery-options">
    <h4>Supplier Options</h4>
    {suggestion.deliveryOptions.map(option => (
      <div key={option.supplierId} className="delivery-option">
        <div className="supplier-name">{option.supplierName}</div>
        <div className="delivery-info">
          <span className="next-delivery">
            Next: {formatDate(option.nextDelivery)}
            ({option.daysUntil} days)
          </span>
          <span className="price">${option.unitCost}/unit</span>
        </div>
      </div>
    ))}
  </div>

  {/* Scenarios */}
  <div className="scenarios">
    <h4>Order Scenarios</h4>
    {suggestion.scenarios.map((scenario, idx) => (
      <div key={idx} className={`scenario ${idx === 1 ? 'recommended' : ''}`}>
        <div className="scenario-label">
          {idx === 0 ? '🔹 Conservative' :
           idx === 1 ? '⭐ Recommended' :
           '🔸 Bulk'}
        </div>
        <div className="scenario-details">
          <span>Order {scenario.orderQty} units</span>
          <span>→ Total {scenario.projectedStock} units</span>
          <span>→ Lasts {scenario.projectedDuration} days</span>
          <span className="cost">${scenario.cost.toFixed(2)}</span>
        </div>
      </div>
    ))}
  </div>

  {/* Actions */}
  <div className="actions">
    <button className="btn-approve">
      Approve & Create PO
    </button>
    <button className="btn-adjust">
      Adjust Quantity
    </button>
    <button className="btn-reject">
      Reject
    </button>
  </div>
</div>
```

#### 4.3 Delivery Calendar View
```tsx
<div className="delivery-calendar">
  <h3>This Week's Deliveries</h3>
  <div className="week-view">
    {weekDays.map(day => (
      <div key={day} className="day-column">
        <div className="day-header">{day}</div>
        <div className="deliveries">
          {getDeliveriesForDay(day).map(supplier => (
            <div className="supplier-badge">
              {supplier.name}
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
</div>
```

---

## 📊 Data Flow

```
┌──────────────┐
│  User clicks │
│  "Generate"  │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────┐
│ Frontend sends:              │
│ - storeId                    │
│ - analysisPeriod: "month"    │
│ - serviceLevel: 0.95         │
└──────────┬───────────────────┘
           │
           ▼
┌───────────────────────────────────────┐
│ Node.js API:                          │
│ 1. Get products                       │
│ 2. Get suppliers with schedules       │
│ 3. Get product-supplier relationships │
└──────────┬────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────┐
│ Python AI Service:                     │
│ 1. Fetch sales history (custom period)│
│ 2. Fetch current stock                │
│ 3. Calculate daily averages           │
│ 4. Determine urgency levels           │
│ 5. Find next delivery dates           │
│ 6. Generate multiple scenarios        │
│ 7. Rank suppliers by urgency/cost     │
└──────────┬─────────────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ Node.js API:                     │
│ 1. Save suggestions to DB        │
│ 2. Return to frontend            │
└──────────┬───────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ Frontend displays:              │
│ - Urgency indicators            │
│ - Delivery options              │
│ - Stock duration                │
│ - Multiple scenarios            │
│ - Smart recommendations         │
└─────────────────────────────────┘
```

---

## 🎨 UI Mockup Color Coding

### Urgency Levels
- **🔴 CRITICAL**: Red background, white text, pulsing animation
- **🟡 WARNING**: Yellow background, dark text
- **🟢 GOOD**: Green background, white text
- **🔵 OVERSTOCKED**: Blue background, white text

### Delivery Status
- **Today/Tomorrow**: Green badge, urgent icon
- **This week**: Blue badge
- **Next week**: Gray badge
- **No delivery soon**: Red badge, warning icon

---

## 📅 Implementation Timeline

### Week 1: Database & Backend Foundation
- [ ] Day 1-2: Database schema updates
- [ ] Day 3-4: Supplier delivery schedule API
- [ ] Day 5: Product-supplier relationship API
- [ ] Day 6-7: Enhanced sales history endpoint

### Week 2: Python AI Service
- [ ] Day 1-3: Enhanced recommendation algorithm
- [ ] Day 4-5: Delivery date calculator
- [ ] Day 6: Scenario generator
- [ ] Day 7: Testing & refinement

### Week 3: Frontend UI
- [ ] Day 1-2: Period selector component
- [ ] Day 3-4: Enhanced suggestion cards
- [ ] Day 5: Delivery calendar view
- [ ] Day 6-7: Integration & styling

### Week 4: Testing & Polish
- [ ] Day 1-2: End-to-end testing
- [ ] Day 3-4: User acceptance testing
- [ ] Day 5: Bug fixes
- [ ] Day 6: Performance optimization
- [ ] Day 7: Documentation & deployment

---

## 🧪 Testing Scenarios

### Scenario 1: Critical Stock, Daily Delivery
```
Given:
- Product has 25 units
- Daily usage: 10 units
- Supplier A: Daily delivery, $1.00/unit
- Supplier B: Wed/Fri, $0.90/unit
- Today: Monday

Expected:
- Urgency: CRITICAL (2.5 days left)
- Recommendation: Order TODAY from Supplier A
- Suggested qty: 70 units (7 days coverage)
- Message: "Order today for tomorrow delivery!"
```

### Scenario 2: Good Stock, Wait for Cheaper
```
Given:
- Product has 150 units
- Daily usage: 10 units
- Supplier A: Daily, $1.00/unit
- Supplier B: Wed/Fri, $0.80/unit
- Today: Monday

Expected:
- Urgency: GOOD (15 days left)
- Recommendation: Wait for Wednesday, order from Supplier B
- Suggested qty: 70 units
- Message: "Save $14 by ordering from Supplier B on Wednesday"
```

### Scenario 3: Seasonal Pattern Detection
```
Given:
- Analysis periods show:
  - Last week: 20 units/day
  - Last month: 15 units/day
  - Last year: 12 units/day
- Current stock: 100 units

Expected:
- Use last week's data (most recent trend)
- Urgency: WARNING (5 days at current rate)
- Note: "Demand increased 33% vs monthly average"
- Suggested: Order extra 25% buffer
```

---

## 📖 Configuration Examples

### Supplier Delivery Schedules

#### Daily Delivery
```json
{
  "type": "daily",
  "cutoffTime": "14:00",
  "note": "Order before 2 PM for next-day delivery"
}
```

#### Specific Days
```json
{
  "type": "specific_days",
  "days": ["monday", "wednesday", "friday"],
  "cutoffTime": "10:00"
}
```

#### Weekly
```json
{
  "type": "weekly",
  "day": "monday",
  "cutoffTime": "16:00"
}
```

#### Bi-Weekly
```json
{
  "type": "bi_weekly",
  "day": "tuesday",
  "weeks": [1, 3],
  "note": "1st and 3rd Tuesday of each month"
}
```

---

## 🎓 Training & Documentation

### User Guide Topics
1. Understanding urgency levels
2. Reading stock duration projections
3. Comparing supplier options
4. Choosing the right analysis period
5. Interpreting scenarios
6. Delivery calendar usage

### Admin Guide Topics
1. Configuring supplier delivery schedules
2. Setting up product-supplier relationships
3. Adjusting safety stock levels
4. Customizing urgency thresholds
5. Monitoring AI accuracy

---

## 🚀 Future Enhancements (Post-MVP)

### Phase 5: Advanced Features
- [ ] ML-based demand forecasting (ARIMA, Prophet)
- [ ] Seasonal pattern detection
- [ ] Promotion impact analysis
- [ ] Automatic PO generation (zero-touch)
- [ ] Email/SMS alerts for critical stock
- [ ] Supplier performance scoring
- [ ] Price trend analysis
- [ ] Bulk discount optimization

### Phase 6: Integrations
- [ ] Supplier EDI integration (auto-ordering)
- [ ] SMS notifications to suppliers
- [ ] WhatsApp Business API for orders
- [ ] Email purchase orders
- [ ] Accounting system integration

---

## 💡 Business Value

### Key Metrics to Track
- **Stockout reduction**: Target 90% reduction
- **Excess inventory reduction**: Target 30% reduction
- **Cost savings**: Supplier optimization savings
- **Time savings**: Automated ordering saves 2-3 hours/day
- **Cash flow improvement**: Better inventory turnover

### ROI Calculation
```
Current state:
- Manual ordering: 3 hours/day × $20/hour = $60/day
- Stockouts: 5 per week × $100 lost sales = $500/week
- Excess stock: $5000 tied up

With AI system:
- Ordering time: 30 min/day = $10/day (save $50/day)
- Stockouts: 1 per week = $100/week (save $400/week)
- Excess stock: $2000 tied up (free up $3000)

Monthly savings: $1500 + $1600 = $3100
Annual ROI: $37,200
```

---

## 📋 Decision Points

### 1. Analysis Period Defaults
**Question**: What should be the default period?
**Options**:
- [ ] Last 7 days (most recent trend)
- [x] Last 30 days (balanced view)
- [ ] Last 90 days (seasonal view)
- [ ] Auto-detect (use most stable period)

### 2. Supplier Selection Logic
**Question**: When should we prefer expensive but faster delivery?
**Options**:
- [x] Always when stock is critical (<3 days)
- [ ] When price difference is <10%
- [ ] Let user decide
- [ ] Configurable threshold per product

### 3. Urgency Thresholds
**Question**: What defines "critical"?
**Current proposal**:
- Critical: <3 days
- Warning: 3-7 days
- Good: 7-30 days
- Overstocked: >30 days

**Alternative**:
- Use product-specific thresholds
- Based on lead times
- Based on historical stockout risk

### 4. Scenario Quantities
**Question**: What multipliers to use?
**Current**: 0.5x, 1.0x, 1.5x of base calculation
**Alternatives**:
- Fixed quantities (50, 100, 200)
- MOQ-based
- User-defined

---

## 🔧 Technical Decisions

### 1. Delivery Schedule Storage
**Chosen**: JSON field in suppliers table
**Reason**: Flexible, no migration needed for changes
**Alternative**: Separate delivery_schedules table (normalized)

### 2. Calculation Engine
**Chosen**: Python service (FastAPI)
**Reason**: Better math libraries, easy to add ML later
**Alternative**: Node.js service (simpler stack)

### 3. Caching Strategy
**Chosen**: Cache suggestions for 1 hour
**Reason**: Sales don't change that frequently
**Alternative**: Real-time always (slower)

### 4. Historical Data Storage
**Chosen**: Keep all sales forever
**Reason**: Needed for yearly analysis
**Alternative**: Archive after 2 years

---

## 📞 Contacts & Resources

### Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] User guide
- [ ] Admin guide
- [ ] Video tutorials

### Support
- [ ] In-app help tooltips
- [ ] FAQ section
- [ ] Support ticket system
- [ ] Training materials

---

## ✅ Acceptance Criteria

### Must Have (MVP)
- [ ] Custom analysis period selection (week/month/year)
- [ ] Supplier delivery schedule configuration
- [ ] Next delivery date calculation
- [ ] Multiple supplier options per product
- [ ] Stock duration projections
- [ ] 3 quantity scenarios per product
- [ ] Urgency level indicators
- [ ] Delivery-aware recommendations

### Nice to Have
- [ ] Delivery calendar view
- [ ] Supplier comparison chart
- [ ] Historical trend graphs
- [ ] Export recommendations to PDF
- [ ] Email digest of urgent items

### Future
- [ ] ML-based forecasting
- [ ] Auto-ordering
- [ ] Supplier integrations
- [ ] Mobile app

---

*Last Updated: 2025-09-30*
*Status: Planning Phase*
*Owner: Development Team*