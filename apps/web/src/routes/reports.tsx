import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth-context";
import { apiClient } from "@/lib/api-client";

interface SalesReport {
  summary: {
    totalSales: number;
    totalTransactions: number;
    totalTax: number;
    totalDiscount: number;
    avgTransaction: number;
  };
  timeSeries: Array<{
    period: string;
    sales: number;
    transactions: number;
  }>;
  topProducts: Array<{
    productId: string;
    name: string;
    qty: number;
    revenue: number;
  }>;
}

interface MarginsReport {
  summary: {
    totalRevenue: number;
    totalCost: number;
    totalMargin: number;
    marginPercentage: number;
  };
  products: Array<{
    productId: string;
    name: string;
    revenue: number;
    cost: number;
    margin: number;
    marginPercentage: number;
    qty: number;
  }>;
}

interface DeadStockReport {
  summary: {
    totalItems: number;
    totalValue: number;
    daysThreshold: number;
  };
  deadStock: Array<{
    productId: string;
    productName: string;
    sku: string;
    qtyOnHand: number;
    totalValue: number;
    daysInStock: number;
  }>;
}

interface ServiceLevelReport {
  summary: {
    totalProducts: number;
    currentlyStocked: number;
    outOfStock: number;
    serviceLevel: number;
  };
  outOfStockProducts: Array<{
    productId: string;
    name: string;
    sku: string;
  }>;
}

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"sales" | "margins" | "dead-stock" | "service-level">("sales");
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [marginsReport, setMarginsReport] = useState<MarginsReport | null>(null);
  const [deadStockReport, setDeadStockReport] = useState<DeadStockReport | null>(null);
  const [serviceLevelReport, setServiceLevelReport] = useState<ServiceLevelReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    fetchReport(activeTab);
  }, [activeTab, dateRange]);

  const fetchReport = async (type: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        ...(user?.storeId && { storeId: user.storeId }),
      });

      const data = await apiClient.get(`/reports/${type}?${params}`);

      if (type === "sales") setSalesReport(data);
      else if (type === "margins") setMarginsReport(data);
      else if (type === "dead-stock") setDeadStockReport(data);
      else if (type === "service-level") setServiceLevelReport(data);
    } catch (error) {
      console.error("Failed to fetch report:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        headers.map((header) => JSON.stringify(row[header] ?? "")).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
              <p className="text-sm text-gray-600 mt-1">
                Business intelligence and performance metrics
              </p>
            </div>
            <a
              href="/"
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              ← Back to Home
            </a>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="mx-auto px-6">
          <div className="flex space-x-8">
            {[
              { key: "sales", label: "Sales" },
              { key: "margins", label: "Margins" },
              { key: "dead-stock", label: "Dead Stock" },
              { key: "service-level", label: "Service Level" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Date Range Filter */}
      {activeTab !== "service-level" && (
        <div className="mx-auto px-6 py-4 bg-white border-b">
          <div className="flex items-center space-x-4 flex-wrap gap-2">
            <label className="text-sm font-medium text-gray-700">Date Range:</label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  setDateRange({ startDate: today, endDate: today });
                }}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
              >
                Today
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const startOfWeek = new Date(today);
                  startOfWeek.setDate(today.getDate() - today.getDay());
                  setDateRange({
                    startDate: startOfWeek.toISOString().split("T")[0],
                    endDate: new Date().toISOString().split("T")[0],
                  });
                }}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
              >
                This Week
              </button>
              <button
                onClick={() => {
                  const endDate = new Date();
                  const startDate = new Date();
                  startDate.setDate(endDate.getDate() - 30);
                  setDateRange({
                    startDate: startDate.toISOString().split("T")[0],
                    endDate: endDate.toISOString().split("T")[0],
                  });
                }}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
              >
                Last 30 Days
              </button>
            </div>
            <div className="border-l border-gray-300 h-6 mx-2"></div>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="px-3 py-1 border rounded text-sm"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="px-3 py-1 border rounded text-sm"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="mx-auto px-6 py-6">
        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <>
            {/* Sales Report */}
            {activeTab === "sales" && salesReport && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600">Total Sales</div>
                    <div className="text-3xl font-bold text-gray-900 mt-2">
                      ${salesReport.summary.totalSales.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600">Transactions</div>
                    <div className="text-3xl font-bold text-gray-900 mt-2">
                      {salesReport.summary.totalTransactions}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600">Avg Transaction</div>
                    <div className="text-3xl font-bold text-gray-900 mt-2">
                      ${salesReport.summary.avgTransaction.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600">Total Tax</div>
                    <div className="text-3xl font-bold text-gray-900 mt-2">
                      ${salesReport.summary.totalTax.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Top Products */}
                <div className="bg-white rounded-lg shadow">
                  <div className="p-6 border-b flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Top Products</h3>
                    <button
                      onClick={() => exportToCSV(salesReport.topProducts, "top_products")}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Export CSV
                    </button>
                  </div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Product
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Quantity Sold
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Revenue
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {salesReport.topProducts.map((product, idx) => (
                        <tr key={product.productId}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{product.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {product.qty}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            ${product.revenue.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Margins Report */}
            {activeTab === "margins" && marginsReport && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600">Total Revenue</div>
                    <div className="text-3xl font-bold text-gray-900 mt-2">
                      ${marginsReport.summary.totalRevenue.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600">Total Cost</div>
                    <div className="text-3xl font-bold text-gray-900 mt-2">
                      ${marginsReport.summary.totalCost.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600">Total Margin</div>
                    <div className="text-3xl font-bold text-green-600 mt-2">
                      ${marginsReport.summary.totalMargin.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600">Margin %</div>
                    <div className="text-3xl font-bold text-green-600 mt-2">
                      {marginsReport.summary.marginPercentage.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Product Margins */}
                <div className="bg-white rounded-lg shadow">
                  <div className="p-6 border-b flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Product Margins</h3>
                    <button
                      onClick={() => exportToCSV(marginsReport.products, "product_margins")}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Export CSV
                    </button>
                  </div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Product
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Revenue
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Cost
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Margin
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Margin %
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {marginsReport.products.slice(0, 20).map((product) => (
                        <tr key={product.productId}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{product.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${product.revenue.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${product.cost.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                            ${product.margin.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                            <span
                              className={
                                product.marginPercentage > 30
                                  ? "text-green-600"
                                  : product.marginPercentage > 15
                                  ? "text-yellow-600"
                                  : "text-red-600"
                              }
                            >
                              {product.marginPercentage.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Dead Stock Report */}
            {activeTab === "dead-stock" && deadStockReport && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600">Total Items</div>
                    <div className="text-3xl font-bold text-gray-900 mt-2">
                      {deadStockReport.summary.totalItems}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600">Total Value at Risk</div>
                    <div className="text-3xl font-bold text-red-600 mt-2">
                      ${deadStockReport.summary.totalValue.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600">Threshold</div>
                    <div className="text-3xl font-bold text-gray-900 mt-2">
                      {deadStockReport.summary.daysThreshold} days
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow">
                  <div className="p-6 border-b flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Dead Stock Items</h3>
                    <button
                      onClick={() => exportToCSV(deadStockReport.deadStock, "dead_stock")}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Export CSV
                    </button>
                  </div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Product
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          SKU
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Qty on Hand
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Days in Stock
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Total Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {deadStockReport.deadStock.map((item) => (
                        <tr key={item.productId}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{item.productName}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.sku}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {item.qtyOnHand}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-semibold">
                            {item.daysInStock} days
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            ${item.totalValue.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Service Level Report */}
            {activeTab === "service-level" && serviceLevelReport && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600">Total Products</div>
                    <div className="text-3xl font-bold text-gray-900 mt-2">
                      {serviceLevelReport.summary.totalProducts}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600">In Stock</div>
                    <div className="text-3xl font-bold text-green-600 mt-2">
                      {serviceLevelReport.summary.currentlyStocked}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600">Out of Stock</div>
                    <div className="text-3xl font-bold text-red-600 mt-2">
                      {serviceLevelReport.summary.outOfStock}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm font-medium text-gray-600">Service Level</div>
                    <div className="text-3xl font-bold text-blue-600 mt-2">
                      {serviceLevelReport.summary.serviceLevel.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow">
                  <div className="p-6 border-b flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Out of Stock Products</h3>
                    <button
                      onClick={() =>
                        exportToCSV(serviceLevelReport.outOfStockProducts, "out_of_stock")
                      }
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Export CSV
                    </button>
                  </div>
                  {serviceLevelReport.outOfStockProducts.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                      All products are in stock! 🎉
                    </div>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Product Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            SKU
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {serviceLevelReport.outOfStockProducts.map((product) => (
                          <tr key={product.productId}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-medium text-gray-900">{product.name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {product.sku}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800">
                                {product.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}