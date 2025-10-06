"""
Forecast Engine - Level 2 Time Series Forecasting

Implements:
- Seasonal decomposition
- Trend analysis
- Demand pattern classification
- Outlier detection and removal
- Confidence intervals
- Holt-Winters exponential smoothing
"""

import numpy as np
import pandas as pd
from scipy import stats
from typing import List, Dict, Tuple, Optional
from datetime import datetime, timedelta
import warnings

warnings.filterwarnings('ignore')

try:
    from statsmodels.tsa.seasonal import seasonal_decompose
    from statsmodels.tsa.holtwinters import ExponentialSmoothing
    STATSMODELS_AVAILABLE = True
except ImportError:
    STATSMODELS_AVAILABLE = False
    print("Warning: statsmodels not available, using fallback methods")


class OutlierDetector:
    """Detect and remove outliers from sales data"""
    
    @staticmethod
    def detect_zscore(data: List[float], threshold: float = 3.0) -> List[int]:
        """
        Detect outliers using Z-score method
        Returns indices of outliers
        """
        if len(data) < 3:
            return []
        
        arr = np.array(data)
        mean = np.mean(arr)
        std = np.std(arr)
        
        if std == 0:
            return []
        
        z_scores = np.abs((arr - mean) / std)
        outlier_indices = np.where(z_scores > threshold)[0].tolist()
        
        return outlier_indices
    
    @staticmethod
    def detect_iqr(data: List[float], multiplier: float = 1.5) -> List[int]:
        """
        Detect outliers using IQR (Interquartile Range) method
        Returns indices of outliers
        """
        if len(data) < 4:
            return []
        
        arr = np.array(data)
        q1 = np.percentile(arr, 25)
        q3 = np.percentile(arr, 75)
        iqr = q3 - q1
        
        lower_bound = q1 - multiplier * iqr
        upper_bound = q3 + multiplier * iqr
        
        outlier_indices = np.where((arr < lower_bound) | (arr > upper_bound))[0].tolist()
        
        return outlier_indices
    
    @staticmethod
    def remove_outliers(data: List[float], method: str = 'zscore') -> Tuple[List[float], List[int]]:
        """
        Remove outliers from data
        Returns (cleaned_data, removed_indices)
        """
        if len(data) < 3:
            return data, []
        
        if method == 'zscore':
            outlier_indices = OutlierDetector.detect_zscore(data)
        elif method == 'iqr':
            outlier_indices = OutlierDetector.detect_iqr(data)
        else:
            return data, []
        
        # Create cleaned data by removing outliers
        cleaned_data = [val for i, val in enumerate(data) if i not in outlier_indices]
        
        # If we removed too many points, return original
        if len(cleaned_data) < len(data) * 0.5:
            return data, []
        
        return cleaned_data, outlier_indices


class TrendAnalyzer:
    """Analyze trends in sales data"""
    
    @staticmethod
    def calculate_trend(data: List[float], period: int = 7) -> Dict:
        """
        Calculate trend direction and strength
        """
        if len(data) < period:
            return {
                'direction': 'INSUFFICIENT_DATA',
                'slope': 0.0,
                'strength': 0.0,
                'r_squared': 0.0
            }
        
        # Use linear regression to find trend
        x = np.arange(len(data))
        y = np.array(data)
        
        # Calculate slope using numpy polyfit
        coeffs = np.polyfit(x, y, 1)
        slope = coeffs[0]
        intercept = coeffs[1]
        
        # Calculate R-squared
        y_pred = slope * x + intercept
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
        
        # Determine direction
        mean_value = np.mean(y)
        relative_slope = slope / mean_value if mean_value > 0 else 0
        
        if relative_slope > 0.05:
            direction = 'GROWING'
        elif relative_slope < -0.05:
            direction = 'DECLINING'
        else:
            direction = 'STEADY'
        
        return {
            'direction': direction,
            'slope': float(slope),
            'relative_slope': float(relative_slope),
            'strength': float(abs(relative_slope)),
            'r_squared': float(r_squared),
            'confidence': float(r_squared * 100)
        }
    
    @staticmethod
    def detect_day_of_week_pattern(data: List[float], dates: Optional[List[datetime]] = None) -> Dict:
        """
        Detect if sales vary by day of week
        """
        if not dates or len(data) != len(dates) or len(data) < 7:
            return {'has_pattern': False, 'pattern': {}}
        
        # Group by day of week
        df = pd.DataFrame({
            'date': dates,
            'sales': data
        })
        df['day_of_week'] = df['date'].dt.day_name()
        
        # Calculate average sales by day
        day_avg = df.groupby('day_of_week')['sales'].mean().to_dict()
        
        # Calculate coefficient of variation
        values = list(day_avg.values())
        cv = np.std(values) / np.mean(values) if np.mean(values) > 0 else 0
        
        # If CV > 0.2, there's a significant day-of-week pattern
        has_pattern = cv > 0.2
        
        return {
            'has_pattern': has_pattern,
            'pattern': day_avg,
            'variation': float(cv),
            'highest_day': max(day_avg, key=day_avg.get) if day_avg else None,
            'lowest_day': min(day_avg, key=day_avg.get) if day_avg else None
        }


