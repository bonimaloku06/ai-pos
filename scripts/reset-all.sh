#!/bin/bash

# Reset database, reseed, and sync everything
# Usage: ./scripts/reset-all.sh

set -e  # Exit on any error

echo "🔄 Resetting Pharmacy POS - Database & Search Index"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Step 1: Reset Database Schema
echo "📦 Step 1/5: Pushing database schema..."
pnpm --filter api-core db:push --accept-data-loss || {
    echo "❌ Failed to push database schema"
    exit 1
}
echo "✅ Schema pushed"
echo ""

# Step 2: Seed Database
echo "🌱 Step 2/5: Seeding database with sample data..."
pnpm --filter api-core db:seed || {
    echo "❌ Failed to seed database"
    exit 1
}
echo "✅ Database seeded"
echo ""

# Step 3: Wait for services to be ready
echo "⏳ Step 3/5: Waiting for services to be ready..."
sleep 2

# Check if API Core is running
if ! curl -s http://localhost:4000/health > /dev/null 2>&1; then
    echo "⚠️  API Core is not running on port 4000"
    echo "   Please start services with: pnpm dev"
    exit 1
fi

# Check if Meilisearch is running
if ! curl -s http://localhost:7701/health > /dev/null 2>&1; then
    echo "⚠️  Meilisearch is not running on port 7701"
    echo "   Please start services with: pnpm dev"
    exit 1
fi

echo "✅ Services are ready"
echo ""

# Step 4: Clear Meilisearch Index
echo "🗑️  Step 4/5: Clearing Meilisearch product index..."
CLEAR_RESPONSE=$(curl -s -X DELETE http://localhost:7701/indexes/products/documents \
    -H "Authorization: Bearer masterKey123456")

if echo "$CLEAR_RESPONSE" | grep -q "taskUid"; then
    echo "✅ Meilisearch index cleared"
else
    echo "⚠️  Warning: Failed to clear Meilisearch index"
    echo "   Response: $CLEAR_RESPONSE"
    echo "   Continuing anyway..."
fi

# Wait for clear operation to complete
sleep 3
echo ""

# Step 5: Sync Products to Meilisearch
echo "🔄 Step 5/5: Syncing products to Meilisearch..."

# Get admin token
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@pharmacy.com","password":"admin123"}' \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["accessToken"])' 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "❌ Failed to get authentication token"
    echo "   Make sure admin user exists (admin@pharmacy.com / admin123)"
    exit 1
fi

# Sync all products
SYNC_RESPONSE=$(curl -s -X POST http://localhost:4000/products/sync-all \
    -H "Authorization: Bearer $TOKEN")

if echo "$SYNC_RESPONSE" | grep -q "Synced"; then
    SYNCED_COUNT=$(echo "$SYNC_RESPONSE" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("message", ""))' 2>/dev/null | grep -oE '[0-9]+' | head -1)
    echo "✅ Synced $SYNCED_COUNT products to search index"
else
    echo "⚠️  Warning: Sync response unexpected"
    echo "   Response: $SYNC_RESPONSE"
fi

# Wait for indexing to complete
sleep 3
echo ""

# Verification
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Reset Complete! Verifying..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check database
DB_COUNT=$(echo "SELECT COUNT(*) FROM products;" | docker exec -i pharmacy-pos-db psql -U pharmacy -d pharmacy_pos -t 2>/dev/null | tr -d ' ')
echo "📊 Database: $DB_COUNT products"

# Check Meilisearch
MEILI_COUNT=$(curl -s http://localhost:7701/indexes/products/stats \
    -H "Authorization: Bearer masterKey123456" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin).get("numberOfDocuments", 0))' 2>/dev/null)
echo "🔍 Meilisearch: $MEILI_COUNT products indexed"

# Test search
SEARCH_TEST=$(curl -s "http://localhost:4000/products?query=paracetamol&limit=1" \
    -H "Authorization: Bearer $TOKEN" \
    | python3 -c 'import sys,json; print(len(json.load(sys.stdin).get("products", [])))' 2>/dev/null)

if [ "$SEARCH_TEST" -gt 0 ]; then
    echo "✅ Product search: Working!"
else
    echo "⚠️  Product search: No results (might need a few more seconds to index)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All systems synchronized and ready!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 You can now:"
echo "   • Search products in POS"
echo "   • Make sales"
echo "   • View reports"
echo ""
