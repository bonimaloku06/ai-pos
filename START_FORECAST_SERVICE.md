# 🔮 Starting the AI Forecast Service

## ⚡ Quick Start

Open a **NEW terminal window** and run:

```bash
cd /Users/shabanmaloku/Desktop/Personal/AiPos/apps/svc-forecast
./start.sh
```

That's it! The service will start on **http://localhost:8000**

## What You'll See

```
🔮 Starting Pharmacy POS Forecast Service...
   Directory: /Users/shabanmaloku/Desktop/Personal/AiPos/apps/svc-forecast

✅ Python environment ready
🚀 Starting forecast service on http://localhost:8000

   Press Ctrl+C to stop

INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

## Verify It's Running

**Test the health endpoint:**
```bash
curl http://localhost:8000/health
```

Should return:
```json
{"status":"ok"}
```

## Now Generate Reorder Suggestions

1. Go to your app: **http://localhost:5173**
2. Login with **admin@pharmacy.com** / **admin123**
3. Navigate to **Replenishment** page
4. Click **"Generate Suggestions"**
5. ✨ **AI magic happens!**

## What the AI Service Does

### Machine Learning Features

1. **Time Series Analysis**
   - Analyzes historical sales patterns
   - Detects seasonal trends
   - Identifies demand patterns

2. **Demand Forecasting**
   - Predicts future demand
   - Calculates average and standard deviation
   - Adjusts for seasonality

3. **Safety Stock Calculation**
   - Uses statistical methods (z-scores)
   - Accounts for demand variability
   - Ensures target service levels (95%, 99%)

4. **Reorder Point (ROP)**
   - Formula: `(avg daily demand × lead time) + safety stock`
   - Considers supplier lead times
   - Accounts for demand uncertainty

5. **Economic Order Quantity (EOQ)**
   - Optimizes order quantities
   - Minimizes ordering and holding costs
   - Generates multiple scenarios

6. **Urgency Levels**
   - **CRITICAL**: Stock below 50% of ROP (order now!)
   - **HIGH**: Stock below ROP (order soon)
   - **MEDIUM**: Stock at ROP level (monitor)
   - **LOW**: Stock above ROP (no action needed)

### API Endpoints

The service exposes several endpoints:

**Health Check:**
```bash
GET /health
```

**Generate Recommendations (V2 - Enhanced):**
```bash
POST /recommendations-v2
```
- Uses real inventory data
- Multi-scenario analysis
- Seasonal adjustments
- Stock duration calculations

**Forecast Demand:**
```bash
POST /forecast
```
- Predicts future demand
- Returns mean and std deviation
- Provides confidence intervals

**Get Metrics:**
```bash
GET /metrics
```
- Forecast accuracy metrics
- MAPE, MAE, RMSE values

## Technical Details

### Libraries Used

- **FastAPI**: Modern Python web framework
- **Uvicorn**: ASGI server
- **NumPy**: Numerical computations
- **Pandas**: Data manipulation
- **SciPy**: Statistical functions
- **Pydantic**: Data validation

### Algorithm Overview

```python
# Simplified version of what the AI does:

1. Fetch historical sales data (30-90 days)
2. Calculate daily demand statistics
   - Mean (average demand per day)
   - Std Dev (demand variability)
   
3. Calculate safety stock
   safety_stock = z_score × std_dev × √lead_time
   
4. Calculate ROP
   rop = (mean_demand × lead_time) + safety_stock
   
5. Determine if reorder needed
   if current_stock < rop:
       recommend_order = True
       
6. Calculate recommended order quantity
   order_qty = (mean_demand × 30) + safety_stock - current_stock
   
7. Generate multiple scenarios
   - Conservative: 15 days supply
   - Recommended: 30 days supply
   - Bulk: 45 days supply
   - Extra Bulk: 60 days supply