class SeasonalForecaster:
    """Detect and forecast seasonal patterns"""
    
    @staticmethod
    def decompose(data: List[float], period: int = 7) -> Optional[Dict]:
        """
        Decompose time series into trend, seasonal, and residual components
        """
        if not STATSMODELS_AVAILABLE or len(data) < period * 2:
            return None
        
        try:
            # Create pandas Series
            series = pd.Series(data)
            
            # Perform seasonal decomposition
            result = seasonal_decompose(
                series,
                model='additive',
                period=period,
                extrapolate_trend='freq'
            )
            
            return {
                'trend': result.trend.tolist(),
                'seasonal': result.seasonal.tolist(),
                'residual': result.resid.tolist(),
                'seasonal_strength': float(np.std(result.seasonal) / np.std(series)) if np.std(series) > 0 else 0
            }
        except Exception as e:
            print(f"Seasonal decomposition failed: {e}")
            return None
    
    @staticmethod
    def forecast_holt_winters(data: List[float], periods: int = 7, seasonal_periods: int = 7) -> Optional[Dict]:
        """
        Forecast using Holt-Winters exponential smoothing
        """
        if not STATSMODELS_AVAILABLE or len(data) < seasonal_periods * 2:
            return None
        
        try:
            # Create pandas Series
            series = pd.Series(data)
            
            # Build Holt-Winters model
            model = ExponentialSmoothing(
                series,
                seasonal='add',
                seasonal_periods=seasonal_periods,
                trend='add'
            )
            
            # Fit model
            fitted_model = model.fit()
            
            # Make forecast
            forecast = fitted_model.forecast(steps=periods)
            
            return {
                'forecast': forecast.tolist(),
                'fitted_values': fitted_model.fittedvalues.tolist(),
                'method': 'holt_winters'
            }
        except Exception as e:
            print(f"Holt-Winters forecast failed: {e}")
            return None


class DemandClassifier:
    """Classify demand patterns"""
    
    @staticmethod
    def classify(data: List[float]) -> Dict:
        """
        Classify demand pattern as:
        - STEADY: Low variation, no trend
        - GROWING: Upward trend
        - DECLINING: Downward trend
        - SEASONAL: Strong seasonal pattern
        - ERRATIC: High variation, unpredictable
        """
        if len(data) < 7:
            return {
                'pattern': 'INSUFFICIENT_DATA',
                'confidence': 0.0,
                'characteristics': {}
            }
        
        # Calculate statistics
        arr = np.array(data)
        mean = np.mean(arr)
        std = np.std(arr)
        cv = std / mean if mean > 0 else 0
        
        # Get trend
        trend = TrendAnalyzer.calculate_trend(data)
        
        # Determine pattern
        characteristics = {
            'mean': float(mean),
            'std': float(std),
            'cv': float(cv),
            'trend_direction': trend['direction'],
            'trend_strength': trend['strength']
        }
        
        # Classification logic
        if cv > 0.5:
            pattern = 'ERRATIC'
            confidence = 0.8
        elif trend['direction'] == 'GROWING' and trend['strength'] > 0.1:
            pattern = 'GROWING'
            confidence = trend['confidence'] / 100
        elif trend['direction'] == 'DECLINING' and trend['strength'] > 0.1:
            pattern = 'DECLINING'
            confidence = trend['confidence'] / 100
        elif cv < 0.2:
            pattern = 'STEADY'
            confidence = 0.9
        else:
            # Check for seasonality
            decomp = SeasonalForecaster.decompose(data, period=7)
            if decomp and decomp['seasonal_strength'] > 0.3:
                pattern = 'SEASONAL'
                confidence = 0.85
            else:
                pattern = 'STEADY'
                confidence = 0.7
        
        return {
            'pattern': pattern,
            'confidence': float(confidence),
            'characteristics': characteristics
        }


