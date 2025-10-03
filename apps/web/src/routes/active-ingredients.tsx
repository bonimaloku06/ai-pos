import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/active-ingredients")({
  component: ActiveIngredientsScreen,
});

interface ActiveIngredient {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    products: number;
  };
  products?: Array<{
    id: string;
    name: string;
    sku: string;
    dosage: string | null;
  }>;
}

function ActiveIngredientsScreen() {
  const { user } = useAuth();
  const [ingredients, setIngredients] = useState<ActiveIngredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIngredientId, setExpandedIngredientId] = useState<string | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (user) {
      loadIngredients();
    }
  }, [user]);

  const toggleExpand = async (ingredientId: string) => {
    if (expandedIngredientId === ingredientId) {
      setExpandedIngredientId(null);
      return;
    }

    setExpandedIngredientId(ingredientId);

    // Load products for this ingredient if not already loaded
    const ingredient = ingredients.find((ing) => ing.id === ingredientId);
    if (ingredient && !ingredient.products) {
      setLoadingProducts(true);
      try {
        const data = await apiClient.get(`/active-ingredients/${ingredientId}`);
        setIngredients(
          ingredients.map((ing) =>
            ing.id === ingredientId ? { ...ing, products: data.ingredient.products } : ing
          )
        );
      } catch (error) {
        console.error("Failed to load products:", error);
      } finally {
        setLoadingProducts(false);
      }
    }
  };

  const loadIngredients = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get("/active-ingredients");
      setIngredients(data.ingredients || []);
    } catch (error: any) {
      console.error("Failed to load active ingredients:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (ingredient: ActiveIngredient) => {
    const productCount = ingredient._count?.products || 0;

    if (productCount > 0) {
      alert(
        `Cannot delete "${ingredient.name}" because it is used by ${productCount} product(s). Remove it from all products first.`
      );
      return;
    }

    if (!confirm(`Are you sure you want to delete "${ingredient.name}"?`)) {
      return;
    }

    try {
      await apiClient.delete(`/active-ingredients/${ingredient.id}`);
      alert("Active ingredient deleted successfully!");
      loadIngredients();
    } catch (error: any) {
      console.error("Failed to delete ingredient:", error);
      alert(error.message || "Failed to delete active ingredient");
    }
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p>Loading active ingredients...</p>
      </div>
    );
  }

  const filteredIngredients = ingredients.filter((ing) =>
    ing.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Active Ingredients</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search active ingredients..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Products Using
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
              {filteredIngredients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    {searchQuery
                      ? "No active ingredients found matching your search."
                      : "No active ingredients found."}
                  </td>
                </tr>
              ) : (
                filteredIngredients.map((ingredient) => {
                  const productCount = ingredient._count?.products || 0;
                  const canDelete = productCount === 0;
                  const isExpanded = expandedIngredientId === ingredient.id;

                  return (
                    <React.Fragment key={ingredient.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{ingredient.name}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {productCount > 0 ? (
                            <button
                              onClick={() => toggleExpand(ingredient.id)}
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:bg-blue-200 transition-colors ${
                                isExpanded ? "bg-blue-200 text-blue-900" : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {isExpanded ? "▼" : "▶"} {productCount}{" "}
                              {productCount === 1 ? "product" : "products"}
                            </button>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {productCount} products
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-500">
                          {new Date(ingredient.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {canDelete ? (
                            <button
                              onClick={() => handleDelete(ingredient)}
                              className="text-red-600 hover:text-red-800 font-medium text-sm"
                            >
                              Delete
                            </button>
                          ) : (
                            <span
                              className="text-gray-400 text-sm"
                              title="Cannot delete - in use by products"
                            >
                              In Use
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Accordion Content */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 bg-gray-50">
                            {loadingProducts ? (
                              <div className="text-center text-gray-500">Loading products...</div>
                            ) : ingredient.products && ingredient.products.length > 0 ? (
                              <div>
                                <h4 className="text-sm font-medium text-gray-900 mb-3">
                                  Products using "{ingredient.name}":
                                </h4>
                                <div className="space-y-2">
                                  {ingredient.products.map((product) => (
                                    <a
                                      key={product.id}
                                      href={`/products?edit=${product.id}`}
                                      className="block px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <div className="font-medium text-gray-900">
                                            {product.name}
                                          </div>
                                          <div className="text-sm text-gray-500">
                                            SKU: {product.sku}
                                            {product.dosage && ` • ${product.dosage}`}
                                          </div>
                                        </div>
                                        <span className="text-blue-600 text-sm font-medium">
                                          Edit →
                                        </span>
                                      </div>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center text-gray-500">No products found</div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredIngredients.length} of {ingredients.length} active ingredients
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">ℹ️ How to manage active ingredients:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Active ingredients are automatically created when you add them to products</li>
            <li>• You can only delete ingredients that are not used by any products</li>
            <li>• To remove an ingredient, first remove it from all products that use it</li>
            <li>• Typos like "ac" can be safely deleted if no products use them</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
