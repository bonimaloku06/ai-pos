import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/purchase-orders")({
  component: PurchaseOrdersScreen,
});

type View = "list" | "create" | "detail";

function PurchaseOrdersScreen() {
  const { user, isLoading: authLoading } = useAuth();
  const [view, setView] = useState<View>("list");
  const [pos, setPOs] = useState<any[]>([]);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    if (!authLoading && user) {
      loadPOs();
    }
  }, [authLoading, user, statusFilter]);

  const loadPOs = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getPurchaseOrders({
        status: statusFilter || undefined,
        limit: 100,
      });
      setPOs(data.pos || []);
    } catch (error: any) {
      console.error("Failed to load purchase orders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewPO = async (po: any) => {
    try {
      const data = await apiClient.getPurchaseOrder(po.id);
      setSelectedPO(data.po);
      setView("detail");
    } catch (error: any) {
      alert(`Failed to load PO: ${error.message}`);
    }
  };

  const handleBack = () => {
    setView("list");
    setSelectedPO(null);
    loadPOs();
  };

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (user.role === "CASHIER") {
    return (
      <div className="min-h-full flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
          <a href="/" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (isLoading || !pos) {
    return (
      <div className="flex items-center justify-center p-8">
        <p>Loading purchase orders...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
            </div>
            <div className="flex items-center space-x-4">
              {view === "list" && (
                <button
                  onClick={() => setView("create")}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                >
                  Create PO
                </button>
              )}
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
        {view === "list" && (
          <POList
            pos={pos}
            isLoading={isLoading}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onViewPO={handleViewPO}
          />
        )}
        {view === "create" && <CreatePOForm onBack={handleBack} />}
        {view === "detail" && selectedPO && (
          <PODetail po={selectedPO} onBack={handleBack} onUpdate={loadPOs} />
        )}
      </div>
    </div>
  );
}

function POList({
  pos,
  isLoading,
  statusFilter,
  onStatusFilterChange,
  onViewPO,
}: {
  pos: any[];
  isLoading: boolean;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onViewPO: (po: any) => void;
}) {
  const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-800",
    APPROVED: "bg-blue-100 text-blue-800",
    RECEIVED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 flex items-center space-x-4">
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="APPROVED">Approved</option>
          <option value="RECEIVED">Received</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* PO Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                PO Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Supplier
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Items
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Total
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Expected
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Created
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pos.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  No purchase orders found. Click "Create PO" to create one.
                </td>
              </tr>
            ) : (
              pos.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{po.poNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{po.supplier?.name}</td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${statusColors[po.status]}`}
                    >
                      {po.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-900">
                    {po.lines?.length || 0}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    ${Number(po.subtotal || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-600">
                    {po.expectedAt ? new Date(po.expectedAt).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-600">
                    {new Date(po.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => onViewPO(po)}
                      className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                    >
                      View
                    </button>
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

function CreatePOForm({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Product search
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<any[]>([]);

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const loadSuppliers = async () => {
    try {
      const data = await apiClient.getSuppliers({ isActive: true });
      setSuppliers(data.suppliers || []);
      if (data.suppliers?.length > 0) {
        setSelectedSupplier(data.suppliers[0].id);
      }
    } catch (error: any) {
      console.error("Failed to load suppliers:", error);
    }
  };

  const searchProducts = async () => {
    if (!productSearch || productSearch.length < 2) {
      setProductResults([]);
      return;
    }

    try {
      const data = await apiClient.getProducts({ query: productSearch, limit: 10 });
      setProductResults(data.products || []);
    } catch (error: any) {
      console.error("Search failed:", error);
    }
  };

  const addProduct = (product: any) => {
    const newLine = {
      id: `line-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      qty: 0,
      unitCost: 0,
      notes: "",
    };
    setLines([...lines, newLine]);
    setProductSearch("");
    setProductResults([]);
  };

  const updateLine = (lineId: string, field: string, value: any) => {
    setLines(lines.map((line) => (line.id === lineId ? { ...line, [field]: value } : line)));
  };

  const removeLine = (lineId: string) => {
    setLines(lines.filter((line) => line.id !== lineId));
  };

  const handleSubmit = async () => {
    if (!selectedSupplier) {
      alert("Please select a supplier");
      return;
    }

    if (lines.length === 0) {
      alert("Please add at least one product");
      return;
    }

    // Validate lines
    for (const line of lines) {
      if (line.qty <= 0 || line.unitCost <= 0) {
        alert("Please fill in all line item details");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const data = {
        supplierId: selectedSupplier,
        expectedAt: expectedDate || undefined,
        notes,
        lines: lines.map((line) => ({
          productId: line.productId,
          qty: Number(line.qty),
          unitCost: Number(line.unitCost),
          notes: line.notes,
        })),
      };

      const result = await apiClient.createPurchaseOrder(data);
      alert(`PO ${result.po.poNumber} created successfully!`);
      onBack();
    } catch (error: any) {
      alert(`Failed to create PO: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const total = lines.reduce((sum, line) => sum + line.qty * line.unitCost, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left - Form */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Create Purchase Order</h2>

          {/* Supplier */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Supplier *</label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          {/* Expected Date */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expected Delivery Date
            </label>
            <input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Add Product */}
        <div className="bg-white p-6 rounded-lg shadow">
          <label className="block text-sm font-medium text-gray-700 mb-2">Add Product</label>
          <input
            type="text"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder="Search product by name or SKU..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />

          {/* Search Results */}
          {productResults.length > 0 && (
            <div className="mt-2 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {productResults.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addProduct(product)}
                  className="w-full px-4 py-2 text-left hover:bg-blue-50 border-b last:border-b-0"
                >
                  <div className="font-medium text-gray-900">{product.name}</div>
                  <div className="text-sm text-gray-600">SKU: {product.sku}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h3 className="font-semibold text-gray-900">Line Items ({lines.length})</h3>
          </div>

          {lines.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No items added. Search and add products above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Product
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Qty
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Unit Cost
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Total
                    </th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{line.productName}</div>
                        <div className="text-sm text-gray-500">{line.productSku}</div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={line.qty || ""}
                          onChange={(e) => updateLine(line.id, "qty", Number(e.target.value))}
                          placeholder="0"
                          min="1"
                          className="w-20 px-2 py-1 text-sm text-right border border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={line.unitCost || ""}
                          onChange={(e) => updateLine(line.id, "unitCost", Number(e.target.value))}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        ${((line.qty || 0) * (line.unitCost || 0)).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeLine(line.id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right - Summary */}
      <div className="lg:col-span-1">
        <div className="bg-white p-6 rounded-lg shadow sticky top-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Summary</h3>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between">
              <span className="text-gray-600">Items:</span>
              <span className="font-medium text-gray-900">{lines.length}</span>
            </div>
            <div className="border-t pt-3 flex justify-between">
              <span className="text-gray-900 font-medium">Total:</span>
              <span className="text-xl font-bold text-gray-900">${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleSubmit}
              disabled={lines.length === 0 || isSubmitting}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating..." : "Create PO"}
            </button>
            <button
              onClick={onBack}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PODetail({ po, onBack, onUpdate }: { po: any; onBack: () => void; onUpdate: () => void }) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async () => {
    if (!confirm(`Approve PO ${po.poNumber}?`)) return;

    setIsProcessing(true);
    try {
      await apiClient.approvePurchaseOrder(po.id);
      alert("PO approved successfully!");
      onUpdate();
      onBack();
    } catch (error: any) {
      alert(`Failed to approve PO: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm(`Cancel PO ${po.poNumber}?`)) return;

    setIsProcessing(true);
    try {
      await apiClient.cancelPurchaseOrder(po.id);
      alert("PO cancelled successfully!");
      onUpdate();
      onBack();
    } catch (error: any) {
      alert(`Failed to cancel PO: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-800",
    APPROVED: "bg-blue-100 text-blue-800",
    RECEIVED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  return (
    <div>
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{po.poNumber}</h2>
            <p className="text-sm text-gray-600">
              {po.supplier?.name} • Created {new Date(po.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <span className={`px-3 py-1 text-sm font-medium rounded ${statusColors[po.status]}`}>
              {po.status}
            </span>
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Back
            </button>
          </div>
        </div>

        {/* Details */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <div className="text-sm text-gray-600">Expected Delivery</div>
              <div className="font-medium text-gray-900">
                {po.expectedAt ? new Date(po.expectedAt).toLocaleDateString() : "Not specified"}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Created By</div>
              <div className="font-medium text-gray-900">{po.createdBy?.email}</div>
            </div>
            {po.approvedAt && (
              <div>
                <div className="text-sm text-gray-600">Approved At</div>
                <div className="font-medium text-gray-900">
                  {new Date(po.approvedAt).toLocaleDateString()}
                </div>
              </div>
            )}
            {po.receivedAt && (
              <div>
                <div className="text-sm text-gray-600">Received At</div>
                <div className="font-medium text-gray-900">
                  {new Date(po.receivedAt).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>

          {po.notes && (
            <div className="mb-6">
              <div className="text-sm text-gray-600 mb-1">Notes</div>
              <div className="text-gray-900">{po.notes}</div>
            </div>
          )}

          {/* Line Items */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Line Items</h3>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Product
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Qty
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Unit Cost
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {po.lines.map((line: any) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{line.product?.name}</div>
                      <div className="text-sm text-gray-500">{line.product?.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">{line.qty}</td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      ${Number(line.unitCost || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      ${Number(line.lineTotal || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right font-semibold">
                    Total:
                  </td>
                  <td className="px-4 py-3 text-right text-xl font-bold text-gray-900">
                    ${Number(po.subtotal || 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-3">
            {po.status === "DRAFT" && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300"
                >
                  Approve
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-300"
                >
                  Cancel
                </button>
              </>
            )}
            {po.status === "APPROVED" && (
              <>
                <a
                  href="/grn"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 inline-block"
                >
                  Receive Stock (GRN)
                </a>
                <button
                  onClick={handleCancel}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-300"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
