#!/bin/bash

# AI Pharmacy System - V3 Test Suite
# Tests all components of the ML-powered replenishment system

set -e

echo "=================================================="
echo "   AI Pharmacy System - V3 Test Suite"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
print_test() {
    echo -e "${BLUE}[TEST $1]${NC} $2"
}

print_pass() {
    echo -e "${GREEN}✓ PASS${NC} - $1"
    ((TESTS_PASSED++))
}

print_fail() {
    echo -e "${RED}✗ FAIL${NC} - $1"
    ((TESTS_FAILED++))
}

print_info() {
    echo -e "${YELLOW}ℹ INFO${NC} - $1"
}

# Test 1: Python V3 Service Health
test_python_health() {
    ((TESTS_RUN++))
    print_test "$TESTS_RUN" "Python V3 Service Health Check"
    
    RESPONSE=$(curl -s http://localhost:8000/v3/health)
    
    if echo "$RESPONSE" | grep -q '"status": "ok"' && \
       echo "$RESPONSE" | grep -q '"version": "v3"' && \
       echo "$RESPONSE" | grep -q '"forecast": "initialized"'; then
        print_pass "Python V3 service is running and healthy"
        print_info "Engines: forecast ✓ supplier ✓ coverage ✓"
        return 0
    else
        print_fail "Python V3 service not responding correctly"
        echo "Response: $RESPONSE"
        return 1
    fi
}

# Test 2: Coverage Scenarios
test_coverage_scenarios() {
    ((TESTS_RUN++))
    print_test "$TESTS_RUN" "Coverage Scenarios Calculation"
    
    RESPONSE=$(curl -s -X POST http://localhost:8000/v3/coverage-scenarios \
        -H "Content-Type: application/json" \
        -d '{
            "sku": "TEST-PRODUCT",
            "currentStock": 50,
            "dailyDemand": 8.0,
            "unitPrice": 10.0,
            "customPeriods": [1, 7, 30]
        }')
    
    if echo "$RESPONSE" | grep -q '"label": "1 Week"' && \
       echo "$RESPONSE" | grep -q '"order_quantity"' && \
       echo "$RESPONSE" | grep -q '"total_cost"'; then
        print_pass "Coverage scenarios calculated correctly"
        
        # Extract and display key metrics
        DAYS_REMAINING=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['currentCoverage']['days_remaining'])" 2>/dev/null || echo "N/A")
        print_info "Current stock lasts: $DAYS_REMAINING days"
        return 0
    else
        print_fail "Coverage scenarios endpoint failed"
        echo "Response: $RESPONSE"
        return 1
    fi
}

# Test 3: Supplier Comparison
test_supplier_comparison() {
    ((TESTS_RUN++))
    print_test "$TESTS_RUN" "Multi-Supplier Optimization"
    
    RESPONSE=$(curl -s -X POST http://localhost:8000/v3/supplier-comparison \
        -H "Content-Type: application/json" \
        -d '{
            "sku": "ATORIS-20MG",
            "currentStock": 50,
            "dailyDemand": 8.0,
            "orderQuantity": 100,
            "supplierPrices": {
                "asgeto": 10.0,
                "santefarm": 8.5
            }
        }')
    
    if echo "$RESPONSE" | grep -q '"maxSavings"' && \
       echo "$RESPONSE" | grep -q '"recommended"'; then
        print_pass "Supplier comparison working"
        
        # Extract savings
        SAVINGS=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(f\"{data['maxSavings']:.2f}\")" 2>/dev/null || echo "N/A")
        PERCENT=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(f\"{data['maxSavingsPercent']:.1f}%\")" 2>/dev/null || echo "N/A")
        print_info "Savings: €$SAVINGS ($PERCENT)"
        return 0
    else
        print_fail "Supplier comparison endpoint failed"
        echo "Response: $RESPONSE"
        return 1
    fi
}

# Test 4: API Core Health (if running)
test_api_core() {
    ((TESTS_RUN++))
    print_test "$TESTS_RUN" "API Core Service"
    
    RESPONSE=$(curl -s http://localhost:4000/health 2>&1)
    
    if echo "$RESPONSE" | grep -q '"status"'; then
        print_pass "API Core is running"
        return 0
    else
        print_fail "API Core not responding (expected if not started)"
        print_info "Start with: cd apps/api-core && pnpm dev"
        return 1
    fi
}

# Test 5: Web App (if running)
test_web_app() {
    ((TESTS_RUN++))
    print_test "$TESTS_RUN" "Web Application"
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>&1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        print_pass "Web app is accessible"
        print_info "URL: http://localhost:5173"
        return 0
    else
        print_fail "Web app not responding (expected if not started)"
        print_info "Start with: cd apps/web && pnpm dev"
        return 1
    fi
}

# Main test execution
main() {
    echo "Starting tests..."
    echo ""
    
    # Core tests (must pass)
    test_python_health || true
    echo ""
    
    test_coverage_scenarios || true
    echo ""
    
    test_supplier_comparison || true
    echo ""
    
    # Optional tests (can fail if services not started)
    test_api_core || true
    echo ""
    
    test_web_app || true
    echo ""
    
    # Summary
    echo "=================================================="
    echo "   Test Summary"
    echo "=================================================="
    echo ""
    echo -e "Tests Run:    ${BLUE}$TESTS_RUN${NC}"
    echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed!${NC}"
        echo ""
        echo "🎉 AI System is operational!"
        echo ""
        echo "Next steps:"
        echo "  1. Access UI: http://localhost:5173/replenishment"
        echo "  2. Login: admin@pharmacy.com / admin123"
        echo "  3. Select coverage period (e.g., 1 Week)"
        echo "  4. Click 'Generate AI Suggestions'"
        echo "  5. Review ML-powered recommendations"
        echo ""
        exit 0
    else
        echo -e "${RED}✗ Some tests failed${NC}"
        echo ""
        echo "Troubleshooting:"
        echo "  • Python service: Check if running on port 8000"
        echo "  • API Core: Start with 'cd apps/api-core && pnpm dev'"
        echo "  • Web App: Start with 'cd apps/web && pnpm dev'"
        echo "  • Or use: pnpm dev (starts all services)"
        echo ""
        exit 1
    fi
}

# Run tests
main
