# Product Search Fix - In Progress

## Issue
Product search returns no results because Meilisearch index is empty (0 documents).

## Root Cause
`.env` file had wrong Meilisearch API key:
- `.env` had: `masterKey123456`
- Docker container uses: `masterKeyForDevelopment123`

## Fix Applied
Updated `.env` with correct key: `MEILI_MASTER_KEY=masterKeyForDevelopment123`

## Next Steps
1. API Core needs to restart to pick up new config
2. Run sync-all endpoint again
3. Verify products are indexed
4. Test search

## To Complete the Fix

```bash
# 1. Restart API Core (if not auto-restarted)
cd apps/api-core
# Kill and restart

# 2. Sync products
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@pharmacy.com","password":"admin123"}' \
  | jq -r '.accessToken')

curl -X POST http://localhost:4000/products/sync-all \
  -H "Authorization: Bearer $TOKEN"

# 3. Wait and verify
sleep 5
curl http://localhost:7701/indexes/products/stats \
  -H "Authorization: Bearer masterKeyForDevelopment123"

# 4. Test search
curl "http://localhost:4000/products?query=paracetamol&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

## Expected Result
- Meilisearch index should have ~28-30 products
- Searching for "parar" or "paracetamol" should return results
- Frontend product search should work
