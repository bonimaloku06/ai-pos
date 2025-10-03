import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";

interface PriceRule {
  id: string;
  scope: "GLOBAL" | "CATEGORY" | "PRODUCT";
  scopeId?: string;
  ruleType: "MARKUP_PERCENT" | "FIXED_PRICE" | "DISCOUNT";
  value: number;
  roundingMode: string;
  startDate?: string;
  endDate?: string;
  priority: number;
  isActive: boolean;
  product?: {
    id: string;
    name: string;
    sku: string;
  };
}

interface Product {
  id: string;
  name: string;
  sku: string;
}

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});

function PricingPage() {
  const [rules, setRules] = useState<PriceRule[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<PriceRule | null>(null);
  const [formData, setFormData] = useState({
    scope: "PRODUCT" as "GLOBAL" | "CATEGORY" | "PRODUCT",
    scopeId: "",
    ruleType: "MARKUP_PERCENT" as "MARKUP_PERCENT" | "FIXED_PRICE" | "DISCOUNT",
    value: 0,
    roundingMode: "NEAREST_99",
    startDate: "",
    endDate: "",
    priority: 0,
  });

  useEffect(() => {
    fetchRules();
    fetchProducts();
  }, []);

  const fetchRules = async () => {
    try {
      const data = await apiClient.get("/pricing");
      setRules(data.rules);
    } catch (error) {
      console.error("Failed to fetch rules:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const data = await apiClient.get("/products");
      setProducts(data.products);
    } catch (error) {
      console.error("Failed to fetch products:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        value: Number(formData.value),
        priority: Number(formData.priority),
        scopeId: formData.scope === "PRODUCT" ? formData.scopeId : null,
      };

      if (editingRule) {
        await apiClient.patch(`/pricing/${editingRule.id}`, payload);
      } else {
        await apiClient.post("/pricing", payload);
      }

      await fetchRules();
      resetForm();
    } catch (error) {
      console.error("Failed to save rule:", error);
      alert("Failed to save rule");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this pricing rule?")) return;

    try {
      await apiClient.delete(`/pricing/${id}`);
      await fetchRules();
    } catch (error) {
      console.error("Failed to delete rule:", error);
      alert("Failed to delete rule");
    }
  };

  const handleToggleActive = async (rule: PriceRule) => {
    try {
      await apiClient.patch(`/pricing/${rule.id}`, {
        isActive: !rule.isActive,
      });
      await fetchRules();
    } catch (error) {
      console.error("Failed to toggle rule:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      scope: "PRODUCT",
      scopeId: "",
      ruleType: "MARKUP_PERCENT",
      value: 0,
      roundingMode: "NEAREST_99",
      startDate: "",
      endDate: "",
      priority: 0,
    });
    setEditingRule(null);
    setShowModal(false);
  };

  const handleEdit = (rule: PriceRule) => {
    setEditingRule(rule);
    setFormData({
      scope: rule.scope,
      scopeId: rule.scopeId || "",
      ruleType: rule.ruleType,
      value: Number(rule.value),
      roundingMode: rule.roundingMode,
      startDate: rule.startDate ? rule.startDate.split("T")[0] : "",
      endDate: rule.endDate ? rule.endDate.split("T")[0] : "",
      priority: rule.priority,
    });
    setShowModal(true);
  };

  const getRuleTypeLabel = (type: string) => {
    switch (type) {
      case "MARKUP_PERCENT":
        return "Markup %";
      case "FIXED_PRICE":
        return "Fixed Price";
      case "DISCOUNT":
        return "Discount %";
      default:
        return type;
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
              <h1 className="text-2xl font-bold text-gray-900">Pricing Rules</h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage markup, discount, and pricing rules
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              + New Rule
            </button>
          </div>
        </div>
      </div>

      {/* Rules List */}
      <div className="mx-auto px-6 py-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Scope
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Product/Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Rule Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Rounding
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No pricing rules found. Create your first rule to get started.
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                        {rule.scope}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {rule.product ? (
                        <div>
                          <div className="font-medium">{rule.product.name}</div>
                          <div className="text-gray-500">{rule.product.sku}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getRuleTypeLabel(rule.ruleType)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                      {rule.ruleType === "FIXED_PRICE"
                        ? `$${Number(rule.value).toFixed(2)}`
                        : `${Number(rule.value).toFixed(2)}%`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {rule.roundingMode.replace(/_/g, " ")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {rule.priority}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleActive(rule)}
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          rule.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {rule.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => handleEdit(rule)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingRule ? "Edit Pricing Rule" : "New Pricing Rule"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Scope
                  </label>
                  <select
                    value={formData.scope}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        scope: e.target.value as any,
                        scopeId: "",
                      })
                    }
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="GLOBAL">Global</option>
                    <option value="CATEGORY">Category</option>
                    <option value="PRODUCT">Product</option>
                  </select>
                </div>

                {formData.scope === "PRODUCT" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product
                    </label>
                    <select
                      value={formData.scopeId}
                      onChange={(e) =>
                        setFormData({ ...formData, scopeId: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select product...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rule Type
                  </label>
                  <select
                    value={formData.ruleType}
                    onChange={(e) =>
                      setFormData({ ...formData, ruleType: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="MARKUP_PERCENT">Markup %</option>
                    <option value="FIXED_PRICE">Fixed Price</option>
                    <option value="DISCOUNT">Discount %</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.value}
                    onChange={(e) =>
                      setFormData({ ...formData, value: parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rounding Mode
                  </label>
                  <select
                    value={formData.roundingMode}
                    onChange={(e) =>
                      setFormData({ ...formData, roundingMode: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="NEAREST_99">Nearest .99</option>
                    <option value="NEAREST_95">Nearest .95</option>
                    <option value="NEAREST_50">Nearest .50</option>
                    <option value="ROUND_UP">Round Up</option>
                    <option value="ROUND_DOWN">Round Down</option>
                    <option value="NONE">No Rounding</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority (higher = first)
                  </label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date (optional)
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date (optional)
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {editingRule ? "Update Rule" : "Create Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}