class ConfidenceCalculator:
    """Calculate prediction confidence intervals"""
    
    @staticmethod
    def calculate_interval(data: List[float], confidence_level: float = 0.95) -> Dict:
        """
        Calculate confidence interval for predictions
        """
        if len(data) < 2:
            return {
                'mean': 0.0,
                'std': 0.0,
                'lower': 0.0,
                'upper': 0.0,
                'confidence': confidence_level
            }
        
        arr = np.array(data)
        mean = np.mean(arr)
        std = np.std(arr, ddof=1)
        n = len(arr)
        
        # Calculate confidence interval using t-distribution
        t_value = stats.t.ppf((1 + confidence_level) / 2, n - 1)
        margin = t_value * (std / np.sqrt(n))
        
        return {
            'mean': float(mean),
            'std': float(std),
            'lower': float(max(0, mean - margin)),  # Can't have negative demand
            'upper': float(mean + margin),
            'margin': float(margin),
            'confidence': confidence_level
        }


class ForecastEngine:
    """Main forecasting engine that combines all methods"""
    
    def __init__(self):
        self.outlier_detector = OutlierDetector()
        self.trend_analyzer = TrendAnalyzer()
        self.seasonal_forecaster = SeasonalForecaster()
        self.demand_classifier = DemandClassifier()
        self.confidence_calculator = ConfidenceCalculator()
    
    def analyze(self, sales_data: List[float], dates: Optional[List[datetime]] = None) -> Dict:
        """
        Comprehensive analysis of sales data
        
        Returns complete forecast analysis including:
        - Cleaned data (outliers removed)
        - Trend analysis
        - Pattern classification
        - Seasonal decomposition (if applicable)
        - Forecast predictions
        - Confidence intervals
        """
        if len(sales_data) < 3:
            return {
                'error': 'Insufficient data',
                'min_required': 3,
                'received': len(sales_data)
            }
        
        # Step 1: Remove outliers
        cleaned_data, outlier_indices = self.outlier_detector.remove_outliers(sales_data)
        
        # Step 2: Classify demand pattern
        classification = self.demand_classifier.classify(cleaned_data)
        
        # Step 3: Analyze trend
        trend = self.trend_analyzer.calculate_trend(cleaned_data)
        
        # Step 4: Detect day-of-week patterns
        day_pattern = self.trend_analyzer.detect_day_of_week_pattern(cleaned_data, dates)
        
        # Step 5: Seasonal decomposition (if enough data)
        seasonal_decomp = None
        if len(cleaned_data) >= 14:
            seasonal_decomp = self.seasonal_forecaster.decompose(cleaned_data, period=7)
        
        # Step 6: Calculate confidence intervals
        confidence = self.confidence_calculator.calculate_interval(cleaned_data, confidence_level=0.95)
        
        # Step 7: Generate forecast
        forecast = self._generate_forecast(cleaned_data, classification, trend)
        
        return {
            'original_data_points': len(sales_data),
            'cleaned_data_points': len(cleaned_data),
            'outliers_removed': len(outlier_indices),
            'outlier_indices': outlier_indices,
            'classification': classification,
            'trend': trend,
            'day_of_week_pattern': day_pattern,
            'seasonal_decomposition': seasonal_decomp,
            'confidence_interval': confidence,
            'forecast': forecast,
            'recommendation': self._generate_recommendation(classification, trend, confidence)
        }
    
    def _generate_forecast(self, data: List[float], classification: Dict, trend: Dict) -> Dict:
        """Generate forecast based on pattern"""
        
        # Try Holt-Winters first if we have enough data
        if len(data) >= 14:
            hw_forecast = self.seasonal_forecaster.forecast_holt_winters(data, periods=7, seasonal_periods=7)
            if hw_forecast:
                return {
                    'method': 'holt_winters',
                    'next_7_days': hw_forecast['forecast'],
                    'daily_average': float(np.mean(hw_forecast['forecast']))
                }
        
        # Fallback: Weighted moving average
        weights = np.exp(np.linspace(-1, 0, len(data)))
        weighted_avg = np.average(data, weights=weights)
        
        # Adjust for trend
        if classification['pattern'] == 'GROWING':
            adjustment = 1.0 + (trend['relative_slope'] * 0.5)
        elif classification['pattern'] == 'DECLINING':
            adjustment = 1.0 + (trend['relative_slope'] * 0.5)
        else:
            adjustment = 1.0
        
        forecast_value = weighted_avg * adjustment
        
        return {
            'method': 'weighted_moving_average',
            'next_7_days': [forecast_value] * 7,
            'daily_average': float(forecast_value)
        }
    
    def _generate_recommendation(self, classification: Dict, trend: Dict, confidence: Dict) -> Dict:
        """Generate human-readable recommendation"""
        
        pattern = classification['pattern']
        mean = confidence['mean']
        
        if pattern == 'STEADY':
            safety_factor = 1.2
            message = "Demand is stable and predictable"
        elif pattern == 'GROWING':
            safety_factor = 1.4
            message = f"Demand is growing - consider ordering {int((safety_factor - 1) * 100)}% more"
        elif pattern == 'DECLINING':
            safety_factor = 1.0
            message = "Demand is declining - reduce order quantities"
        elif pattern == 'SEASONAL':
            safety_factor = 1.5
            message = "Strong seasonal pattern detected - adjust for peaks"
        elif pattern == 'ERRATIC':
            safety_factor = 1.8
            message = "High variability - maintain higher safety stock"
        else:
            safety_factor = 1.3
            message = "Insufficient data - using conservative estimates"
        
        return {
            'message': message,
            'pattern': pattern,
            'confidence': classification['confidence'],
            'suggested_safety_factor': safety_factor,
            'expected_daily_demand': float(mean),
            'safe_daily_demand': float(mean * safety_factor)
        }


