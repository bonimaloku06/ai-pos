"""
Coverage Calculator - Stock Duration Scenarios

Calculates:
- How long current stock will last
- Order quantity for desired coverage (1 day, 1 week, 1 month)
- Projected stock levels
- Multiple scenarios comparison
"""

from typing import List, Dict, Optional
from datetime import datetime, timedelta
import math


class CoverageCalculator:
    """Calculate stock coverage scenarios"""
    
    # Maximum days we care about (prevent datetime overflow)
    MAX_COVERAGE_DAYS = 365  # 1 year maximum
    
    def __init__(self):
        self.standard_periods = [1, 7, 14, 30, 60, 90]  # Days
    
    def _safe_future_date(self, days: float) -> Optional[str]:
        """
        Safely calculate future date, capping at max Python datetime
        Returns None if date would be too far in future
        """
        if days >= self.MAX_COVERAGE_DAYS:
            return None
        
        try:
            future_date = datetime.now() + timedelta(days=days)
            return future_date.isoformat()
        except (OverflowError, ValueError):
            return None
    
    def calculate_current_coverage(
        self,
        current_stock: float,
        daily_demand: float
    ) -> Dict:
        """
        Calculate how long current stock will last
        """
        if daily_demand <= 0 or daily_demand < 0.001:
            return {
                'current_stock': current_stock,
                'daily_demand': daily_demand,
                'days_remaining': self.MAX_COVERAGE_DAYS,
                'stockout_date': None,
                'status': 'NO_DEMAND',
                'message': 'No demand detected - stock will last indefinitely'
            }
        
        days_remaining = current_stock / daily_demand
        
        # Cap days_remaining to prevent datetime overflow
        days_remaining = min(days_remaining, self.MAX_COVERAGE_DAYS)
        
        # Safe date calculation
        stockout_date = self._safe_future_date(days_remaining)
        
        if days_remaining < 1:
            status = 'CRITICAL'
            message = f'CRITICAL: Stock will run out in {days_remaining:.1f} days'
        elif days_remaining < 3:
            status = 'URGENT'
            message = f'URGENT: Only {days_remaining:.1f} days of stock remaining'
        elif days_remaining < 7:
            status = 'LOW'
            message = f'LOW: {days_remaining:.1f} days of stock remaining'
        elif days_remaining < 30:
            status = 'GOOD'
            message = f'GOOD: {days_remaining:.1f} days of stock remaining'
        else:
            status = 'OVERSTOCKED'
            message = f'OVERSTOCKED: {days_remaining:.1f} days of stock remaining'
        
        return {
            'current_stock': current_stock,
            'daily_demand': daily_demand,
            'days_remaining': round(days_remaining, 2),
            'stockout_date': stockout_date,
            'status': status,
            'message': message
        }
    
    def calculate_order_quantity(
        self,
        current_stock: float,
        daily_demand: float,
        target_coverage_days: int,
        include_safety_stock: bool = True,
        safety_factor: float = 1.2
    ) -> Dict:
        """
        Calculate order quantity needed for target coverage
        """
        if daily_demand <= 0 or daily_demand < 0.001:
            return {
                'order_quantity': 0,
                'target_coverage_days': target_coverage_days,
                'current_stock': current_stock,
                'final_stock': current_stock,
                'actual_coverage_days': self.MAX_COVERAGE_DAYS,
                'includes_safety_stock': include_safety_stock,
                'safety_factor': safety_factor if include_safety_stock else 1.0,
                'daily_demand': 0,
                'message': 'No demand - no order needed'
            }
        
        # Calculate base requirement
        required_stock = daily_demand * target_coverage_days
        
        # Apply safety factor if requested
        if include_safety_stock:
            required_stock *= safety_factor
        
        # Calculate order quantity (never negative)
        order_quantity = max(0, math.ceil(required_stock - current_stock))
        
        # Calculate actual coverage after order
        final_stock = current_stock + order_quantity
        actual_coverage = final_stock / daily_demand
        
        return {
            'order_quantity': order_quantity,
            'target_coverage_days': target_coverage_days,
            'current_stock': current_stock,
            'final_stock': final_stock,
            'actual_coverage_days': round(actual_coverage, 2),
            'includes_safety_stock': include_safety_stock,
            'safety_factor': safety_factor if include_safety_stock else 1.0,
            'daily_demand': daily_demand
        }
    
    def generate_scenarios(
        self,
        current_stock: float,
        daily_demand: float,
        custom_periods: Optional[List[int]] = None,
        include_safety_stock: bool = True,
        safety_factor: float = 1.2
    ) -> Dict:
        """
        Generate multiple coverage scenarios
        
        Returns scenarios for 1 day, 1 week, 2 weeks, 1 month, etc.
        """
        periods = custom_periods if custom_periods else self.standard_periods
        
        scenarios = []
        
        for days in periods:
            calc = self.calculate_order_quantity(
                current_stock,
                daily_demand,
                days,
                include_safety_stock,
                safety_factor
            )
            
            # Calculate cost estimate (per unit price to be provided by caller)
            scenarios.append({
                'label': self._period_label(days),
                'coverage_days': days,
                'order_quantity': calc['order_quantity'],
                'final_stock': calc['final_stock'],
                'actual_coverage': calc['actual_coverage_days'],
                'includes_safety_stock': include_safety_stock,
                'safety_factor': calc['safety_factor']
            })
        
        # Current coverage
        current_coverage = self.calculate_current_coverage(current_stock, daily_demand)
        
        return {
            'current_coverage': current_coverage,
            'scenarios': scenarios,
            'daily_demand': daily_demand,
            'safety_factor': safety_factor if include_safety_stock else 1.0
        }
    
    def recommend_scenario(
        self,
        current_stock: float,
        daily_demand: float,
        demand_pattern: str = 'STEADY',
        lead_time_days: int = 7
    ) -> Dict:
        """
        Recommend optimal coverage period based on demand pattern
        
        Patterns:
        - STEADY: 2-4 weeks coverage
        - GROWING: 4-6 weeks coverage (buffer for increasing demand)
        - DECLINING: 1-2 weeks coverage (avoid excess)
        - SEASONAL: 4-8 weeks coverage (prepare for peaks)
        - ERRATIC: 1-2 weeks coverage (minimize risk)
        """
        # Recommendation logic
        if demand_pattern == 'STEADY':
            recommended_days = max(14, lead_time_days * 2)
            reason = "Stable demand - order 2-4 weeks supply"
        elif demand_pattern == 'GROWING':
            recommended_days = max(30, lead_time_days * 3)
            reason = "Growing demand - order more to cover increasing sales"
        elif demand_pattern == 'DECLINING':
            recommended_days = max(7, lead_time_days)
            reason = "Declining demand - order less to avoid excess inventory"
        elif demand_pattern == 'SEASONAL':
            recommended_days = max(30, lead_time_days * 4)
            reason = "Seasonal pattern - build buffer for demand peaks"
        elif demand_pattern == 'ERRATIC':
            recommended_days = max(14, lead_time_days * 2)
            reason = "Unpredictable demand - moderate coverage with safety stock"
        else:
            recommended_days = 14
            reason = "Standard coverage recommendation"
        
        # Generate scenario for recommended period
        calc = self.calculate_order_quantity(
            current_stock,
            daily_demand,
            recommended_days,
            include_safety_stock=True
        )
        
        return {
            'recommended_coverage_days': recommended_days,
            'order_quantity': calc['order_quantity'],
            'final_stock': calc['final_stock'],
            'actual_coverage': calc['actual_coverage_days'],
            'demand_pattern': demand_pattern,
            'reason': reason,
            'lead_time_days': lead_time_days
        }
    
    def calculate_with_pricing(
        self,
        current_stock: float,
        daily_demand: float,
        unit_price: float,
        custom_periods: Optional[List[int]] = None
    ) -> Dict:
        """
        Generate scenarios with cost calculations
        """
        scenarios_result = self.generate_scenarios(current_stock, daily_demand, custom_periods)
        
        # Add pricing to each scenario
        for scenario in scenarios_result['scenarios']:
            total_cost = scenario['order_quantity'] * unit_price
            cost_per_day = total_cost / scenario['coverage_days'] if scenario['coverage_days'] > 0 else 0
            
            scenario['unit_price'] = unit_price
            scenario['total_cost'] = round(total_cost, 2)
            scenario['cost_per_day'] = round(cost_per_day, 2)
        
        scenarios_result['unit_price'] = unit_price
        
        return scenarios_result
    
    def compare_suppliers_coverage(
        self,
        current_stock: float,
        daily_demand: float,
        coverage_days: int,
        supplier_prices: Dict[str, float]  # {supplier_id: price}
    ) -> List[Dict]:
        """
        Compare cost for same coverage across multiple suppliers
        """
        calc = self.calculate_order_quantity(current_stock, daily_demand, coverage_days)
        order_quantity = calc['order_quantity']
        
        comparisons = []
        
        for supplier_id, price in supplier_prices.items():
            total_cost = order_quantity * price
            
            comparisons.append({
                'supplier_id': supplier_id,
                'unit_price': price,
                'order_quantity': order_quantity,
                'total_cost': round(total_cost, 2),
                'coverage_days': coverage_days,
                'final_stock': calc['final_stock']
            })
        
        # Sort by cost
        comparisons.sort(key=lambda x: x['total_cost'])
        
        # Add savings vs most expensive
        if comparisons:
            max_cost = max(c['total_cost'] for c in comparisons)
            for comp in comparisons:
                comp['savings'] = round(max_cost - comp['total_cost'], 2)
                comp['savings_percent'] = round((comp['savings'] / max_cost * 100), 1) if max_cost > 0 else 0
                comp['is_cheapest'] = comp['total_cost'] == comparisons[0]['total_cost']
        
        return comparisons
    
    @staticmethod
    def _period_label(days: int) -> str:
        """Convert days to human-readable label"""
        if days == 1:
            return "1 Day"
        elif days == 7:
            return "1 Week"
        elif days == 14:
            return "2 Weeks"
        elif days == 30:
            return "1 Month"
        elif days == 60:
            return "2 Months"
        elif days == 90:
            return "3 Months"
        else:
            return f"{days} Days"


