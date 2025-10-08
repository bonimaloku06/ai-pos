from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from datetime import datetime
import os
from dotenv import load_dotenv
import httpx
from math import sqrt
from pathlib import Path

# Load .env from the forecast service directory (not root)
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path, override=True)

app = FastAPI(
    title="Pharmacy Forecast Service",
    description="Demand forecasting and replenishment recommendations",
    version="1.0.0"
)

# Force correct API_CORE_URL (override any parent .env)
API_CORE_URL = os.getenv("API_CORE_URL", "http://localhost:14000")
if "3000" in API_CORE_URL or "4000" in API_CORE_URL:
    print(f"[WARNING] Detected wrong API_CORE_URL: {API_CORE_URL}, fixing to port 14000")
    API_CORE_URL = "http://localhost:14000"
API_CORE_TOKEN = os.getenv("API_CORE_TOKEN", "")

# Verify environment variables
print(f"[STARTUP] API_CORE_URL: {API_CORE_URL}")
print(f"[STARTUP] API_CORE_TOKEN configured: {'Yes' if API_CORE_TOKEN else 'No'}")


# Request/Response Models
class RecommendationRequest(BaseModel):
    storeId: str
    asOf: str
    skus: List[str]
    leadTimes: Dict[str, int]
    serviceLevel: float = 0.95


class EnhancedRecommendationRequest(BaseModel):
    storeId: str
    asOf: str
    skus: List[str]
    leadTimes: Dict[str, int]
    currentStock: Dict[str, int] = {}  # Real stock data from Node.js backend
    serviceLevel: float = 0.95
    analysisPeriodDays: int = 30
    zScore: float = 1.65


class ReorderSuggestion(BaseModel):
    sku: str
    currentStock: int
    meanDemand: float
    stdDevDemand: float
    rop: int
    orderQty: int
    safetyStock: int
    reason: Dict[str, Any]


class RecommendationResponse(BaseModel):
    suggestions: List[ReorderSuggestion]
    generatedAt: str


class SimulateRequest(BaseModel):
    sku: str
    storeId: str
    orderQty: int
    leadTimeDays: int
    serviceLevel: float = 0.95


class SimulateResponse(BaseModel):
    sku: str
    projectedCoverage: int
    projectedServiceLevel: float
    estimatedStockout: bool


# Helper functions
async def fetch_sales_history(store_id: str, skus: List[str], days: int = 30) -> Dict[str, List[float]]:
    """Fetch sales history from api-core with custom period"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    f"{API_CORE_URL}/sales/history",
                    json={
                        "storeId": store_id,
                        "skus": skus,
                        "days": days
                    },
                    timeout=30.0
                )

                if response.status_code == 200:
                    data = response.json()
                    return data.get("history", {})
                else:
                    print(f"Failed to fetch sales history: {response.status_code}")
                    print(f"Response: {response.text[:200]}")
                    # Fallback to mock data if API fails
                    return {sku: [10, 12, 8, 15, 11, 9, 13] * 4 for sku in skus}
            except httpx.ConnectError as e:
                print(f"Connection error to API Core: {e}")
                print(f"Is API Core running on {API_CORE_URL}?")
                print(f"Attempted URL: {API_CORE_URL}/sales/history")
                raise

    except Exception as e:
        print(f"Error fetching sales history: {e}")
        print(f"Exception type: {type(e).__name__}")
        print(f"API_CORE_URL: {API_CORE_URL}")
        if hasattr(e, '__cause__'):
            print(f"Cause: {e.__cause__}")
        # Fallback to mock data if API fails
        return {sku: [10, 12, 8, 15, 11, 9, 13] * 4 for sku in skus}


def calculate_next_delivery_date(schedule: Dict[str, Any]) -> datetime:
    """Calculate next delivery date based on supplier schedule"""
    from datetime import timedelta

    today = datetime.now()
    schedule_type = schedule.get('type')

    if schedule_type == 'daily':
        # Next day
        return today + timedelta(days=1)

    elif schedule_type == 'specific_days':
        days = schedule.get('days', [])
        day_map = {
            'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
            'thursday': 4, 'friday': 5, 'saturday': 6
        }

        # Find next occurrence of any of these days
        for i in range(1, 8):
            next_date = today + timedelta(days=i)
            day_name = next_date.strftime('%A').lower()
            if day_name in days:
                return next_date
        return today + timedelta(days=7)  # Fallback

    elif schedule_type == 'weekly':
        target_day = schedule.get('day', 'monday')
        day_map = {
            'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
            'thursday': 4, 'friday': 5, 'saturday': 6
        }
        target_day_num = day_map.get(target_day, 1)

        # Find next occurrence of this day
        for i in range(1, 8):
            next_date = today + timedelta(days=i)
            if next_date.weekday() == target_day_num:
                return next_date
        return today + timedelta(days=7)

    elif schedule_type == 'bi_weekly':
        # Simplified bi-weekly (every 14 days)
        return today + timedelta(days=14)

    else:
        # Unknown schedule, assume weekly
        return today + timedelta(days=7)


async def fetch_current_stock(store_id: str, sku: str) -> int:
    """Fetch current stock level for a product from api-core"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{API_CORE_URL}/batches/inventory-summary",
                params={"storeId": store_id},
                timeout=10.0
            )

            if response.status_code == 200:
                data = response.json()
                inventory = data.get("inventory", [])

                # Find the product by SKU
                for item in inventory:
                    if item.get("product", {}).get("sku") == sku:
                        return item.get("totalQty", 0)

                # Product not found, return 0
                return 0
            else:
                print(f"Failed to fetch inventory: {response.status_code}")
                return 50  # Fallback value

    except Exception as e:
        print(f"Error fetching current stock: {e}")
        return 50  # Fallback value


