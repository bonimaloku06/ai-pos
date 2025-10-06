import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect } from "react";
import { useAuth } from "../lib/auth-context";
import { apiClient } from "@/lib/api-client";

interface ReorderSuggestion {
  id: string;
  productId: string;
  storeId: string;
  supplierId?: string;
  rop: number;
  orderQty: number;
  status: string;
  suggestionDate: string;
  // Enhanced fields
  analysisPeriodDays?: number;
  stockDuration?: number;
  urgencyLevel?: string;
  nextDeliveryDate?: string;
  scenarios?: Array<{
    label: string;
    orderQty: number;
    projectedStock: number;
    projectedDuration: number;
    coverage_days?: number;
    final_stock?: number;
    actual_coverage?: number;
  }>;
  reason: {
    currentStock?: number;
    meanDemand?: number;
    stdDevDemand?: number;
    safetyStock?: number;
    leadTimeDays?: number;
    serviceLevel?: number;
    shouldReorder?: boolean;
    manualNote?: string;
    // V3 ML Fields
    pattern?: string;
    patternConfidence?: number;
    trend?: {
      direction: string;
      slope: number;
      r_squared?: number;
    };
    forecastedDemand?: number;
    urgency?: string;
    daysRemaining?: number;
    message?: string;
    action?: string;
    // Supplier fields
    recommendedSupplier?: string;
    supplierCost?: number;
    deliveryDays?: number;
    savings?: number;
    savingsPercent?: number;
    coverageScenarios?: Array<any>;
    supplierOptions?: Array<{
      supplier_id: string;
      supplier_name: string;
      order_date: string;
      delivery_date: string;
      unit_price: number;
      total_cost: number;
      days_until_delivery: number;
      savings_vs_max?: number;
      savings_percent?: number;
      recommended?: boolean;
      risk?: {
        level: string;
        days_remaining: number;
      };
    }>;
  };
  product: {
    id: string;
    name: string;
    sku: string;
    barcode?: string;
  };
  supplier?: {
    id: string;
    name: string;
    leadTimeDays: number;
    deliveryDays: string[];
  };
  store: {
    id: string;
    name: string;
  };
}

export const Route = createFileRoute("/replenishment")({
  component: ReplenishmentPage,
});