class BulkOrderCalculator:
    """Calculate bulk order quantities and discounts"""
    
    @staticmethod
    def calculate_moq_compliance(
        order_quantity: int,
        moq: int,
        moq_increment: int = 1
    ) -> Dict:
        """
        Adjust order quantity to meet MOQ (Minimum Order Quantity) requirements
        
        Args:
            order_quantity: Desired quantity
            moq: Minimum order quantity
            moq_increment: Increment required (e.g., must order in boxes of 10)
        """
        if order_quantity < moq:
            adjusted_quantity = moq
            reason = f"Increased to meet MOQ of {moq}"
        elif moq_increment > 1:
            # Round up to nearest increment
            adjusted_quantity = math.ceil(order_quantity / moq_increment) * moq_increment
            reason = f"Rounded to nearest increment of {moq_increment}"
        else:
            adjusted_quantity = order_quantity
            reason = "No adjustment needed"
        
        return {
            'requested_quantity': order_quantity,
            'adjusted_quantity': adjusted_quantity,
            'moq': moq,
            'moq_increment': moq_increment,
            'extra_units': adjusted_quantity - order_quantity,
            'reason': reason
        }
    
    @staticmethod
    def calculate_volume_discount(
        order_quantity: int,
        base_price: float,
        discount_tiers: List[Dict]  # [{'min_qty': 100, 'discount_percent': 10}]
    ) -> Dict:
        """
        Calculate price with volume discounts
        
        discount_tiers should be sorted by min_qty (ascending)
        """
        # Find applicable discount tier
        applicable_discount = 0
        applicable_tier = None
        
        for tier in sorted(discount_tiers, key=lambda x: x['min_qty'], reverse=True):
            if order_quantity >= tier['min_qty']:
                applicable_discount = tier['discount_percent']
                applicable_tier = tier
                break
        
        # Calculate discounted price
        discount_amount = base_price * (applicable_discount / 100)
        final_price = base_price - discount_amount
        total_cost = final_price * order_quantity
        total_savings = discount_amount * order_quantity
        
        return {
            'order_quantity': order_quantity,
            'base_price': base_price,
            'discount_percent': applicable_discount,
            'discount_amount': round(discount_amount, 2),
            'final_price': round(final_price, 2),
            'total_cost': round(total_cost, 2),
            'total_savings': round(total_savings, 2),
            'tier': applicable_tier
        }