def calculate_z_score(service_level: float) -> float:
    """Calculate z-score for given service level"""
    if service_level >= 0.99:
        return 2.33
    elif service_level >= 0.95:
        return 1.65
    elif service_level >= 0.90:
        return 1.28
    else:
        return 1.0


def calculate_safety_stock(std_dev: float, lead_time: int, z_score: float) -> int:
    """Calculate safety stock: z * std_dev * sqrt(lead_time)"""
    return int(z_score * std_dev * sqrt(lead_time))


def calculate_rop(mean_demand: float, lead_time: int, safety_stock: int) -> int:
    """Calculate reorder point: (mean_demand * lead_time) + safety_stock"""
    return int(mean_demand * lead_time) + safety_stock


def calculate_order_qty(mean_demand: float, lead_time: int, moq: int = 1) -> int:
    """Calculate order quantity based on demand and lead time"""
    # Simple approach: order enough for 2x lead time
    qty = int(mean_demand * lead_time * 2)
    return max(qty, moq)


# Endpoints
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "forecast", "timestamp": datetime.now().isoformat()}


@app.post("/recommendations", response_model=RecommendationResponse)
async def generate_recommendations(req: RecommendationRequest):
    """
    Generate reorder recommendations for given SKUs

    Steps:
    1. Fetch sales history from api-core
    2. Clean data and detect outliers
    3. Calculate mean and std dev of demand
    4. Calculate safety stock, ROP, and order quantity
    5. Return recommendations
    """
    try:
        # Fetch sales history
        sales_history = await fetch_sales_history(req.storeId, req.skus)

        z_score = calculate_z_score(req.serviceLevel)
        suggestions = []

        for sku in req.skus:
            history = sales_history.get(sku, [])
            if not history:
                continue

            # Calculate statistics
            mean_demand = sum(history) / len(history)
            variance = sum((x - mean_demand) ** 2 for x in history) / len(history)
            std_dev = sqrt(variance)

            lead_time = req.leadTimes.get(sku, 7)  # Default 7 days

            # Calculate reorder parameters
            safety_stock = calculate_safety_stock(std_dev, lead_time, z_score)
            rop = calculate_rop(mean_demand, lead_time, safety_stock)
            order_qty = calculate_order_qty(mean_demand, lead_time)

            # Fetch current stock from api-core
            current_stock = await fetch_current_stock(req.storeId, sku)

            suggestions.append(ReorderSuggestion(
                sku=sku,
                currentStock=current_stock,
                meanDemand=round(mean_demand, 2),
                stdDevDemand=round(std_dev, 2),
                rop=rop,
                orderQty=order_qty,
                safetyStock=safety_stock,
                reason={
                    "leadTimeDays": lead_time,
                    "serviceLevel": req.serviceLevel,
                    "zScore": z_score,
                    "shouldReorder": current_stock <= rop
                }
            ))

        return RecommendationResponse(
            suggestions=suggestions,
            generatedAt=datetime.now().isoformat()
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/simulate", response_model=SimulateResponse)
async def simulate_order(req: SimulateRequest):
    """
    Simulate what-if scenario for an order

    Returns projected coverage and service level
    """
    try:
        # Fetch sales history
        sales_history = await fetch_sales_history(req.storeId, [req.sku])
        history = sales_history.get(req.sku, [])

        if not history:
            raise HTTPException(status_code=404, detail=f"No history found for SKU {req.sku}")

        mean_demand = sum(history) / len(history)

        # Simple simulation: how many days will order_qty last?
        projected_coverage = int(req.orderQty / mean_demand) if mean_demand > 0 else 0

        # Estimate service level based on coverage vs lead time
        projected_service_level = min(0.99, projected_coverage / (req.leadTimeDays * 2))

        return SimulateResponse(
            sku=req.sku,
            projectedCoverage=projected_coverage,
            projectedServiceLevel=round(projected_service_level, 2),
            estimatedStockout=projected_coverage < req.leadTimeDays
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    try:
        from datetime import timedelta

        # Fetch sales history for custom period
        sales_history = await fetch_sales_history(
            req.storeId,
            req.skus,
            req.analysisPeriodDays
        )

        suggestions = []

        for sku in req.skus:
            history = sales_history.get(sku, [])
            if not history:
                continue

            # Calculate statistics
            mean_demand = sum(history) / len(history) if history else 0
            variance = sum((x - mean_demand) ** 2 for x in history) / len(history) if history else 0
            std_dev = sqrt(variance)

            # Use current stock from request (real inventory data from Node.js)
            current_stock = req.currentStock.get(sku, 0)

            # Calculate stock duration
            days_remaining = current_stock / mean_demand if mean_demand > 0 else 999

            # Determine urgency level
            if days_remaining < 3:
                urgency = "CRITICAL"
            elif days_remaining < 7:
                urgency = "WARNING"
            elif days_remaining < 30:
                urgency = "GOOD"
            else:
                urgency = "OVERSTOCKED"

            lead_time = req.leadTimes.get(sku, 7)

            # Calculate ROP and safety stock
            safety_stock = calculate_safety_stock(std_dev, lead_time, req.zScore)
            rop = calculate_rop(mean_demand, lead_time, safety_stock)

            # Calculate multiple quantity scenarios based on coverage duration
            # Order enough to cover: 1 day, 1 week, 1 month
            scenarios = []
            coverage_periods = [
                ("1 Day", 1),
                ("1 Week", 7),
                ("1 Month", 30)
            ]
            
            for label, days_coverage in coverage_periods:
                # Calculate order quantity to cover the specified period
                order_qty = max(0, int(mean_demand * days_coverage) - current_stock)
                projected_stock = current_stock + order_qty
                projected_duration = projected_stock / mean_demand if mean_demand > 0 else 999

                scenarios.append({
                    "label": label,
                    "orderQty": order_qty,
                    "projectedStock": projected_stock,
                    "projectedDuration": round(projected_duration, 2),
                    "coverageDays": days_coverage
                })

            # Calculate next delivery (simplified - using lead time)
            next_delivery = datetime.now() + timedelta(days=lead_time)

            # Use 1-week coverage as the recommended quantity
            recommended_qty = scenarios[1]["orderQty"] if len(scenarios) > 1 else 0
            
            suggestions.append({
                "sku": sku,
                "currentStock": current_stock,
                "daysRemaining": round(days_remaining, 2),
                "urgency": urgency,
                "meanDemand": round(mean_demand, 2),
                "stdDevDemand": round(std_dev, 2),
                "rop": rop,
                "safetyStock": safety_stock,
                "scenarios": scenarios,
                "recommendedQty": recommended_qty,
                "analysisPeriodDays": req.analysisPeriodDays,
                "nextDeliveryDate": next_delivery.isoformat(),
                "reason": {
                    "leadTimeDays": lead_time,
                    "serviceLevel": req.serviceLevel,
                    "zScore": req.zScore,
                    "shouldReorder": current_stock <= rop,
                    "analysisNote": f"Based on {req.analysisPeriodDays} days of historical data"
                }
            })

        return {
            "suggestions": suggestions,
            "generatedAt": datetime.now().isoformat()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/metrics")
async def get_metrics():
    """Return forecast accuracy metrics (MAPE, MAE, etc.)"""
    # TODO: Implement actual metrics calculation
    return {
        "mape": 15.3,  # Mean Absolute Percentage Error
        "mae": 2.1,    # Mean Absolute Error
        "rmse": 3.2,   # Root Mean Square Error
    }


# ==============================================================================
# V3 API - Advanced Forecasting with ML
# ==============================================================================

from forecast_engine import ForecastEngine
from supplier_engine import SupplierSchedule, SupplierOptimizer, PricingEngine
from coverage_calculator import CoverageCalculator


# V3 Request/Response Models
class V3RecommendationRequest(BaseModel):
    storeId: str
    skus: List[str]
    currentStock: Dict[str, int]  # {sku: quantity}
    supplierPrices: Dict[str, Dict[str, float]] = {}  # {sku: {supplier_id: price}}
    coverageDays: int = 7  # Default 1 week
    includeAnalysis: bool = True
    analysisPeriodDays: int = 30


class V3ProductRecommendation(BaseModel):
    sku: str
    currentStock: int
    daysRemaining: float
    urgency: str  # CRITICAL, HIGH, MEDIUM, LOW, GOOD
    pattern: str  # STEADY, GROWING, DECLINING, SEASONAL, ERRATIC
    patternConfidence: float
    trend: Dict[str, Any]
    forecastedDailyDemand: float
    recommendedOrderQty: int
    coverageScenarios: List[Dict[str, Any]]
    supplierOptions: List[Dict[str, Any]]
    recommendation: Dict[str, Any]


class V3RecommendationResponse(BaseModel):
    recommendations: List[Dict[str, Any]]
    generatedAt: str
    summary: Dict[str, Any]


class CoverageScenarioRequest(BaseModel):
    sku: str
    currentStock: int
    dailyDemand: float
    customPeriods: Optional[List[int]] = None
    unitPrice: float
    includeSupplierComparison: bool = False
    supplierPrices: Optional[Dict[str, float]] = None  # {supplier_id: price}


class SupplierComparisonRequest(BaseModel):
    sku: str
    currentStock: int
    dailyDemand: float
    orderQuantity: int
    supplierPrices: Dict[str, float]  # {supplier_id: price}


class DailyActionListRequest(BaseModel):
    storeId: str
    products: List[Dict[str, Any]]  # [{sku, currentStock, dailyDemand, supplierPrices}]


# Initialize engines
forecast_engine = ForecastEngine()
supplier_schedule = SupplierSchedule()
pricing_engine = PricingEngine()
supplier_optimizer = SupplierOptimizer(supplier_schedule, pricing_engine)
coverage_calculator = CoverageCalculator()


@app.post("/v3/recommendations", response_model=V3RecommendationResponse)
async def generate_v3_recommendations(req: V3RecommendationRequest):
    """
    V3 Advanced Recommendations with ML Forecasting
    
    Features:
    - Time series forecasting (seasonal, trend)
    - Multi-supplier optimization
    - Coverage scenarios (1 day, 1 week, 1 month)
    - Pattern classification
    - Smart timing recommendations
    """
    try:
        # Fetch sales history
        sales_history = await fetch_sales_history(
            req.storeId,
            req.skus,
            req.analysisPeriodDays
        )
        
        recommendations = []
        
        for sku in req.skus:
            history = sales_history.get(sku, [])
            if not history or len(history) < 3:
                continue
            
            current_stock = req.currentStock.get(sku, 0)
            
            # Step 1: Forecast Analysis
            if req.includeAnalysis:
                forecast_result = forecast_engine.analyze(history)
                pattern = forecast_result['classification']['pattern']
                confidence = forecast_result['classification']['confidence']
                trend = forecast_result['trend']
                forecasted_demand = forecast_result['forecast']['daily_average']
            else:
                # Fallback to simple average
                forecasted_demand = sum(history) / len(history)
                pattern = 'STEADY'
                confidence = 0.7
                trend = {'direction': 'STEADY', 'slope': 0}
            
            # Step 2: Calculate Coverage
            current_coverage = coverage_calculator.calculate_current_coverage(
                current_stock,
                forecasted_demand
            )
            
            # Step 3: Generate Coverage Scenarios
            scenarios = coverage_calculator.generate_scenarios(
                current_stock,
                forecasted_demand,
                custom_periods=[1, 7, 14, 30]
            )
            
            # Step 4: Get recommended order quantity
            recommended_scenario = coverage_calculator.recommend_scenario(
                current_stock,
                forecasted_demand,
                demand_pattern=pattern,
                lead_time_days=7  # Default
            )
            
            # Step 5: Supplier Optimization (if prices provided)
            supplier_options = []
            if sku in req.supplierPrices and req.supplierPrices[sku]:
                # Set prices in pricing engine
                for supplier_id, price in req.supplierPrices[sku].items():
                    pricing_engine.set_price(sku, supplier_id, price)
                
                # Find optimal supplier
                supplier_comparison = supplier_optimizer.compare_suppliers(
                    sku,
                    current_stock,
                    forecasted_demand,
                    recommended_scenario['order_quantity']
                )
                
                supplier_options = supplier_comparison['all_options']
            
            # Build recommendation
            recommendations.append({
                'sku': sku,
                'currentStock': current_stock,
                'daysRemaining': current_coverage['days_remaining'],
                'urgency': current_coverage['status'],
                'pattern': pattern,
                'patternConfidence': confidence,
                'trend': trend,
                'forecastedDailyDemand': round(forecasted_demand, 2),
                'recommendedOrderQty': recommended_scenario['order_quantity'],
                'recommendedCoverageDays': recommended_scenario['recommended_coverage_days'],
                'coverageScenarios': scenarios['scenarios'],
                'supplierOptions': supplier_options,
                'recommendation': {
                    'message': current_coverage['message'],
                    'action': _determine_action(current_coverage['status']),
                    'reason': recommended_scenario['reason']
                }
            })
        
        # Create summary
        critical_count = sum(1 for r in recommendations if r['urgency'] in ['CRITICAL', 'URGENT'])
        low_count = sum(1 for r in recommendations if r['urgency'] == 'LOW')
        good_count = sum(1 for r in recommendations if r['urgency'] in ['GOOD', 'OVERSTOCKED'])
        
        summary = {
            'totalProducts': len(recommendations),
            'criticalProducts': critical_count,
            'lowStockProducts': low_count,
            'goodStockProducts': good_count,
            'analysisPeriodDays': req.analysisPeriodDays
        }
        
        return V3RecommendationResponse(
            recommendations=recommendations,
            generatedAt=datetime.now().isoformat(),
            summary=summary
        )
    
    except Exception as e:
        import traceback
        print(f"ERROR in v3/recommendations: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


def _determine_action(urgency: str) -> str:
    """Determine action based on urgency"""
    if urgency in ['CRITICAL', 'URGENT']:
        return 'ORDER_TODAY'
    elif urgency == 'LOW':
        return 'ORDER_SOON'
    elif urgency == 'GOOD':
        return 'MONITOR'
    else:
        return 'REDUCE_ORDERS'


@app.post("/v3/coverage-scenarios")
async def get_coverage_scenarios(req: CoverageScenarioRequest):
    """
    Get coverage scenarios for a product
    
    Returns order quantities and costs for different coverage periods
    """
    try:
        # Generate scenarios with pricing
        result = coverage_calculator.calculate_with_pricing(
            req.currentStock,
            req.dailyDemand,
            req.unitPrice,
            req.customPeriods
        )
        
        # Add supplier comparison if requested
        supplier_comparison = None
        if req.includeSupplierComparison and req.supplierPrices:
            supplier_comparison = coverage_calculator.compare_suppliers_coverage(
                req.currentStock,
                req.dailyDemand,
                7,  # 1 week default for comparison
                req.supplierPrices
            )
        
        return {
            'sku': req.sku,
            'currentCoverage': result['current_coverage'],
            'scenarios': result['scenarios'],
            'supplierComparison': supplier_comparison,
            'generatedAt': datetime.now().isoformat()
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v3/supplier-comparison")
async def compare_suppliers(req: SupplierComparisonRequest):
    """
    Compare suppliers for a product order
    
    Returns optimal supplier based on cost, timing, and risk
    """
    try:
        # Set prices
        for supplier_id, price in req.supplierPrices.items():
            pricing_engine.set_price(req.sku, supplier_id, price)
        
        # Get comparison
        result = supplier_optimizer.compare_suppliers(
            req.sku,
            req.currentStock,
            req.dailyDemand,
            req.orderQuantity
        )
        
        return {
            'sku': req.sku,
            'recommended': result['recommended'],
            'allOptions': result['all_options'],
            'maxSavings': result['max_savings'],
            'maxSavingsPercent': result['max_savings_percent'],
            'generatedAt': datetime.now().isoformat()
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v3/daily-action-list")
async def get_daily_action_list(req: DailyActionListRequest):
    """
    Generate daily action list categorized by urgency
    
    Returns:
    - ORDER_TODAY: Critical/urgent items
    - ORDER_SOON: Low stock items
    - MONITOR: Good stock items
    - REDUCE_ORDERS: Overstocked items
    """
    try:
        action_list = {
            'ORDER_TODAY': [],
            'ORDER_SOON': [],
            'MONITOR': [],
            'REDUCE_ORDERS': []
        }
        
        for product in req.products:
            sku = product['sku']
            current_stock = product['currentStock']
            daily_demand = product['dailyDemand']
            
            # Calculate coverage
            coverage = coverage_calculator.calculate_current_coverage(
                current_stock,
                daily_demand
            )
            
            # Determine action
            action = _determine_action(coverage['status'])
            
            # Get supplier options if prices provided
            supplier_options = []
            if 'supplierPrices' in product and product['supplierPrices']:
                for supplier_id, price in product['supplierPrices'].items():
                    pricing_engine.set_price(sku, supplier_id, price)
                
                supplier_comparison = supplier_optimizer.compare_suppliers(
                    sku,
                    current_stock,
                    daily_demand,
                    int(daily_demand * 7)  # 1 week default
                )
                supplier_options = supplier_comparison['all_options']
            
            # Add to appropriate list
            action_list[action].append({
                'sku': sku,
                'currentStock': current_stock,
                'daysRemaining': coverage['days_remaining'],
                'urgency': coverage['status'],
                'message': coverage['message'],
                'supplierOptions': supplier_options
            })
        
        return {
            'storeId': req.storeId,
            'actionList': action_list,
            'summary': {
                'orderToday': len(action_list['ORDER_TODAY']),
                'orderSoon': len(action_list['ORDER_SOON']),
                'monitor': len(action_list['MONITOR']),
                'reduceOrders': len(action_list['REDUCE_ORDERS'])
            },
            'generatedAt': datetime.now().isoformat()
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.on_event("startup")
async def startup_event():
    """Test API Core connectivity on startup"""
    print("=" * 60)
    print("Testing API Core connectivity...")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{API_CORE_URL}/health")
            if response.status_code == 200:
                print(f"✓ API Core reachable at {API_CORE_URL}")
            else:
                print(f"✗ API Core returned status {response.status_code}")
    except Exception as e:
        print(f"✗ Cannot reach API Core: {e}")
        print(f"  Make sure API Core is running on {API_CORE_URL}")
    print("=" * 60)


@app.get("/v3/health")
async def v3_health_check():
    """Health check for V3 API with engine status"""
    return {
        'status': 'ok',
        'version': 'v3',
        'engines': {
            'forecast': 'initialized',
            'supplier': 'initialized',
            'coverage': 'initialized'
        },
        'suppliers': [s.to_dict() for s in supplier_schedule.list_suppliers()],
        'timestamp': datetime.now().isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    # Use FORECAST_PORT or default to 18000 (avoid conflict with API_CORE_PORT)
    port = int(os.getenv("FORECAST_PORT", os.getenv("PORT", "18000")))
    if port == 14000:  # If root .env PORT=14000, use 18000 for forecast
        port = 18000
    print(f"Starting Forecast Service on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)