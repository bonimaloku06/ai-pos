# ✅ Final Fix - Multiple .env Files Issue

## The Real Problem

Your project has **multiple .env files**:
```
/Users/shabanmaloku/Desktop/Personal/AiPos/.env                    ✅ (root - correct ports)
/Users/shabanmaloku/Desktop/Personal/AiPos/apps/api-core/.env     ❌ (had old ports)
/Users/shabanmaloku/Desktop/Personal/AiPos/apps/svc-forecast/.env ✅ (okay)
```

When running `pnpm dev`, the **api-core/.env was taking priority** over the root .env, so it kept using the old ports.

## Solution Applied ✅

Updated `/apps/api-core/.env` with all new ports:

```bash
# Before
DATABASE_URL=postgresql://pharmacy:pharmacy123@localhost:5432/pharmacy_pos
REDIS_URL=redis://localhost:6379
MEILI_HOST=http://localhost:7700
S3_ENDPOINT=http://localhost:9000
SMTP_PORT=1025

# After
DATABASE_URL=postgresql://pharmacy:pharmacy123@localhost:5433/pharmacy_pos
REDIS_URL=redis://localhost:6380
MEILI_HOST=http://localhost:7701
S3_ENDPOINT=http://localhost:9100
SMTP_PORT=1026
```

## Now Start Your App

**Stop the current process** (Ctrl+C if still running), then:

```bash
pnpm dev
```

It should now start **without errors**! 🎉

## Expected Output

You should see:
```
✅ Server listening on http://localhost:4000
✅ API Documentation available at http://localhost:4000/docs
✅ (No Meilisearch errors!)
```

## Why Multiple .env Files?

When dotenv loads:
1. It looks for `.env` in the **current working directory**
2. For `api-core`, when running `tsx watch src/index.ts`, the CWD is `apps/api-core`
3. So it loads `apps/api-core/.env` **first**
4. Root `.env` is ignored

## Going Forward

### Option 1: Keep Both Files in Sync (Current)
- Root `.env` - for Docker compose
- `apps/api-core/.env` - for the API application
- **Important**: Update both when changing ports

### Option 2: Use Only Root .env (Alternative)
Delete `apps/api-core/.env` and modify the start script to load from root:

```json
// apps/api-core/package.json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx watch --env-file=../../.env src/index.ts"
  }
}
```

I recommend **Option 1** (current approach) as it's simpler and works with the existing setup.

## Port Configuration Summary

All three locations now have matching ports:

| Service       | Port  |
|---------------|-------|
| PostgreSQL    | 5433  |
| Redis         | 6380  |
| Meilisearch   | 7701  |
| MinIO API     | 9100  |
| MinIO Console | 9101  |
| Prometheus    | 9091  |
| Grafana       | 3003  |
| MailHog SMTP  | 1026  |
| MailHog UI    | 8026  |

## Files with Port Configuration

1. ✅ `/infra/docker/docker-compose.yml` - Docker services
2. ✅ `/.env` - Root environment (for Docker)
3. ✅ `/apps/api-core/.env` - API Core environment
4. ✅ `/apps/api-core/src/config.ts` - Default fallback values

**All four are now synchronized!**

## Verification

After starting with `pnpm dev`, verify:

```bash
# Check Meilisearch connection
curl http://localhost:7701/health
# Should return: {"status":"available"}

# Check API health
curl http://localhost:4000/health

# Check Redis
redis-cli -p 6380 ping
# Should return: PONG
```

## Troubleshooting

If you still get errors:

1. **Make sure Docker is running:**
   ```bash
   docker ps | grep pharmacy
   ```
   Should show 7 containers.

2. **Restart Docker services:**
   ```bash
   ./infra/docker/stop.sh
   ./infra/docker/start.sh
   ```

3. **Clear any caches:**
   ```bash
   rm -rf apps/api-core/dist
   rm -rf apps/web/dist
   rm -rf .turbo
   ```

4. **Restart application:**
   ```bash
   pnpm dev
   ```

## Summary

✅ **Root cause**: Multiple .env files with conflicting values  
✅ **Fix**: Updated `apps/api-core/.env` to match new ports  
✅ **Status**: All configuration files now synchronized  
✅ **Action**: Restart with `pnpm dev` - should work now!  

---

**Try it now - your app should start successfully!** 🚀