# Convenience function
def quick_coverage_scenarios(
    current_stock: float,
    daily_demand: float,
    unit_price: float
) -> Dict:
    """
    Quick coverage scenarios with pricing
    
    Usage:
        result = quick_coverage_scenarios(
            current_stock=50,
            daily_demand=8,
            unit_price=10.0
        )
        for scenario in result['scenarios']:
            print(f"{scenario['label']}: Order {scenario['order_quantity']} units for €{scenario['total_cost']}")
    """
    calculator = CoverageCalculator()
    return calculator.calculate_with_pricing(current_stock, daily_demand, unit_price)


if __name__ == "__main__":
    # Test the coverage calculator
    print("Testing Coverage Calculator...")
    
    result = quick_coverage_scenarios(
        current_stock=50,
        daily_demand=8,
        unit_price=10.0
    )
    
    print(f"\nCurrent Stock: {result['current_coverage']['current_stock']} units")
    print(f"Days Remaining: {result['current_coverage']['days_remaining']} days")
    print(f"Status: {result['current_coverage']['status']}")
    print(f"\nScenarios:")
    
    for scenario in result['scenarios']:
        print(f"\n{scenario['label']}:")
        print(f"  Order Quantity: {scenario['order_quantity']} units")
        print(f"  Total Cost: €{scenario['total_cost']:.2f}")
        print(f"  Final Stock: {scenario['final_stock']} units")
        print(f"  Coverage: {scenario['actual_coverage']:.1f} days")
    
    # Test supplier comparison
    print("\n\nSupplier Comparison (1 Week Coverage):")
    calculator = CoverageCalculator()
    comparison = calculator.compare_suppliers_coverage(
        current_stock=50,
        daily_demand=8,
        coverage_days=7,
        supplier_prices={'asgeto': 10.0, 'santefarm': 8.5}
    )
    
    for comp in comparison:
        print(f"\n{comp['supplier_id'].upper()}:")
        print(f"  Price: €{comp['unit_price']:.2f}/unit")
        print(f"  Total: €{comp['total_cost']:.2f}")
        print(f"  Savings: €{comp['savings']:.2f} ({comp['savings_percent']:.1f}%)")
        if comp['is_cheapest']:
            print(f"  ✓ BEST PRICE")
