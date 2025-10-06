"""
Supplier Engine - Multi-Supplier Optimization

Handles:
- Delivery schedule tracking (Asgeto: 7 days, Santefarm: Mon-Fri)
- Optimal supplier selection
- Cost comparison
- Risk assessment
- Smart timing recommendations
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from enum import Enum


class DeliveryDay(Enum):
    """Days of the week"""
    MONDAY = 0
    TUESDAY = 1
    WEDNESDAY = 2
    THURSDAY = 3
    FRIDAY = 4
    SATURDAY = 5
    SUNDAY = 6


class Supplier:
    """Supplier configuration"""
    
    def __init__(
        self,
        id: str,
        name: str,
        order_days: List[int],  # 0=Monday, 6=Sunday
        lead_time_days: int,
        cutoff_time: str = "14:00",  # Order cutoff time
        reliability: float = 0.95,
        notes: str = ""
    ):
        self.id = id
        self.name = name
        self.order_days = order_days
        self.lead_time_days = lead_time_days
        self.cutoff_time = cutoff_time
        self.reliability = reliability
        self.notes = notes
    
    def can_order_today(self, date: datetime) -> bool:
        """Check if orders can be placed today"""
        day_of_week = date.weekday()  # 0=Monday, 6=Sunday
        return day_of_week in self.order_days
    
    def next_order_date(self, from_date: datetime) -> datetime:
        """Find next available order date"""
        if self.can_order_today(from_date):
            return from_date
        
        # Find next valid day
        for i in range(1, 8):
            next_date = from_date + timedelta(days=i)
            if self.can_order_today(next_date):
                return next_date
        
        # Should never reach here, but fallback
        return from_date + timedelta(days=7)
    
    def delivery_date(self, order_date: datetime) -> datetime:
        """Calculate delivery date from order date"""
        return order_date + timedelta(days=self.lead_time_days)
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        return {
            'id': self.id,
            'name': self.name,
            'order_days': [day_names[i] for i in self.order_days],
            'lead_time_days': self.lead_time_days,
            'cutoff_time': self.cutoff_time,
            'reliability': self.reliability,
            'notes': self.notes
        }


class SupplierSchedule:
    """Manage supplier delivery schedules"""
    
    def __init__(self):
        self.suppliers: Dict[str, Supplier] = {}
        self._init_default_suppliers()
    
    def _init_default_suppliers(self):
        """Initialize with pharmacy suppliers"""
        # Asgeto: Orders every day
        self.add_supplier(Supplier(
            id='asgeto',
            name='Asgeto',
            order_days=[0, 1, 2, 3, 4, 5, 6],  # All days
            lead_time_days=2,
            cutoff_time='14:00',
            reliability=0.95,
            notes='Available 7 days a week'
        ))
        
        # Santefarm: Orders Monday-Friday only
        self.add_supplier(Supplier(
            id='santefarm',
            name='Santefarm',
            order_days=[0, 1, 2, 3, 4],  # Mon-Fri
            lead_time_days=3,
            cutoff_time='12:00',
            reliability=0.92,
            notes='Mon-Fri only, longer lead time but often cheaper'
        ))
    
    def add_supplier(self, supplier: Supplier):
        """Add or update a supplier"""
        self.suppliers[supplier.id] = supplier
    
    def get_supplier(self, supplier_id: str) -> Optional[Supplier]:
        """Get supplier by ID"""
        return self.suppliers.get(supplier_id)
    
    def list_suppliers(self) -> List[Supplier]:
        """List all suppliers"""
        return list(self.suppliers.values())
    
    def can_order_from(self, supplier_id: str, date: datetime) -> bool:
        """Check if we can order from supplier on date"""
        supplier = self.get_supplier(supplier_id)
        if not supplier:
            return False
        return supplier.can_order_today(date)
    
    def next_delivery_date(self, supplier_id: str, from_date: datetime) -> Optional[datetime]:
        """Calculate next delivery date for supplier"""
        supplier = self.get_supplier(supplier_id)
        if not supplier:
            return None
        
        order_date = supplier.next_order_date(from_date)
        return supplier.delivery_date(order_date)


class PricingEngine:
    """Handle product pricing per supplier"""
    
    def __init__(self):
        self.prices: Dict[str, Dict[str, float]] = {}  # {sku: {supplier_id: price}}
    
    def set_price(self, sku: str, supplier_id: str, price: float):
        """Set price for product from supplier"""
        if sku not in self.prices:
            self.prices[sku] = {}
        self.prices[sku][supplier_id] = price
    
    def get_price(self, sku: str, supplier_id: str) -> Optional[float]:
        """Get price for product from supplier"""
        return self.prices.get(sku, {}).get(supplier_id)
    
    def get_all_prices(self, sku: str) -> Dict[str, float]:
        """Get all prices for a product"""
        return self.prices.get(sku, {})
    
    def calculate_cost(self, sku: str, supplier_id: str, quantity: int) -> Optional[float]:
        """Calculate total cost"""
        price = self.get_price(sku, supplier_id)
        if price is None:
            return None
        return price * quantity
    
    def compare_prices(self, sku: str) -> List[Dict]:
        """Compare prices across suppliers"""
        prices = self.get_all_prices(sku)
        if not prices:
            return []
        
        comparisons = []
        min_price = min(prices.values())
        
        for supplier_id, price in prices.items():
            savings = price - min_price
            savings_percent = (savings / price * 100) if price > 0 else 0
            
            comparisons.append({
                'supplier_id': supplier_id,
                'price': price,
                'is_cheapest': price == min_price,
                'extra_cost': savings,
                'extra_cost_percent': savings_percent
            })
        
        return sorted(comparisons, key=lambda x: x['price'])


class RiskAssessor:
    """Assess stockout risk"""
    
    @staticmethod
    def calculate_risk(
        current_stock: float,
        daily_demand: float,
        days_until_delivery: int,
        safety_factor: float = 1.2
    ) -> Dict:
        """
        Calculate stockout risk
        
        Returns risk level: CRITICAL, HIGH, MEDIUM, LOW, NONE
        """
        if daily_demand <= 0:
            return {
                'level': 'NONE',
                'score': 0.0,
                'days_remaining': 999,
                'message': 'No demand detected'
            }
        
        days_remaining = current_stock / daily_demand
        safe_days_needed = days_until_delivery * safety_factor
        
        # Calculate risk score (0-1)
        if days_remaining >= safe_days_needed:
            risk_score = 0.0
            level = 'NONE'
            message = f"Safe stock level - {days_remaining:.1f} days remaining"
        elif days_remaining >= days_until_delivery:
            risk_score = 0.3
            level = 'LOW'
            message = f"Stock OK but below safety margin - {days_remaining:.1f} days remaining"
        elif days_remaining >= days_until_delivery * 0.7:
            risk_score = 0.6
            level = 'MEDIUM'
            message = f"Stock getting low - order soon ({days_remaining:.1f} days remaining)"
        elif days_remaining >= days_until_delivery * 0.4:
            risk_score = 0.8
            level = 'HIGH'
            message = f"Stock low - order immediately ({days_remaining:.1f} days remaining)"
        else:
            risk_score = 1.0
            level = 'CRITICAL'
            message = f"CRITICAL - Will stockout before delivery ({days_remaining:.1f} days remaining)"
        
        return {
            'level': level,
            'score': risk_score,
            'days_remaining': days_remaining,
            'days_until_delivery': days_until_delivery,
            'safe_days_needed': safe_days_needed,
            'message': message
        }


class SupplierOptimizer:
    """Optimize supplier selection"""
    
    def __init__(self, supplier_schedule: SupplierSchedule, pricing_engine: PricingEngine):
        self.supplier_schedule = supplier_schedule
        self.pricing_engine = pricing_engine
        self.risk_assessor = RiskAssessor()
    
    def find_optimal_supplier(
        self,
        sku: str,
        current_stock: float,
        daily_demand: float,
        order_quantity: int,
        from_date: Optional[datetime] = None,
        available_suppliers: Optional[List[str]] = None
    ) -> List[Dict]:
        """
        Find optimal supplier considering cost, timing, and risk
        
        Returns sorted list of supplier options (best first)
        """
        if from_date is None:
            from_date = datetime.now()
        
        # Get available suppliers
        if available_suppliers is None:
            suppliers = self.supplier_schedule.list_suppliers()
        else:
            suppliers = [self.supplier_schedule.get_supplier(sid) for sid in available_suppliers]
            suppliers = [s for s in suppliers if s is not None]
        
        if not suppliers:
            return []
        
        options = []
        
        for supplier in suppliers:
            # Get price
            price = self.pricing_engine.get_price(sku, supplier.id)
            if price is None:
                continue  # Skip if no price available
            
            # Calculate order and delivery dates
            order_date = supplier.next_order_date(from_date)
            delivery_date = supplier.delivery_date(order_date)
            
            days_until_order = (order_date - from_date).days
            days_until_delivery = (delivery_date - from_date).days
            
            # Calculate cost
            total_cost = price * order_quantity
            
            # Assess risk
            risk = self.risk_assessor.calculate_risk(
                current_stock,
                daily_demand,
                days_until_delivery
            )
            
            # Calculate score (lower is better)
            # Factors: risk (70%), cost (20%), reliability (10%)
            risk_penalty = risk['score'] * 1000  # Heavy penalty for risk
            cost_score = total_cost
            reliability_penalty = (1 - supplier.reliability) * 100
            
            total_score = risk_penalty + cost_score + reliability_penalty
            
            options.append({
                'supplier_id': supplier.id,
                'supplier_name': supplier.name,
                'order_date': order_date.isoformat(),
                'delivery_date': delivery_date.isoformat(),
                'days_until_order': days_until_order,
                'days_until_delivery': days_until_delivery,
                'unit_price': price,
                'quantity': order_quantity,
                'total_cost': total_cost,
                'risk': risk,
                'reliability': supplier.reliability,
                'score': total_score,
                'can_order_today': supplier.can_order_today(from_date),
                'notes': supplier.notes
            })
        
        # Sort by score (lower is better)
        options.sort(key=lambda x: x['score'])
        
        # Add recommendation tags
        if options:
            options[0]['recommended'] = True
            options[0]['reason'] = self._generate_recommendation_reason(options[0])
        
        return options
    
    def _generate_recommendation_reason(self, option: Dict) -> str:
        """Generate human-readable recommendation reason"""
        reasons = []
        
        if option['risk']['level'] in ['CRITICAL', 'HIGH']:
            reasons.append(f"Stock level critical ({option['risk']['days_remaining']:.1f} days left)")
            if option['can_order_today']:
                reasons.append("Can order immediately")
        
        elif option['risk']['level'] == 'MEDIUM':
            reasons.append("Stock getting low - order soon recommended")
        
        elif option['risk']['level'] == 'LOW':
            reasons.append("Stock adequate but approaching reorder point")
        
        else:
            reasons.append("Stock levels good")
        
        # Add delivery timing
        if option['days_until_delivery'] <= 2:
            reasons.append(f"Fast delivery ({option['days_until_delivery']} days)")
        elif option['days_until_delivery'] >= 5:
            reasons.append(f"Longer wait time ({option['days_until_delivery']} days)")
        
        return "; ".join(reasons)
    
    def compare_suppliers(
        self,
        sku: str,
        current_stock: float,
        daily_demand: float,
        order_quantity: int,
        from_date: Optional[datetime] = None
    ) -> Dict:
        """
        Compare all suppliers side-by-side
        
        Returns detailed comparison with savings calculations
        """
        options = self.find_optimal_supplier(
            sku, current_stock, daily_demand, order_quantity, from_date
        )
        
        if not options:
            return {
                'error': 'No suppliers available',
                'all_options': []
            }
        
        # Calculate savings vs most expensive
        most_expensive = max(opt['total_cost'] for opt in options)
        
        for opt in options:
            opt['savings_vs_max'] = most_expensive - opt['total_cost']
            opt['savings_percent'] = (opt['savings_vs_max'] / most_expensive * 100) if most_expensive > 0 else 0
        
        best_option = options[0]
        
        return {
            'recommended': best_option,
            'all_options': options,
            'max_savings': best_option['savings_vs_max'],
            'max_savings_percent': best_option['savings_percent'],
            'comparison_date': from_date.isoformat() if from_date else datetime.now().isoformat()
        }


# Convenience functions
def quick_supplier_comparison(
    sku: str,
    current_stock: float,
    daily_demand: float,
    order_quantity: int,
    prices: Dict[str, float]  # {supplier_id: price}
) -> Dict:
    """
    Quick supplier comparison
    
    Usage:
        result = quick_supplier_comparison(
            sku='ATORIS-20MG',
            current_stock=50,
            daily_demand=8,
            order_quantity=100,
            prices={'asgeto': 10.0, 'santefarm': 8.5}
        )
        print(result['recommended']['supplier_name'])
        print(f"Savings: €{result['max_savings']:.2f}")
    """
    schedule = SupplierSchedule()
    pricing = PricingEngine()
    
    # Set prices
    for supplier_id, price in prices.items():
        pricing.set_price(sku, supplier_id, price)
    
    optimizer = SupplierOptimizer(schedule, pricing)
    return optimizer.compare_suppliers(sku, current_stock, daily_demand, order_quantity)


if __name__ == "__main__":
    # Test the supplier engine
    print("Testing Supplier Engine...")
    
    result = quick_supplier_comparison(
        sku='ATORIS-20MG',
        current_stock=50,
        daily_demand=8,
        order_quantity=100,
        prices={'asgeto': 10.0, 'santefarm': 8.5}
    )
    
    print(f"\nRecommended: {result['recommended']['supplier_name']}")
    print(f"Order Date: {result['recommended']['order_date']}")
    print(f"Delivery Date: {result['recommended']['delivery_date']}")
    print(f"Total Cost: €{result['recommended']['total_cost']:.2f}")
    print(f"Risk Level: {result['recommended']['risk']['level']}")
    print(f"Reason: {result['recommended']['reason']}")
    print(f"\nSavings: €{result['max_savings']:.2f} ({result['max_savings_percent']:.1f}%)")
    
    print("\n\nAll Options:")
    for i, opt in enumerate(result['all_options'], 1):
        print(f"\n{i}. {opt['supplier_name']}")
        print(f"   Cost: €{opt['total_cost']:.2f}")
        print(f"   Delivery: {opt['days_until_delivery']} days")
        print(f"   Risk: {opt['risk']['level']}")