# Convenience function for quick forecasting
def quick_forecast(sales_data: List[float], dates: Optional[List[datetime]] = None) -> Dict:
    """
    Quick forecast function for simple use cases
    
    Usage:
        result = quick_forecast([10, 12, 8, 15, 11, 9, 13])
        print(result['forecast']['daily_average'])
        print(result['classification']['pattern'])
    """
    engine = ForecastEngine()
    return engine.analyze(sales_data, dates)


if __name__ == "__main__":
    # Test the forecast engine
    print("Testing Forecast Engine...")
    
    # Sample data: 30 days of sales with some pattern
    test_data = [10, 12, 8, 15, 11, 9, 13, 14, 16, 12, 18, 15, 13, 17,
                 12, 14, 10, 16, 13, 11, 15, 16, 18, 14, 20, 17, 15, 19, 20, 22]
    
    result = quick_forecast(test_data)
    
    print(f"\nPattern: {result['classification']['pattern']}")
    print(f"Confidence: {result['classification']['confidence']:.2%}")
    print(f"Trend: {result['trend']['direction']}")
    print(f"Average Daily Demand: {result['forecast']['daily_average']:.2f}")
    print(f"Recommendation: {result['recommendation']['message']}")
    print(f"\nOutliers removed: {result['outliers_removed']}")
    print(f"Forecast method: {result['forecast']['method']}")
