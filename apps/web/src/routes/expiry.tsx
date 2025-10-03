import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";

interface Batch {
  id: string;
  productId: string;
  batchNumber?: string;
  expiryDate?: string;
  qtyOnHand: number;
  unitCost: number;
  receivedAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
    barcode?: string;
  };
  supplier?: {
    id: string;
    name: string;
  };
}

export const Route = createFileRoute("/expiry")({
  component: ExpiryDashboard,
});

function ExpiryDashboard() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysFilter, setDaysFilter] = useState<number>(90);

  useEffect(() => {
    fetchExpiringBatches();
  }, [daysFilter]);

  const fetchExpiringBatches = async () => {
    try {
      const data = await apiClient.get("/batches/expiring");
      setBatches(data.batches);
    } catch (error) {
      console.error("Failed to fetch expiring batches:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysUntilExpiry = (expiryDate: string): number => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryStatus = (days: number): "expired" | "critical" | "warning" | "ok" => {
    if (days < 0) return "expired";
    if (days <= 30) return "critical";
    if (days <= 90) return "warning";
    return "ok";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "expired":
        return "bg-red-100 text-red-800 border-red-300";
      case "critical":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "warning":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      default:
        return "bg-green-100 text-green-800 border-green-300";
    }
  };

  const filteredBatches = batches.filter((batch) => {
    if (!batch.expiryDate) return false;
    const days = getDaysUntilExpiry(batch.expiryDate);
    return days <= daysFilter;
  });

  const groupedBatches = filteredBatches.reduce(
    (acc, batch) => {
      if (!batch.expiryDate) return acc;
      const days = getDaysUntilExpiry(batch.expiryDate);
      const status = getExpiryStatus(days);

      if (!acc[status]) acc[status] = [];
      acc[status].push(batch);
      return acc;
    },
    {} as Record<string, Batch[]>
  );

  const stats = {
    expired: groupedBatches.expired?.length || 0,
    critical: groupedBatches.critical?.length || 0,
    warning: groupedBatches.warning?.length || 0,
    totalValue: filteredBatches.reduce(
      (sum, b) => sum + b.qtyOnHand * Number(b.unitCost),
      0
    ),
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Expiry Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            Monitor near-expiry and expired inventory
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-red-600">Expired</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">{stats.expired}</div>
            <div className="text-xs text-gray-500 mt-1">Requires immediate action</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-orange-600">Critical (≤30 days)</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">{stats.critical}</div>
            <div className="text-xs text-gray-500 mt-1">Urgent attention needed</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-yellow-600">Warning (31-90 days)</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">{stats.warning}</div>
            <div className="text-xs text-gray-500 mt-1">Monitor closely</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600">Total Value at Risk</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">
              ${stats.totalValue.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Inventory cost</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mx-auto px-6 py-4 bg-white border-b">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Show products expiring within:</label>
          <select
            value={daysFilter}
            onChange={(e) => setDaysFilter(Number(e.target.value))}
            className="px-3 py-1 border rounded text-sm"
          >
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
            <option value={365}>1 year</option>
          </select>
        </div>
      </div>

      {/* Batches Table */}
      <div className="mx-auto px-6 py-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Batch #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Expiry Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Days Left
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Qty on Hand
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Unit Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Total Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Supplier
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    No batches expiring within {daysFilter} days.
                  </td>
                </tr>
              ) : (
                filteredBatches
                  .sort((a, b) => {
                    const daysA = getDaysUntilExpiry(a.expiryDate!);
                    const daysB = getDaysUntilExpiry(b.expiryDate!);
                    return daysA - daysB;
                  })
                  .map((batch) => {
                    const daysLeft = getDaysUntilExpiry(batch.expiryDate!);
                    const status = getExpiryStatus(daysLeft);
                    const totalValue = batch.qtyOnHand * Number(batch.unitCost);

                    return (
                      <tr key={batch.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded border ${getStatusColor(
                              status
                            )}`}
                          >
                            {status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="font-medium text-gray-900">
                              {batch.product.name}
                            </div>
                            <div className="text-sm text-gray-500">{batch.product.sku}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {batch.batchNumber || "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(batch.expiryDate!).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span
                            className={`font-bold ${
                              daysLeft < 0
                                ? "text-red-600"
                                : daysLeft <= 30
                                ? "text-orange-600"
                                : daysLeft <= 90
                                ? "text-yellow-600"
                                : "text-green-600"
                            }`}
                          >
                            {daysLeft < 0 ? `${Math.abs(daysLeft)} days ago` : `${daysLeft} days`}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {batch.qtyOnHand}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          ${Number(batch.unitCost).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
                          ${totalValue.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {batch.supplier?.name || "—"}
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>

        {/* Action Recommendations */}
        {filteredBatches.length > 0 && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-3">📋 Recommended Actions:</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              {stats.expired > 0 && (
                <li>
                  ✓ <strong>Remove expired items</strong> ({stats.expired} batches) from inventory
                  immediately
                </li>
              )}
              {stats.critical > 0 && (
                <li>
                  ✓ <strong>Apply discounts</strong> to {stats.critical} near-expiry items to move
                  stock quickly
                </li>
              )}
              {stats.warning > 0 && (
                <li>
                  ✓ <strong>Monitor</strong> {stats.warning} items expiring in 31-90 days
                </li>
              )}
              <li>✓ <strong>Review ordering patterns</strong> to reduce future waste</li>
              <li>
                ✓ <strong>Implement FEFO</strong> (First Expired, First Out) in POS system
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}