function ReplenishmentPage() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("PENDING");
  const [filterUrgency, setFilterUrgency] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("urgency");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [coverageDays, setCoverageDays] = useState<number>(7); // Default 1 week

  const toggleRowExpansion = (id: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) {
      case "CRITICAL":
        return "bg-red-100 text-red-800 border-red-300";
      case "WARNING":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "GOOD":
        return "bg-green-100 text-green-800 border-green-300";
      case "OVERSTOCKED":
        return "bg-blue-100 text-blue-800 border-blue-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getUrgencyPriority = (urgency?: string): number => {
    switch (urgency) {
      case "CRITICAL":
        return 4;
      case "WARNING":
        return 3;
      case "GOOD":
        return 2;
      case "OVERSTOCKED":
        return 1;
      default:
        return 0;
    }
  };

  // Filter and sort suggestions
  const filteredAndSortedSuggestions = React.useMemo(() => {
    let filtered = suggestions.filter((sug) => {
      // Status filter
      if (filterStatus && sug.status !== filterStatus) {
        return false;
      }

      // Urgency filter
      if (filterUrgency) {
        const urgency = sug.reason?.urgency || sug.urgencyLevel;
        if (urgency !== filterUrgency) {
          return false;
        }
      }

      return true;
    });

    // Sort suggestions
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "urgency":
          const urgencyA = getUrgencyPriority(a.reason?.urgency || a.urgencyLevel);
          const urgencyB = getUrgencyPriority(b.reason?.urgency || b.urgencyLevel);
          comparison = urgencyA - urgencyB;
          break;

        case "stockDuration":
          const durationA = a.reason?.daysRemaining || a.stockDuration || 999;
          const durationB = b.reason?.daysRemaining || b.stockDuration || 999;
          comparison = durationA - durationB;
          break;

        case "productName":
          const nameA = a.product?.name || "";
          const nameB = b.product?.name || "";
          comparison = nameA.localeCompare(nameB);
          break;

        case "currentStock":
          const stockA = a.reason?.currentStock || 0;
          const stockB = b.reason?.currentStock || 0;
          comparison = stockA - stockB;
          break;

        case "orderQty":
          comparison = a.orderQty - b.orderQty;
          break;

        default:
          comparison = 0;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [suggestions, filterStatus, filterUrgency, sortBy, sortOrder]);

  const isDeliveryDayToday = (supplier?: ReorderSuggestion["supplier"]): boolean => {
    if (!supplier?.deliveryDays || supplier.deliveryDays.length === 0) return false;
    const today = new Date().toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
    return supplier.deliveryDays.includes(today);
  };

  const getRecommendedAction = (sug: ReorderSuggestion): string => {
    // V3: Use ML action if available
    if (sug.reason?.action) {
      const actionMap: Record<string, string> = {
        ORDER_TODAY: "🚨 ORDER TODAY",
        ORDER_SOON: "⚠️ Order Soon",
        MONITOR: "✅ Monitor",
        REDUCE_ORDERS: "⏸️ Reduce Orders",
      };
      return actionMap[sug.reason.action] || sug.reason.action || "Unknown";
    }

    // Fallback to old logic
    const isDeliveryDay = isDeliveryDayToday(sug.supplier);
    const stockDuration = sug.stockDuration || 999;

    if (sug.urgencyLevel === "CRITICAL") {
      if (isDeliveryDay) {
        return "🚨 ORDER NOW - Delivery today!";
      }
      return "🚨 URGENT - Order immediately";
    }

    if (sug.urgencyLevel === "WARNING") {
      if (isDeliveryDay) {
        return "⚠️ Order today - Delivery day";
      }
      return "⚠️ Order soon (within 2 days)";
    }

    if (sug.urgencyLevel === "GOOD") {
      if (isDeliveryDay && stockDuration < 14) {
        return "✅ Good time to order today";
      }
      return "✅ Monitor - Order when needed";
    }

    if (sug.urgencyLevel === "OVERSTOCKED") {
      return "⏸️ Hold - Sufficient stock";
    }

    return "Review manually";
  };

  const getPatternBadge = (pattern?: string) => {
    const badges: Record<string, { label: string; color: string; icon: string }> = {
      STEADY: { label: "Steady", color: "bg-blue-100 text-blue-800", icon: "📊" },
      GROWING: { label: "Growing", color: "bg-green-100 text-green-800", icon: "📈" },
      DECLINING: { label: "Declining", color: "bg-orange-100 text-orange-800", icon: "📉" },
      SEASONAL: { label: "Seasonal", color: "bg-purple-100 text-purple-800", icon: "🔄" },
      ERRATIC: { label: "Erratic", color: "bg-red-100 text-red-800", icon: "⚡" },
    };
    return pattern && badges[pattern] ? badges[pattern] : null;
  };

  const sortSuggestions = (suggestions: ReorderSuggestion[]): ReorderSuggestion[] => {
    return [...suggestions].sort((a, b) => {
      // Priority 1: Urgency level (higher priority first)
      const urgencyDiff = getUrgencyPriority(b.urgencyLevel) - getUrgencyPriority(a.urgencyLevel);
      if (urgencyDiff !== 0) return urgencyDiff;

      // Priority 2: Delivery day today (delivery day first)
      const aDeliveryToday = isDeliveryDayToday(a.supplier) ? 1 : 0;
      const bDeliveryToday = isDeliveryDayToday(b.supplier) ? 1 : 0;
      if (bDeliveryToday !== aDeliveryToday) return bDeliveryToday - aDeliveryToday;

      // Priority 3: Stock duration (less duration first)
      const aDuration = a.stockDuration || 999;
      const bDuration = b.stockDuration || 999;
      return aDuration - bDuration;
    });
  };

  useEffect(() => {
    fetchSuggestions();
  }, [filterStatus]);

  const fetchSuggestions = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append("status", filterStatus);
      if (user?.storeId) params.append("storeId", user.storeId);

      const data = await apiClient.get(`/reorder-suggestions?${params}`);
      // Sort suggestions by urgency and delivery day
      const sorted = sortSuggestions(data.suggestions);
      setSuggestions(sorted);
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!user?.storeId) {
      alert("No store assigned to user");
      return;
    }

    setGenerating(true);
    try {
      const data = await apiClient.post("/reorder-suggestions/generate", {
        storeId: user.storeId,
        serviceLevel: 0.95,
        coverageDays: coverageDays, // V3: User-selected coverage
        includeSupplierComparison: true, // V3: Enable supplier comparison
      });
      alert(data.message || `Generated ${data.suggestions?.length || 0} AI-powered suggestions`);
      if (data.summary) {
        const summary = data.summary;
        alert(
          `📊 Summary:\n` +
            `Critical: ${summary.criticalProducts || 0}\n` +
            `Low Stock: ${summary.lowStockProducts || 0}\n` +
            `Good Stock: ${summary.goodStockProducts || 0}`
        );
      }
      await fetchSuggestions();
    } catch (error) {
      console.error("Failed to generate suggestions:", error);
      alert("Failed to generate suggestions");
    } finally {
      setGenerating(false);
    }
  };

  const handleClearAll = async () => {
    if (!user?.storeId) {
      alert("Store ID not found");
      return;
    }

    if (!confirm("Are you sure you want to clear all suggestions? This action cannot be undone.")) {
      return;
    }

    setClearing(true);
    try {
      const data = await apiClient.clearReorderSuggestions(user.storeId);
      alert(data.message);
      // Refresh suggestions
      await fetchSuggestions();
    } catch (error: any) {
      alert(`Failed to clear suggestions: ${error.message}`);
    } finally {
      setClearing(false);
    }
  };

  const handleApprove = async (generatePO: boolean) => {
    if (selectedIds.length === 0) {
      alert("Please select suggestions to approve");
      return;
    }

    try {
      const data = await apiClient.post("/reorder-suggestions/approve", {
        suggestionIds: selectedIds,
        generatePO,
      });
      alert(data.message);
      if (data.purchaseOrders && data.purchaseOrders.length > 0) {
        alert(`Created ${data.purchaseOrders.length} purchase order(s)`);
      }
      setSelectedIds([]);
      await fetchSuggestions();
    } catch (error) {
      console.error("Failed to approve suggestions:", error);
      alert("Failed to approve suggestions");
    }
  };

  const handleReject = async () => {
    if (selectedIds.length === 0) {
      alert("Please select suggestions to reject");
      return;
    }

    if (!confirm(`Reject ${selectedIds.length} suggestion(s)?`)) return;

    try {
      await apiClient.post("/reorder-suggestions/reject", {
        suggestionIds: selectedIds,
      });
      setSelectedIds([]);
      await fetchSuggestions();
    } catch (error) {
      console.error("Failed to reject suggestions:", error);
      alert("Failed to reject suggestions");
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredAndSortedSuggestions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAndSortedSuggestions.map((s) => s.id));
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Replenishment</h1>
              <p className="text-sm text-gray-600 mt-1">
                🧠 ML-powered forecasting with multi-supplier optimization
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Coverage Duration Selector */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Coverage:</label>
                <select
                  value={coverageDays}
                  onChange={(e) => setCoverageDays(Number(e.target.value))}
                  className="px-3 py-2 border rounded text-sm bg-white"
                >
                  <option value={1}>1 Day</option>
                  <option value={7}>1 Week</option>
                  <option value={14}>2 Weeks</option>
                  <option value={30}>1 Month</option>
                  <option value={60}>2 Months</option>
                  <option value={90}>3 Months</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={generating || clearing}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {generating ? (
                    <>
                      <span className="animate-spin">⚙️</span> Analyzing...
                    </>
                  ) : (
                    <>🤖 Generate AI Suggestions</>
                  )}
                </button>
                {suggestions.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    disabled={generating || clearing}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {clearing ? (
                      <>
                        <span className="animate-spin">🗑️</span> Clearing...
                      </>
                    ) : (
                      <>🗑️ Clear All Suggestions</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mx-auto px-6 py-4 bg-white border-b">
        <div className="flex items-center space-x-4 flex-wrap gap-2">
          <label className="text-sm font-medium text-gray-700">Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1 border rounded text-sm"
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="ORDERED">Ordered</option>
          </select>

          <label className="text-sm font-medium text-gray-700">Urgency:</label>
          <select
            value={filterUrgency}
            onChange={(e) => setFilterUrgency(e.target.value)}
            className="px-3 py-1 border rounded text-sm"
          >
            <option value="">All</option>
            <option value="CRITICAL">Critical</option>
            <option value="WARNING">Warning</option>
            <option value="GOOD">Good</option>
            <option value="OVERSTOCKED">Overstocked</option>
          </select>

          <label className="text-sm font-medium text-gray-700">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1 border rounded text-sm"
          >
            <option value="urgency">Urgency</option>
            <option value="stockDuration">Stock Duration</option>
            <option value="productName">Product Name</option>
            <option value="currentStock">Current Stock</option>
            <option value="orderQty">Order Quantity</option>
          </select>

          <label className="text-sm font-medium text-gray-700">Order:</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
            className="px-3 py-1 border rounded text-sm"
          >
            <option value="desc">High to Low</option>
            <option value="asc">Low to High</option>
          </select>

          <div className="ml-4 text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded flex items-center gap-2">
            <span>🧠 ML Analysis:</span>
            <span className="font-medium">
              Time Series Forecasting + Multi-Supplier Optimization
            </span>
          </div>

          <div className="ml-4 text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded flex items-center gap-2">
            <span>📊 Showing:</span>
            <span className="font-medium">
              {filteredAndSortedSuggestions.length} of {suggestions.length} suggestions
            </span>
          </div>

          {(filterStatus || filterUrgency) && (
            <button
              onClick={() => {
                setFilterStatus("");
                setFilterUrgency("");
              }}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 flex items-center gap-1"
            >
              <span>🗑️</span>
              Clear Filters
            </button>
          )}

          {selectedIds.length > 0 && (
            <div className="flex items-center space-x-2 ml-auto">
              <span className="text-sm text-gray-600">{selectedIds.length} selected</span>
              <button
                onClick={() => handleApprove(false)}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                Approve
              </button>
              <button
                onClick={() => handleApprove(true)}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Approve & Create PO
              </button>
              <button
                onClick={handleReject}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Suggestions Table */}
      <div className="mx-auto px-6 py-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      filteredAndSortedSuggestions.length > 0 &&
                      selectedIds.length === filteredAndSortedSuggestions.length
                    }
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Urgency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Current Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Stock Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Order Qty
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Daily Sales
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Recommended Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedSuggestions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                    {suggestions.length === 0 ? (
                      <>
                        No suggestions found. Click "Generate Suggestions" to create new reorder
                        recommendations.
                      </>
                    ) : (
                      <>
                        No suggestions match the current filters. Try adjusting your filter
                        criteria.
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filteredAndSortedSuggestions.map((sug) => (
                  <React.Fragment key={sug.id}>
                    <tr
                      className={`hover:bg-gray-50 ${
                        sug.urgencyLevel === "CRITICAL"
                          ? "bg-red-50"
                          : sug.urgencyLevel === "WARNING"
                            ? "bg-yellow-50"
                            : ""
                      }`}
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(sug.id)}
                          onChange={() => toggleSelection(sug.id)}
                          disabled={sug.status !== "PENDING"}
                          className="rounded"
                        />
                      </td>
                      <td className="px-6 py-4">
                        {sug.urgencyLevel && (
                          <span
                            className={`px-2 py-1 text-xs font-bold rounded border ${getUrgencyColor(
                              sug.urgencyLevel
                            )}`}
                          >
                            {sug.urgencyLevel}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{sug.product.name}</div>
                          <div className="text-sm text-gray-500">{sug.product.sku}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`font-medium ${
                            (sug.reason.currentStock || 0) <= sug.rop
                              ? "text-red-600"
                              : "text-gray-900"
                          }`}
                        >
                          {sug.reason.currentStock || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {sug.stockDuration ? (
                          <span className="font-medium text-gray-900">
                            {sug.stockDuration.toFixed(1)} days
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-600 font-bold">
                        {sug.orderQty}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium text-gray-900">
                          {(sug.reason.forecastedDemand || sug.reason.meanDemand || 0).toFixed(1)}{" "}
                          units/day
                        </div>
                        <div className="text-xs text-gray-500">
                          {sug.reason.pattern && (
                            <>
                              Pattern: {sug.reason.pattern} (
                              {((sug.reason.patternConfidence || 0) * 100).toFixed(0)}%)
                              <br />
                            </>
                          )}
                          {sug.reason.daysRemaining && (
                            <>Days Remaining: {sug.reason.daysRemaining.toFixed(1)}</>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-medium ${
                              sug.urgencyLevel === "CRITICAL"
                                ? "text-red-700"
                                : sug.urgencyLevel === "WARNING"
                                  ? "text-yellow-700"
                                  : sug.urgencyLevel === "GOOD"
                                    ? "text-green-700"
                                    : "text-blue-700"
                            }`}
                          >
                            {getRecommendedAction(sug)}
                          </span>
                          {isDeliveryDayToday(sug.supplier) && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium">
                              📦 Delivery Today
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            sug.status === "PENDING"
                              ? "bg-yellow-100 text-yellow-800"
                              : sug.status === "APPROVED"
                                ? "bg-green-100 text-green-800"
                                : sug.status === "ORDERED"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {sug.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleRowExpansion(sug.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          {expandedRows.has(sug.id) ? "Hide Details" : "View Details"}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded row with scenarios */}
                    {expandedRows.has(sug.id) && (
                      <tr className="bg-gray-50">
                        <td colSpan={10} className="px-6 py-4">
                          <div className="space-y-4">
                            {/* Scenarios */}
                            {sug.scenarios && sug.scenarios.length > 0 && (
                              <div>
                                <h4 className="font-medium text-gray-900 mb-2">Order Scenarios:</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  {sug.scenarios.map((scenario, idx) => (
                                    <div
                                      key={`${sug.id}-scenario-${idx}`}
                                      className={`border rounded-lg p-3 ${
                                        scenario.label === "1 Week" ||
                                        scenario.label === "Recommended"
                                          ? "border-blue-500 bg-blue-50"
                                          : "border-gray-200 bg-white"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-sm">
                                          {scenario.label} Coverage
                                        </span>
                                        {(scenario.label === "1 Week" ||
                                          scenario.label === "Recommended") && (
                                          <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                                            ⭐ Recommended
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-sm space-y-1">
                                        <div>
                                          <span className="text-gray-600">Order:</span>{" "}
                                          <span className="font-bold text-blue-600">
                                            {scenario.orderQty} units
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-gray-600">Total Stock:</span>{" "}
                                          {scenario.projectedStock} units
                                        </div>
                                        <div>
                                          <span className="text-gray-600">Will Last:</span>{" "}
                                          <span className="font-medium">
                                            {scenario.projectedDuration.toFixed(1)} days
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Additional details */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600">ROP:</span>{" "}
                                <span className="font-medium">{sug.rop}</span>
                              </div>
                              {sug.reason.safetyStock && (
                                <div>
                                  <span className="text-gray-600">Safety Stock:</span>{" "}
                                  <span className="font-medium">{sug.reason.safetyStock}</span>
                                </div>
                              )}
                              {sug.reason.leadTimeDays && (
                                <div>
                                  <span className="text-gray-600">Lead Time:</span>{" "}
                                  <span className="font-medium">
                                    {sug.reason.leadTimeDays} days
                                  </span>
                                </div>
                              )}
                              {sug.reason.serviceLevel && (
                                <div>
                                  <span className="text-gray-600">Service Level:</span>{" "}
                                  <span className="font-medium">
                                    {(sug.reason.serviceLevel * 100).toFixed(0)}%
                                  </span>
                                </div>
                              )}
                              {sug.reason.pattern && (
                                <div>
                                  <span className="text-gray-600">Pattern:</span>{" "}
                                  <span className="font-medium">{sug.reason.pattern}</span>
                                </div>
                              )}
                              {sug.reason.forecastedDemand && (
                                <div>
                                  <span className="text-gray-600">Forecasted Demand:</span>{" "}
                                  <span className="font-medium">
                                    {sug.reason.forecastedDemand.toFixed(1)} units/day
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        {suggestions.length > 0 && (
          <div className="mt-4 p-4 bg-white rounded-lg shadow text-sm">
            <div className="font-medium mb-3">Legend:</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="font-medium mb-2 text-gray-700">Urgency Levels:</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 text-xs font-bold rounded border bg-red-100 text-red-800 border-red-300">
                      CRITICAL
                    </span>
                    <span className="text-gray-600">&lt; 3 days of stock remaining</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 text-xs font-bold rounded border bg-yellow-100 text-yellow-800 border-yellow-300">
                      WARNING
                    </span>
                    <span className="text-gray-600">3-7 days of stock remaining</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 text-xs font-bold rounded border bg-green-100 text-green-800 border-green-300">
                      GOOD
                    </span>
                    <span className="text-gray-600">7-30 days of stock remaining</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 text-xs font-bold rounded border bg-blue-100 text-blue-800 border-blue-300">
                      OVERSTOCKED
                    </span>
                    <span className="text-gray-600">&gt; 30 days of stock remaining</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="font-medium mb-2 text-gray-700">Metrics:</div>
                <div className="space-y-1 text-gray-600">
                  <div>
                    <strong>Stock Duration:</strong> Days until stock runs out at current demand
                  </div>
                  <div>
                    <strong>Order Qty:</strong> AI-recommended order quantity (based on 1-week
                    coverage)
                  </div>
                  <div>
                    <strong>Daily Sales:</strong> Average units sold per day + typical range of
                    variation
                  </div>
                  <div>
                    <strong>ROP:</strong> Reorder Point (when to reorder)
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
