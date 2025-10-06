# ✅ Product Search - Final Fix

## Problem
Searching for products (e.g., "parar") returns no results even though products exist in database.

## Root Cause Found
**Meilisearch API key mismatch:**
- API Core was using wrong key from `.env`
- Couldn't add documents to search index
- Index had 0 documents

## Fix Applied

### 1. Updated Environment Variable
**File:** `.env`
```bash
# Changed from:
MEILI_MASTER_KEY=masterKey123456

# To:
MEILI_MASTER_KEY=masterKeyForDevelopment123
```

### 2. What Needs to Happen Next

**The API Core service needs to restart to pick up the new configuration.**

#### Option A: Manual Restart (Recommended)
```bash
# Stop current API Core process (Ctrl+C in its terminal)
# Then restart:
cd apps/api-core
pnpm dev
```

#### Option B: Use pnpm dev (restart all)
```bash
# From project root
./scripts/stop-all.sh
pnpm dev
```

### 3. After Restart - Sync Products

Once API Core is running with the new key:

```bash
# Get auth token
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@pharmacy.com","password":"admin123"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["accessToken"])')

# Sync all products to Meilisearch
curl -X POST http://localhost:4000/products/sync-all \
  -H "Authorization: Bearer $TOKEN"

# Should return:
# {"message":"Synced 28 products to search index"}
```

### 4. Verify Fix

```bash
# Wait a few seconds for indexing
sleep 3

# Check Meilisearch has documents
curl http://localhost:7701/indexes/products/stats \
  -H "Authorization: Bearer masterKeyForDevelopment123"

# Should show: "numberOfDocuments": 28 (or similar)

# Test search
curl "http://localhost:4000/products?query=paracetamol&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Should return products array with Paracetamol products
```

### 5. Test in Browser

1. Refresh http://localhost:5173
2. Go to any page with product search
3. Type "parar" or "paracetamol"
4. Should see results!

## Why This Happened

The meilisearch client is initialized when the API Core starts:

```typescript
// apps/api-core/src/lib/meilisearch.ts
export const meiliClient = new MeiliSearch({
  host: config.meilisearch.host,
  apiKey: config.meilisearch.apiKey,  // ← Loaded at startup
});
```

When the API key in `.env` was wrong, all `addDocuments` calls failed silently, leaving the index empty.

## Current Status

✅ `.env` file updated with correct key  
⏳ **API Core restart needed** (manual step)  
⏳ Products sync needed (after restart)  
⏳ Frontend test (after sync)

## Quick Commands

```bash
# 1. Restart API Core
cd apps/api-core && pnpm dev

# 2. In another terminal - Sync products
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@pharmacy.com","password":"admin123"}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["accessToken"])') && curl -X POST http://localhost:4000/products/sync-all -H "Authorization: Bearer $TOKEN"

# 3. Test search
curl "http://localhost:4000/products?query=parar&limit=10" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; data=json.load(sys.stdin); print(f'Found {len(data.get(\"products\",[]))} products'); [print(f'  - {p[\"name\"]}') for p in data.get('products',[])]"
```

## Expected Output After Fix

```bash
Found 2 products
  - Paracetamol 500mg
  - Paracetamol 1000mg
```

---

**Once API Core restarts and products are synced, product search will work perfectly!** 🎉
