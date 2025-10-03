import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import type { Product, ProductStatus, ActiveIngredient } from "shared-types";
import { AutocompleteInput } from "@/components/common/AutocompleteInput";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/products")({
  component: ProductsScreen,
});

type View = "list" | "create" | "edit";

interface TaxClass {
  id: string;
  name: string;
  rate: number;
}

function ProductsScreen() {
  const { user } = useAuth();
  const [view, setView] = useState<View>("list");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (user) {
      loadProducts();
    }
  }, [user]);

  // Handle ?edit=productId query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");

    if (editId && products.length > 0) {
      const product = products.find((p) => p.id === editId);
      if (product) {
        setSelectedProduct(product);
        setView("edit");
        // Clear the query parameter
        window.history.replaceState({}, "", "/products");
      }
    }
  }, [products]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get("/products?limit=1000");
      setProducts(data.products || []);
    } catch (error: any) {
      console.error("Failed to load products:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setView("edit");
  };

  const handleBack = () => {
    setView("list");
    setSelectedProduct(null);
    loadProducts();
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
        <p>Loading products...</p>
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
              <h1 className="text-2xl font-bold text-gray-900">Products</h1>
            </div>
            <div className="flex items-center space-x-4">
              {view === "list" && (
                <button
                  onClick={() => setView("create")}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                >
                  + Add Product
                </button>
              )}
              {view !== "list" && (
                <button
                  onClick={handleBack}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  ← Back to List
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {view === "list" && (
          <ProductList
            products={products}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onEdit={handleEdit}
          />
        )}
        {view === "create" && <ProductForm onBack={handleBack} />}
        {view === "edit" && selectedProduct && (
          <ProductForm product={selectedProduct} onBack={handleBack} />
        )}
      </div>
    </div>
  );
}

function ProductList({
  products,
  searchQuery,
  onSearchChange,
  onEdit,
}: {
  products: Product[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onEdit: (product: Product) => void;
}) {
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800",
    DISCONTINUED: "bg-gray-100 text-gray-800",
    OUT_OF_STOCK: "bg-red-100 text-red-800",
  };

  return (
    <div>
      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name, SKU, or barcode..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
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
                Barcode
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Unit
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  {searchQuery
                    ? "No products found matching your search."
                    : "No products found. Click 'Add Product' to create one."}
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{product.name}</div>
                    {product.description && (
                      <div className="text-sm text-gray-500">{product.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-900">{product.sku}</td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-600">
                    {product.barcode || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {product.defaultRetailPrice
                      ? `$${Number(product.defaultRetailPrice).toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {product.unit} {product.packSize > 1 && `(${product.packSize})`}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${statusColors[product.status]}`}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => onEdit(product)}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        Showing {filteredProducts.length} of {products.length} products
      </div>
    </div>
  );
}

function ProductForm({ product, onBack }: { product?: Product; onBack: () => void }) {
  const [formData, setFormData] = useState({
    name: product?.name || "",
    sku: product?.sku || "",
    barcode: product?.barcode || "",
    description: product?.description || "",
    activeIngredientId: product?.activeIngredientId || "",
    dosage: product?.dosage || "",
    unit: product?.unit || "unit",
    packSize: product?.packSize || 1,
    taxClassId: product?.taxClassId || "",
    defaultRetailPrice: product?.defaultRetailPrice || 0,
    status: product?.status || "ACTIVE",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeIngredients, setActiveIngredients] = useState<ActiveIngredient[]>([]);
  const [ingredientSearch, setIngredientSearch] = useState(product?.activeIngredient?.name || "");
  const [isLoadingIngredients, setIsLoadingIngredients] = useState(false);
  const [taxClasses, setTaxClasses] = useState<TaxClass[]>([]);

  // Load tax classes
  useEffect(() => {
    const loadTaxClasses = async () => {
      try {
        const data = await apiClient.get("/tax-classes");
        setTaxClasses(data.taxClasses || []);
      } catch (error) {
        console.error("Failed to load tax classes:", error);
      }
    };
    loadTaxClasses();
  }, []);

  // Calculate base price from final price (reverse calculation)
  const selectedTaxClass = taxClasses.find((tc) => tc.id === formData.taxClassId);
  const taxRate = selectedTaxClass?.rate || 0;
  // If user enters final price, we store it as-is. The base price is calculated for display only.
  const basePrice = taxRate > 0 ? formData.defaultRetailPrice / (1 + taxRate) : formData.defaultRetailPrice;

  // Generate SKU from name and dosage
  const generateSKU = () => {
    const namePart = formData.name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .substring(0, 6);

    const dosagePart = formData.dosage
      ? formData.dosage.toUpperCase().replace(/[^A-Z0-9]/g, "")
      : "";

    const sku = dosagePart ? `${namePart}-${dosagePart}` : namePart;
    setFormData({ ...formData, sku });
  };

  // Auto-generate SKU when creating new product (only if SKU is empty)
  useEffect(() => {
    if (!product && !formData.sku && formData.name) {
      generateSKU();
    }
  }, [formData.name, formData.dosage]);

  // Fetch active ingredients when user types
  useEffect(() => {
    const searchIngredients = async () => {
      if (ingredientSearch.length > 0) {
        setIsLoadingIngredients(true);
        try {
          const data = await apiClient.get(`/active-ingredients?search=${ingredientSearch}`);
          setActiveIngredients(data.ingredients || []);
        } catch (error) {
          console.error("Failed to search ingredients:", error);
        } finally {
          setIsLoadingIngredients(false);
        }
      } else {
        setActiveIngredients([]);
      }
    };

    const timer = setTimeout(searchIngredients, 300);
    return () => clearTimeout(timer);
  }, [ingredientSearch]);

  const handleIngredientSelect = async (option: { id: string; label: string } | null) => {
    if (option) {
      // Selected existing ingredient
      setIngredientSearch(option.label);
      setFormData({ ...formData, activeIngredientId: option.id });
    } else {
      // Create new ingredient
      if (ingredientSearch.trim()) {
        try {
          const data = await apiClient.post("/active-ingredients/find-or-create", {
            name: ingredientSearch.trim(),
          });
          setFormData({ ...formData, activeIngredientId: data.ingredient.id });
        } catch (error) {
          console.error("Failed to create ingredient:", error);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.sku) {
      alert("Name and SKU are required");
      return;
    }

    setIsSubmitting(true);
    try {
      if (product) {
        // Update existing product
        await apiClient.updateProduct(product.id, formData);
        alert("Product updated successfully!");
      } else {
        // Create new product
        await apiClient.createProduct(formData);
        alert("Product created successfully!");
      }
      onBack();
    } catch (error: any) {
      console.error("Failed to save product:", error);
      alert(error.message || "Failed to save product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-6">
        {product ? "Edit Product" : "Create New Product"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Product Name */}
          <div>
            <Label htmlFor="name">
              Product Name <span className="text-red-600">*</span>
            </Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              required
            />
          </div>

          {/* SKU */}
          <div>
            <Label htmlFor="sku">
              SKU <span className="text-red-600">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="sku"
                type="text"
                value={formData.sku}
                onChange={(e) => handleChange("sku", e.target.value)}
                className="font-mono"
                required
                disabled={!!product}
              />
              {!product && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateSKU}
                  title="Generate SKU from name and dosage"
                >
                  🔄 Auto
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {product ? "SKU cannot be changed after creation" : "Auto-generated from name + dosage"}
            </p>
          </div>

          {/* Barcode */}
          <div>
            <Label htmlFor="barcode">Barcode</Label>
            <Input
              id="barcode"
              type="text"
              value={formData.barcode}
              onChange={(e) => handleChange("barcode", e.target.value)}
              className="font-mono"
            />
          </div>

          {/* Active Ingredient - Autocomplete */}
          <div>
            <Label>Active Ingredient</Label>
            <AutocompleteInput
              value={ingredientSearch}
              onChange={setIngredientSearch}
              onSelect={handleIngredientSelect}
              options={activeIngredients.map((ing) => ({ id: ing.id, label: ing.name }))}
              placeholder="e.g., Acetylsalicylic Acid"
              loading={isLoadingIngredients}
              allowCreate={true}
              createLabel="Create new ingredient"
            />
          </div>

          {/* Dosage */}
          <div>
            <Label htmlFor="dosage">Dosage</Label>
            <Input
              id="dosage"
              type="text"
              value={formData.dosage}
              onChange={(e) => handleChange("dosage", e.target.value)}
              placeholder="e.g., 500mg, 100mg/5ml"
            />
            <p className="text-xs text-muted-foreground mt-1">Strength per unit</p>
          </div>

          {/* Unit */}
          <div>
            <Label htmlFor="unit">Unit</Label>
            <Select value={formData.unit} onValueChange={(value) => handleChange("unit", value)}>
              <SelectTrigger id="unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unit">Unit</SelectItem>
                <SelectItem value="box">Box</SelectItem>
                <SelectItem value="bottle">Bottle</SelectItem>
                <SelectItem value="tablet">Tablet</SelectItem>
                <SelectItem value="capsule">Capsule</SelectItem>
                <SelectItem value="ml">ML</SelectItem>
                <SelectItem value="mg">MG</SelectItem>
                <SelectItem value="pack">Pack</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pack Size */}
          <div>
            <Label htmlFor="packSize">Pack Size</Label>
            <Input
              id="packSize"
              type="number"
              value={formData.packSize}
              onChange={(e) => handleChange("packSize", Number(e.target.value))}
              min="1"
            />
            <p className="text-xs text-muted-foreground mt-1">Number of units per pack</p>
          </div>

          {/* Status */}
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => handleChange("status", value)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="DISCONTINUED">Discontinued</SelectItem>
                <SelectItem value="OUT_OF_STOCK">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Pricing Section */}
        <Separator />
        <div>
          <h3 className="text-lg font-semibold mb-4">Pricing & Tax</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Final Retail Price */}
            <div>
              <Label htmlFor="defaultRetailPrice">Final Retail Price (with tax included)</Label>
              <Input
                id="defaultRetailPrice"
                type="number"
                step="0.01"
                min="0"
                value={formData.defaultRetailPrice}
                onChange={(e) => handleChange("defaultRetailPrice", parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formData.defaultRetailPrice > 0 && selectedTaxClass
                  ? `Base price: $${basePrice.toFixed(2)} + Tax (${(taxRate * 100).toFixed(0)}%): $${(formData.defaultRetailPrice - basePrice).toFixed(2)}`
                  : "Enter the final selling price (tax included)"}
              </p>
            </div>

            {/* Tax Class */}
            <div>
              <Label htmlFor="taxClass">Tax Class</Label>
              <Select
                value={formData.taxClassId || "none"}
                onValueChange={(value) => handleChange("taxClassId", value === "none" ? "" : value)}
              >
                <SelectTrigger id="taxClass">
                  <SelectValue placeholder="Select tax class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Tax (0%)</SelectItem>
                  {taxClasses.map((tc) => (
                    <SelectItem key={tc.id} value={tc.id}>
                      {tc.name} ({(tc.rate * 100).toFixed(0)}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedTaxClass
                  ? `Tax rate: ${(taxRate * 100).toFixed(2)}%`
                  : "No tax applied"}
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleChange("description", e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : product ? "Update Product" : "Create Product"}
          </Button>
        </div>
      </form>
    </div>
  );
}
