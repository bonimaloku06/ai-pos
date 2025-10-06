# Bug Fix: Prisma Relation Name

## Issue

API was throwing 500 error when generating suggestions:

```
Unknown field `supplierProducts` for include statement on model `Product`
```

## Root Cause

Used incorrect relation name in the API route. The Prisma schema has:

```prisma
model Product {
  // ...
  productSuppliers   ProductSupplier[]  // ← Correct name
}

model ProductSupplier {
  id          String    @id
  productId   String
  product     Product   @relation(...)
  supplierId  String
  supplier    Supplier  @relation(...)
  unitCost    Decimal
  // ...
}
```

## Fix Applied

**File:** `apps/api-core/src/routes/reorder-suggestions.ts`

**Changed:**
```typescript
// BEFORE (incorrect)
supplierProducts: {
  include: {
    supplier: { ... }
  }
}

// Loop:
for (const sp of product.supplierProducts) {
  // ...
}
```

**To:**
```typescript
// AFTER (correct)
productSuppliers: {
  include: {
    supplier: { ... }
  }
}

// Loop:
for (const sp of product.productSuppliers) {
  // ...
}
```

## Changes Made

1. Line 104: `supplierProducts` → `productSuppliers`
2. Line 145: `product.supplierProducts` → `product.productSuppliers`

## Testing

After fix, the API should now:
1. ✅ Fetch products with supplier relationships
2. ✅ Collect pricing from all suppliers
3. ✅ Pass to V3 ML engine
4. ✅ Return intelligent recommendations

## How to Verify

```bash
# Start services
pnpm dev

# Open browser
http://localhost:5173/replenishment

# Login
admin@pharmacy.com / admin123

# Generate suggestions
1. Select coverage period (e.g., 1 Week)
2. Click "Generate AI Suggestions"
3. Should work without 500 error
```

## Status

✅ **FIXED** - Correct Prisma relation name used

The system should now generate AI-powered suggestions successfully!
