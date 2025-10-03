import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";

interface DashboardStats {
  todaySales: {
    total: number;
    transactions: number;
    items: number;
  };
  todayPurchases: {
    total: number;
    orders: number;
  };
  lowStock: {
    count: number;
    items: Array<{
      productName: string;
      sku: string;
      currentStock: number;
      daysRemaining: number;
    }>;
  };
  deliveriesToday: Array<{
    supplierId: string;
    supplierName: string;
    deliveryDay: string;
    productsCanOrder: number;
    lowStockProducts: number;
  }>;
}

export function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.storeId) {
      fetchDashboardStats();
    }
  }, [user]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);

      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Fetch today's sales
      const salesResponse = await apiClient.get(
        `/reports/sales?startDate=${today.toISOString()}&endDate=${tomorrow.toISOString()}&storeId=${user.storeId}`
      );

      // Fetch low stock items (from reorder suggestions)
      const suggestionsResponse = await apiClient.get(
        `/reorder-suggestions?status=PENDING&storeId=${user.storeId}`
      );

      // Fetch suppliers
      const suppliersResponse = await apiClient.get("/suppliers");

      // Calculate stats
      const todaySales = {
        total: salesResponse.summary?.totalSales || 0,
        transactions: salesResponse.summary?.totalTransactions || 0,
        items:
          salesResponse.sales?.reduce(
            (sum: number, sale: any) =>
              sum + sale.lines.reduce((lineSum: number, line: any) => lineSum + line.qty, 0),
            0
          ) || 0,
      };

      // Get low stock items (CRITICAL and WARNING urgency)
      const lowStockItems =
        suggestionsResponse.suggestions?.filter(
          (sug: any) => sug.urgencyLevel === "CRITICAL" || sug.urgencyLevel === "WARNING"
        ) || [];

      const lowStock = {
        count: lowStockItems.length,
        items: lowStockItems.slice(0, 5).map((sug: any) => ({
          productName: sug.product.name,
          sku: sug.product.sku,
          currentStock: sug.reason?.currentStock || 0,
          daysRemaining: sug.stockDuration || 0,
        })),
      };

      // Check which suppliers deliver today
      const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
      const suppliers = suppliersResponse.suppliers || [];

      const deliveriesToday = suppliers
        .filter(
          (supplier: any) => supplier.deliveryDays && supplier.deliveryDays.includes(dayOfWeek)
        )
        .map((supplier: any) => {
          // Count products from this supplier that need ordering
          const supplierProducts = lowStockItems.filter(
            (sug: any) => sug.supplierId === supplier.id
          );

          return {
            supplierId: supplier.id,
            supplierName: supplier.name,
            deliveryDay: dayOfWeek,
            productsCanOrder: supplierProducts.length,
            lowStockProducts: supplierProducts.filter((p: any) => p.urgencyLevel === "CRITICAL")
              .length,
          };
        })
        .filter((s: any) => s.productsCanOrder > 0);

      setStats({
        todaySales,
        todayPurchases: { total: 0, orders: 0 }, // TODO: Implement if needed
        lowStock,
        deliveriesToday,
      });
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard Overview</h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Today's Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-muted-foreground">Today's Sales</div>
              <span className="text-2xl">💰</span>
            </div>
            <div className="text-3xl font-bold">
              ${stats?.todaySales.total.toFixed(2) || "0.00"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats?.todaySales.transactions || 0} transactions, {stats?.todaySales.items || 0}{" "}
              items
            </div>
          </div>

          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-muted-foreground">Low Stock Items</div>
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="text-3xl font-bold text-orange-600">{stats?.lowStock.count || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Needs attention</div>
          </div>

          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-muted-foreground">Deliveries Today</div>
              <span className="text-2xl">🚚</span>
            </div>
            <div className="text-3xl font-bold text-blue-600">
              {stats?.deliveriesToday.length || 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Suppliers delivering</div>
          </div>

          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-muted-foreground">Can Order</div>
              <span className="text-2xl">📦</span>
            </div>
            <div className="text-3xl font-bold text-green-600">
              {stats?.deliveriesToday.reduce((sum, d) => sum + d.productsCanOrder, 0) || 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Products available</div>
          </div>
        </div>

        {/* Suppliers Delivering Today */}
        {stats?.deliveriesToday && stats.deliveriesToday.length > 0 && (
          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">📦 Suppliers Delivering Today</h2>
                <p className="text-sm text-muted-foreground">
                  Order these products today for quick delivery
                </p>
              </div>
              <Link
                to="/replenishment"
                className="text-sm text-blue-600 hover:underline font-medium"
              >
                View All Suggestions →
              </Link>
            </div>
            <div className="space-y-3">
              {stats.deliveriesToday.map((delivery) => (
                <div
                  key={delivery.supplierId}
                  className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                      {delivery.supplierName[0]}
                    </div>
                    <div>
                      <div className="font-medium">{delivery.supplierName}</div>
                      <div className="text-sm text-muted-foreground">
                        {delivery.productsCanOrder} products can be ordered
                        {delivery.lowStockProducts > 0 && (
                          <span className="ml-2 text-red-600 font-medium">
                            ({delivery.lowStockProducts} critical)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                      📦 Delivery Today
                    </span>
                    <Link
                      to="/replenishment"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                    >
                      Order Now
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Low Stock Alert */}
        {stats?.lowStock.items && stats.lowStock.items.length > 0 && (
          <div className="bg-card rounded-lg border border-orange-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-orange-600">
                  ⚠️ Critical Low Stock Items
                </h2>
                <p className="text-sm text-muted-foreground">
                  Urgent: These items need immediate attention
                </p>
              </div>
              <Link
                to="/replenishment"
                className="text-sm text-orange-600 hover:underline font-medium"
              >
                View All →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-sm font-medium text-muted-foreground">
                      Product
                    </th>
                    <th className="text-left py-2 text-sm font-medium text-muted-foreground">
                      SKU
                    </th>
                    <th className="text-right py-2 text-sm font-medium text-muted-foreground">
                      Stock
                    </th>
                    <th className="text-right py-2 text-sm font-medium text-muted-foreground">
                      Days Left
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.lowStock.items.map((item, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-3 font-medium">{item.productName}</td>
                      <td className="py-3 text-sm text-muted-foreground">{item.sku}</td>
                      <td className="py-3 text-right">
                        <span className="font-bold text-red-600">{item.currentStock}</span>
                      </td>
                      <td className="py-3 text-right">
                        <span
                          className={`font-medium ${
                            item.daysRemaining < 3 ? "text-red-600" : "text-orange-600"
                          }`}
                        >
                          {item.daysRemaining.toFixed(1)} days
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/pos"
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-4 transition"
          >
            <div className="text-2xl mb-2">🛒</div>
            <div className="font-medium">New Sale</div>
          </Link>
          <Link
            to="/grn"
            className="bg-green-600 hover:bg-green-700 text-white rounded-lg p-4 transition"
          >
            <div className="text-2xl mb-2">📥</div>
            <div className="font-medium">Receive Stock</div>
          </Link>
          <Link
            to="/replenishment"
            className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg p-4 transition"
          >
            <div className="text-2xl mb-2">🤖</div>
            <div className="font-medium">AI Suggestions</div>
          </Link>
          <Link
            to="/reports"
            className="bg-pink-600 hover:bg-pink-700 text-white rounded-lg p-4 transition"
          >
            <div className="text-2xl mb-2">📊</div>
            <div className="font-medium">Reports</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
