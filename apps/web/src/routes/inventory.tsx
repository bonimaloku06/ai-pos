import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/inventory")({
  component: InventoryScreen,
});

type Tab = "overview" | "batches" | "expiring";

function InventoryScreen() {
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [inventorySummary, setInventorySummary] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [expiringBatches, setExpiringBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Load data
  useEffect(() => {
    if (!authLoading && user) {
      loadData();
    }
  }, [activeTab, authLoading, user]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === "overview") {
        const data = await apiClient.getInventorySummary();
        setInventorySummary(data.inventory || []);
      } else if (activeTab === "batches") {
        const data = await apiClient.getBatches({ hasStock: true, limit: 100 });
        setBatches(data.batches || []);
      } else if (activeTab === "expiring") {
        const data = await apiClient.getExpiringBatches(90);
        setExpiringBatches(data.batches || []);
      }
    } catch (error: any) {
      console.error("Failed to load inventory:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter inventory summary by search
  const filteredInventory = inventorySummary.filter(
    (item) =>
      item.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.product.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter batches by search
  const filteredBatches = batches.filter(
    (batch) =>
      batch.product?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.product?.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.batchNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter expiring batches by search
  const filteredExpiringBatches = expiringBatches.filter(
    (batch) =>
      batch.product?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.product?.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="/"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("overview")}
              className={`${
                activeTab === "overview"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("batches")}
              className={`${
                activeTab === "batches"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
            >
              All Batches
            </button>
            <button
              onClick={() => setActiveTab("expiring")}
              className={`${
                activeTab === "expiring"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
            >
              Expiring Soon
              {expiringBatches.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">
                  {expiringBatches.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by product name, SKU, or batch number..."
            className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-500">Loading...</p>
          </div>
        ) : (
          <>
            {activeTab === "overview" && <OverviewTab inventory={filteredInventory} />}
            {activeTab === "batches" && <BatchesTab batches={filteredBatches} />}
            {activeTab === "expiring" && <ExpiringTab batches={filteredExpiringBatches} />}
          </>
        )}
      </div>
    </div>
  );
}

function OverviewTab({ inventory }: { inventory: any[] }) {
  const totalValue = inventory.reduce((sum, item) => sum + item.totalValue, 0);
  const totalItems = inventory.length;
  const lowStockItems = inventory.filter((item) => item.totalQty < 50).length;

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm font-medium text-gray-600">Total Products</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{totalItems}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm font-medium text-gray-600">Total Inventory Value</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">${totalValue.toFixed(2)}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm font-medium text-gray-600">Low Stock Items</div>
          <div className="text-3xl font-bold text-red-600 mt-2">{lowStockItems}</div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Qty
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Avg Cost
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Value
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Batches
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Next Expiry
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {inventory.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No inventory found
                </td>
              </tr>
            ) : (
              inventory.map((item) => (
                <tr key={item.product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{item.product.name}</div>
                    <div className="text-sm text-gray-500">{item.product.sku}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {item.product.category?.name || "-"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`font-medium ${
                        item.totalQty < 50 ? "text-red-600" : "text-gray-900"
                      }`}
                    >
                      {item.totalQty}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-900">${item.avgCost.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    ${item.totalValue.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-500">{item.batchCount}</td>
                  <td className="px-6 py-4 text-center">
                    {item.earliestExpiry ? (
                      <div>
                        <div className="text-sm text-gray-900">
                          {new Date(item.earliestExpiry).toLocaleDateString()}
                        </div>
                        <div
                          className={`text-xs ${
                            item.daysUntilExpiry <= 30
                              ? "text-red-600 font-medium"
                              : item.daysUntilExpiry <= 90
                                ? "text-yellow-600"
                                : "text-gray-500"
                          }`}
                        >
                          {item.daysUntilExpiry} days
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BatchesTab({ batches }: { batches: any[] }) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Batch Number
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Product
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Supplier
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Qty on Hand
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Unit Cost
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Expiry Date
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Received
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {batches.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                No batches found
              </td>
            </tr>
          ) : (
            batches.map((batch) => (
              <tr key={batch.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{batch.batchNumber}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{batch.product?.name}</div>
                  <div className="text-sm text-gray-500">{batch.product?.sku}</div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{batch.supplier?.name || "-"}</td>
                <td className="px-6 py-4 text-right font-medium text-gray-900">
                  {batch.qtyOnHand}
                </td>
                <td className="px-6 py-4 text-right text-gray-900">${batch.unitCost.toFixed(2)}</td>
                <td className="px-6 py-4 text-center">
                  <div className="text-sm text-gray-900">
                    {new Date(batch.expiryDate).toLocaleDateString()}
                  </div>
                  <div
                    className={`text-xs ${
                      batch.daysUntilExpiry <= 30
                        ? "text-red-600 font-medium"
                        : batch.daysUntilExpiry <= 90
                          ? "text-yellow-600"
                          : "text-gray-500"
                    }`}
                  >
                    {batch.daysUntilExpiry} days left
                  </div>
                </td>
                <td className="px-6 py-4 text-center text-sm text-gray-500">
                  {new Date(batch.receivedAt).toLocaleDateString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ExpiringTab({ batches }: { batches: any[] }) {
  const totalValueAtRisk = batches.reduce((sum, b) => sum + (b.valueAtRisk || 0), 0);

  return (
    <div>
      {/* Alert Card */}
      {batches.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                {batches.length} batch(es) expiring within 90 days
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  Total value at risk:{" "}
                  <span className="font-bold">${totalValueAtRisk.toFixed(2)}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expiring Batches Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priority
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Batch
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Qty
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Value at Risk
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Expiry Date
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Days Left
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {batches.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <svg
                      className="h-12 w-12 text-green-400 mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-lg font-medium text-gray-900">All clear!</p>
                    <p className="text-sm text-gray-500">No batches expiring in the next 90 days</p>
                  </div>
                </td>
              </tr>
            ) : (
              batches.map((batch) => (
                <tr key={batch.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    {batch.daysUntilExpiry <= 30 ? (
                      <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                        URGENT
                      </span>
                    ) : batch.daysUntilExpiry <= 60 ? (
                      <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded">
                        HIGH
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                        MEDIUM
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{batch.product?.name}</div>
                    <div className="text-sm text-gray-500">{batch.product?.sku}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{batch.batchNumber}</td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    {batch.qtyOnHand}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    ${batch.valueAtRisk.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-900">
                    {new Date(batch.expiryDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`font-bold ${
                        batch.daysUntilExpiry <= 30
                          ? "text-red-600"
                          : batch.daysUntilExpiry <= 60
                            ? "text-orange-600"
                            : "text-yellow-600"
                      }`}
                    >
                      {batch.daysUntilExpiry} days
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