```

### Service Level Targets

| Service Level | Z-Score | Meaning |
|---------------|---------|---------|
| 90% | 1.28 | 10% chance of stockout |
| 95% | 1.65 | 5% chance of stockout |
| 99% | 2.33 | 1% chance of stockout |

Higher service levels = more safety stock = less stockouts

## Configuration

### Environment Variables

File: `apps/svc-forecast/.env`

```bash
# API Core connection
API_CORE_URL=http://localhost:4000
API_CORE_TOKEN=your-api-token

# Service port
PORT=8000
```

### Adjust Forecasting Parameters

Edit `main.py` to customize:

```python
# Analysis period (days of history to analyze)
DEFAULT_ANALYSIS_DAYS = 30  # Change to 60 or 90 for more history

# Service level target
DEFAULT_SERVICE_LEVEL = 0.95  # 95% service level

# Forecast horizon
DEFAULT_FORECAST_DAYS = 30  # Predict 30 days ahead
```

## Troubleshooting

### Service Won't Start

**Check Python version:**
```bash
python3 --version
```
Must be 3.9 or higher.

**Reinstall dependencies:**
```bash
cd apps/svc-forecast
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Port 8000 Already in Use

**Find what's using it:**
```bash
lsof -i :8000
```

**Kill the process:**
```bash
kill -9 <PID>
```

**Or use a different port:**
Edit `.env`:
```bash
PORT=8001
```

Then update API Core `.env`:
```bash
FORECAST_SVC_URL=http://localhost:8001
```

### Import Errors

**Missing libraries:**
```bash
cd apps/svc-forecast
source venv/bin/activate
pip install fastapi uvicorn pandas numpy scipy python-dotenv httpx
```

### API Can't Connect

**Check service is running:**
```bash
curl http://localhost:8000/health
```

**Check firewall:**
Make sure localhost connections are allowed.

**Check API Core logs:**
Look for connection errors in the Node.js terminal.

## Performance

### First Request

The first forecast request may take 2-3 seconds because:
1. Loads ML libraries (NumPy, Pandas)
2. Fetches sales history from database
3. Performs statistical calculations

### Subsequent Requests

Much faster (~200-500ms) because:
- Libraries already loaded
- Data cached in memory
- Calculations optimized

### Memory Usage

- Typical: ~200MB RAM
- Peak (during calculation): ~300MB RAM

### Optimization Tips

For better performance:

1. **Increase analysis period gradually**
   - Start with 30 days
   - Move to 60 days as more data accumulates

2. **Cache frequently requested forecasts**
   - Add Redis caching layer
   - Cache forecasts for 1-24 hours

3. **Batch requests**
   - Request multiple SKUs at once
   - Reduces database round trips

4. **Use async processing**
   - Generate forecasts in background
   - Schedule during off-hours

## Monitoring

### View Logs

**Real-time logs:**
```bash
tail -f apps/svc-forecast/forecast.log
```

**Check for errors:**
```bash
grep ERROR apps/svc-forecast/forecast.log
```

### Health Checks

**Simple check:**
```bash
curl http://localhost:8000/health
```

**Detailed check:**
```bash
curl http://localhost:8000/metrics
```

### Request Statistics

The service logs:
- Request count
- Average response time
- Error rate
- Forecast accuracy metrics

## Stopping the Service

Press **Ctrl+C** in the terminal where it's running.

Or kill it:
```bash
pkill -f "python main.py"
```

## Next Steps

1. ✅ **Start the service** (you're here!)
2. ✅ **Verify it's running** (`curl http://localhost:8000/health`)
3. ✅ **Generate suggestions** in the UI
4. ✅ **Review AI recommendations**
5. ✅ **Approve and create POs**

---

## Summary

✅ **Service**: Python FastAPI app on port 8000  
✅ **Purpose**: AI-powered demand forecasting & reorder calculations  
✅ **Start**: `cd apps/svc-forecast && ./start.sh`  
✅ **Test**: `curl http://localhost:8000/health`  
✅ **Use**: Generate suggestions in the UI  

**The AI is now ready to optimize your inventory!** 🎯
