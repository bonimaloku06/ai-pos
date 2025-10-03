import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, ShoppingCart, Calculator, Search } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/grn")({
  component: GRNScreen,
});

interface PurchaseLine {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  taxClassId?: string;
  taxRate: number;
  batchNumber: string;
  expiryDate: string;
  qty: number;
  unitCost: number;
  totalCost: number;
  discount: number;
  margin: number;
  finalRetailPrice: number;
  lineTotal: number;
}

function GRNScreen() {
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"create" | "history">("create");
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [grnHistory, setGrnHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [editingGRN, setEditingGRN] = useState<string | null>(null);

  // Product search per line
  const [lineSearchQueries, setLineSearchQueries] = useState<Record<string, string>>({});
  const [lineSearchResults, setLineSearchResults] = useState<Record<string, any[]>>({});
  const [searchingLines, setSearchingLines] = useState<Record<string, boolean>>({});
  const [showSuggestionsFor, setShowSuggestionsFor] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<Record<string, number>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const qtyRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!authLoading && user) {
      loadSuppliers();
    }
  }, [authLoading, user]);

  // Initialize with one empty row
  useEffect(() => {
    if (!authLoading && user && lines.length === 0) {
      addEmptyLine();
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (!authLoading && user && activeTab === "history") {
      loadGRNHistory();
    }
  }, [activeTab, authLoading, user]);

  // Search products for a specific line
  useEffect(() => {
    const searchForLines = async () => {
      for (const [lineId, query] of Object.entries(lineSearchQueries)) {
        if (query.length > 1) {
          setSearchingLines((prev) => ({ ...prev, [lineId]: true }));
          try {
            const data = await apiClient.getProducts({ query, limit: 10 });
            setLineSearchResults((prev) => ({ ...prev, [lineId]: data.products || [] }));
          } catch (error) {
            console.error("Failed to search products:", error);
          } finally {
            setSearchingLines((prev) => ({ ...prev, [lineId]: false }));
          }
        } else {
          setLineSearchResults((prev) => ({ ...prev, [lineId]: [] }));
        }
      }
    };

    const timer = setTimeout(searchForLines, 300);
    return () => clearTimeout(timer);
  }, [lineSearchQueries]);

  const loadSuppliers = async () => {
    try {
      const data = await apiClient.getSuppliers({ isActive: true });
      setSuppliers(data.suppliers || []);
    } catch (error) {
      console.error("Failed to load suppliers:", error);
    }
  };

  const loadGRNHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await apiClient.getGRNHistory({ limit: 50 });
      setGrnHistory(data.grns || []);
    } catch (error) {
      console.error("Failed to load GRN history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadGRNForEdit = (grn: any) => {
    // Switch to create tab
    setActiveTab("create");

    // Set editing mode
    setEditingGRN(grn.grnNumber);

    // Load GRN data into form
    setSelectedSupplier(grn.supplier?.id || "");
    setPurchaseDate(grn.date ? new Date(grn.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
    setNotes(grn.notes || "");

    // Load lines
    const loadedLines = grn.lines.map((line: any, index: number) => ({
      id: `edit-${Date.now()}-${index}`,
      productId: line.product?.id || "",
      productName: line.product?.name || "",
      productSku: line.product?.sku || "",
      taxClassId: line.product?.taxClassId || "",
      taxRate: line.product?.taxClass?.rate || 0,
      batchNumber: line.batch?.batchNumber || "",
      expiryDate: line.batch?.expiryDate ? new Date(line.batch.expiryDate).toISOString().split("T")[0] : "",
      qty: line.qty,
      unitCost: Number(line.unitCost) || 0,
      totalCost: (Number(line.unitCost) || 0) * line.qty,
      discount: 0,
      margin: line.margin || 30,
      finalRetailPrice: 0,
      lineTotal: 0,
    }));

    setLines(loadedLines);
  };

  const addEmptyLine = () => {
    const newLine: PurchaseLine = {
      id: `new-${Date.now()}`,
      productId: "",
      productName: "",
      productSku: "",
      taxClassId: "",
      taxRate: 0,
      batchNumber: "",
      expiryDate: "",
      qty: 1,
      unitCost: 0,
      totalCost: 0,
      discount: 0,
      margin: 30,
      finalRetailPrice: 0,
      lineTotal: 0,
    };
    setLines([...lines, newLine]);
    return newLine.id;
  };

  const handleKeyDown = (e: React.KeyboardEvent, lineId: string, fieldIndex: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const newLineId = addEmptyLine();
      // Focus on the product search input of the new row after a short delay
      setTimeout(() => {
        inputRefs.current[newLineId]?.focus();
      }, 50);
    }
  };

  const handleLineSearchChange = (lineId: string, query: string) => {
    setLineSearchQueries({ ...lineSearchQueries, [lineId]: query });
    setShowSuggestionsFor(lineId);
    setSelectedSuggestionIndex({ ...selectedSuggestionIndex, [lineId]: -1 });

    // Update dropdown position
    const inputEl = inputRefs.current[lineId];
    if (inputEl) {
      const rect = inputEl.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
  };

  const handleProductSearchKeyDown = (e: React.KeyboardEvent, lineId: string) => {
    const results = lineSearchResults[lineId] || [];
    const currentIndex = selectedSuggestionIndex[lineId] ?? -1;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length > 0) {
        const newIndex = currentIndex < results.length - 1 ? currentIndex + 1 : 0;
        setSelectedSuggestionIndex({ ...selectedSuggestionIndex, [lineId]: newIndex });
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length > 0) {
        const newIndex = currentIndex > 0 ? currentIndex - 1 : results.length - 1;
        setSelectedSuggestionIndex({ ...selectedSuggestionIndex, [lineId]: newIndex });
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (currentIndex >= 0 && results[currentIndex]) {
        selectProductForLine(lineId, results[currentIndex]);
        // Focus on qty field after selecting
        setTimeout(() => {
          qtyRefs.current[lineId]?.focus();
        }, 50);
      }
    } else if (e.key === "Tab") {
      // Allow default tab behavior to move to next field
      setShowSuggestionsFor(null);
      setDropdownPosition(null);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowSuggestionsFor(null);
      setDropdownPosition(null);
    }
  };

  const selectProductForLine = async (lineId: string, product: any) => {
    // Try to fetch last purchase data for this product from the selected supplier
    let lastPurchaseData = null;
    if (selectedSupplier) {
      try {
        const response = await apiClient.getGRNHistory({
          supplierId: selectedSupplier,
          productId: product.id,
          limit: 1
        });
        if (response.grns && response.grns.length > 0 && response.grns[0].lines) {
          const lastLine = response.grns[0].lines.find((l: any) => l.productId === product.id);
          if (lastLine) {
            console.log("Last purchase data:", lastLine);
            lastPurchaseData = {
              unitCost: Number(lastLine.unitCost) || 0,
              margin: lastLine.margin !== undefined ? lastLine.margin : 30,
            };
          }
        }
      } catch (error) {
        console.error("Failed to fetch last purchase data:", error);
      }
    }

    setLines(
      lines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              productId: product.id,
              productName: product.name,
              productSku: product.sku,
              taxClassId: product.taxClassId,
              taxRate: product.taxClass?.rate || 0,
              unitCost: lastPurchaseData?.unitCost || 0,
              margin: lastPurchaseData?.margin !== undefined ? lastPurchaseData.margin : 30,
            }
          : line
      )
    );
    // Clear search
    setLineSearchQueries({ ...lineSearchQueries, [lineId]: "" });
    setLineSearchResults({ ...lineSearchResults, [lineId]: [] });
    setShowSuggestionsFor(null);
    setDropdownPosition(null);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showSuggestionsFor) {
        setShowSuggestionsFor(null);
        setDropdownPosition(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSuggestionsFor]);

  const updateLine = (lineId: string, updates: Partial<PurchaseLine>) => {
    setLines(
      lines.map((line) => {
        if (line.id !== lineId) return line;

        const updatedLine = { ...line, ...updates };

        // If totalCost changed, calculate unitCost
        if (updates.totalCost !== undefined && updatedLine.qty > 0) {
          updatedLine.unitCost = updatedLine.totalCost / updatedLine.qty;
        }
        // If unitCost changed, calculate totalCost
        else if (updates.unitCost !== undefined) {
          updatedLine.totalCost = updatedLine.unitCost * updatedLine.qty;
        }
        // If qty changed, recalculate totalCost based on unitCost
        else if (updates.qty !== undefined) {
          updatedLine.totalCost = updatedLine.unitCost * updatedLine.qty;
        }

        const costAfterDiscount = updatedLine.unitCost * (1 - updatedLine.discount / 100);
        updatedLine.finalRetailPrice = costAfterDiscount * (1 + updatedLine.margin / 100);
        updatedLine.lineTotal = updatedLine.qty * costAfterDiscount;

        return updatedLine;
      })
    );
  };

  const removeLine = (lineId: string) => {
    setLines((prevLines) => {
      const updatedLines = prevLines.filter((line) => line.id !== lineId);
      // Always add a blank row after deletion
      const newLine: PurchaseLine = {
        id: `new-${Date.now()}`,
        productId: "",
        productName: "",
        productSku: "",
        taxClassId: "",
        taxRate: 0,
        batchNumber: "",
        expiryDate: "",
        qty: 1,
        unitCost: 0,
        totalCost: 0,
        discount: 0,
        margin: 30,
        finalRetailPrice: 0,
        lineTotal: 0,
      };
      return [...updatedLines, newLine];
    });
  };

  const calculateTotals = () => {
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const totalItems = lines.reduce((sum, line) => sum + line.qty, 0);
    return { subtotal, totalItems };
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

    const invalidLines = lines.filter(
      (line) => !line.productId || line.unitCost <= 0
    );
    if (invalidLines.length > 0) {
      alert(
        "Please select product and fill in unit cost for all rows"
      );
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingGRN) {
        // Update existing GRN
        const updateData = {
          notes,
          lines: lines.map((line) => ({
            productId: line.productId,
            batchNumber: line.batchNumber || undefined,
            expiryDate: line.expiryDate || undefined,
            qty: line.qty,
            unitCost: line.unitCost * (1 - line.discount / 100),
            margin: line.margin,
          })),
        };

        await apiClient.updateGRN(editingGRN, updateData);

        for (const line of lines) {
          await apiClient.updateProduct(line.productId, {
            defaultRetailPrice: line.finalRetailPrice,
            taxClassId: line.taxClassId || null,
          });
        }
      } else {
        // Create new GRN
        const grnData = {
          storeId: user?.storeId || "default-store",
          supplierId: selectedSupplier,
          receivedAt: purchaseDate,
          notes,
          lines: lines.map((line) => ({
            productId: line.productId,
            batchNumber: line.batchNumber || undefined,
            expiryDate: line.expiryDate || undefined,
            qty: line.qty,
            unitCost: line.unitCost * (1 - line.discount / 100),
            margin: line.margin,
          })),
        };

        await apiClient.createGRN(grnData);

        for (const line of lines) {
          await apiClient.updateProduct(line.productId, {
            defaultRetailPrice: line.finalRetailPrice,
            taxClassId: line.taxClassId || null,
          });
        }
      }

      alert(editingGRN ? "Purchase updated successfully! Stock and prices updated." : "Purchase completed successfully! Stock updated and prices saved.");

      setLines([]);
      setSelectedSupplier("");
      setNotes("");
      setPurchaseDate(new Date().toISOString().split("T")[0]);
      setEditingGRN(null);

      // Reload history if on history tab
      if (activeTab === "history") {
        loadGRNHistory();
      }
    } catch (error: any) {
      console.error("Failed to submit purchase:", error);
      alert(error.message || "Failed to complete purchase");
    } finally {
      setIsSubmitting(false);
    }
  };

  const { subtotal, totalItems } = calculateTotals();

  if (authLoading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (user.role === "CASHIER") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="h-8 w-8" />
            Purchase & Receive Stock
          </h1>
          <p className="text-gray-600 mt-1">
            Buy products from suppliers, set margins, and update prices
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
          <TabsList>
            <TabsTrigger value="create">New Purchase</TabsTrigger>
            <TabsTrigger value="history">Purchase History</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Purchase Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="supplier">Supplier *</Label>
                    <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                      <SelectTrigger id="supplier">
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="purchaseDate">Purchase Date *</Label>
                    <Input
                      id="purchaseDate"
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Input
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes about this purchase..."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Products ({lines.length} items)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Product</TableHead>
                        <TableHead className="text-center w-[100px]">Qty</TableHead>
                        <TableHead className="text-right w-[110px]">Unit Cost</TableHead>
                        <TableHead className="text-right w-[110px]">Total Cost</TableHead>
                        <TableHead className="text-center w-[80px]">Disc%</TableHead>
                        <TableHead className="text-center w-[90px]">Margin%</TableHead>
                        <TableHead className="text-right w-[110px]">Final Price</TableHead>
                        <TableHead className="text-right w-[110px]">Total</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell style={{ overflow: "visible", position: "relative" }}>
                              {line.productId ? (
                                <div>
                                  <div className="font-medium">{line.productName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {line.productSku}
                                  </div>
                                </div>
                              ) : (
                                <div style={{ position: "relative" }}>
                                  <Input
                                    ref={(el) => (inputRefs.current[line.id] = el)}
                                    placeholder="Search product..."
                                    value={lineSearchQueries[line.id] || ""}
                                    onChange={(e) =>
                                      handleLineSearchChange(line.id, e.target.value)
                                    }
                                    onKeyDown={(e) => handleProductSearchKeyDown(e, line.id)}
                                    onFocus={() => {
                                      setShowSuggestionsFor(line.id);
                                      const rect = inputRefs.current[line.id]?.getBoundingClientRect();
                                      if (rect) {
                                        setDropdownPosition({
                                          top: rect.bottom + window.scrollY + 4,
                                          left: rect.left + window.scrollX,
                                        });
                                      }
                                    }}
                                    className="w-full"
                                  />
                                  {showSuggestionsFor === line.id &&
                                    lineSearchResults[line.id]?.length > 0 &&
                                    dropdownPosition && (
                                      <div
                                        className="fixed bg-card border rounded-md shadow-xl max-h-60 overflow-y-auto w-[400px]"
                                        style={{
                                          zIndex: 9999,
                                          top: `${dropdownPosition.top}px`,
                                          left: `${dropdownPosition.left}px`,
                                        }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                      >
                                        {lineSearchResults[line.id].map((product: any, index: number) => (
                                          <div
                                            key={product.id}
                                            onClick={() => selectProductForLine(line.id, product)}
                                            className={`px-4 py-3 hover:bg-accent cursor-pointer border-b last:border-b-0 transition-colors ${
                                              index === (selectedSuggestionIndex[line.id] ?? -1) ? "bg-accent" : ""
                                            }`}
                                          >
                                            <div className="font-medium text-sm">
                                              {product.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                              {product.sku}
                                              {product.activeIngredient &&
                                                ` • ${product.activeIngredient.name}`}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  {searchingLines[line.id] && dropdownPosition && (
                                    <div
                                      className="fixed bg-yellow-200 border rounded-md shadow-lg p-2 text-center text-sm"
                                      style={{ zIndex: 9999, top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px` }}
                                    >
                                      Searching...
                                    </div>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Input
                                ref={(el) => (qtyRefs.current[line.id] = el)}
                                type="number"
                                min="1"
                                value={line.qty === 0 ? "" : line.qty}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateLine(line.id, { qty: val === "" ? 0 : parseInt(val) });
                                }}
                                className="w-20 text-center"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={line.unitCost === 0 ? "" : line.unitCost}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateLine(line.id, { unitCost: val === "" ? 0 : parseFloat(val) });
                                }}
                                className="text-right"
                                placeholder="0.00"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={line.totalCost === 0 ? "" : line.totalCost}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateLine(line.id, { totalCost: val === "" ? 0 : parseFloat(val) });
                                }}
                                className="text-right"
                                placeholder="0.00"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={line.discount === 0 ? "" : line.discount}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateLine(line.id, { discount: val === "" ? 0 : parseFloat(val) });
                                }}
                                className="w-16 text-center"
                                placeholder="0"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max="500"
                                value={line.margin === 0 ? "" : line.margin}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateLine(line.id, { margin: val === "" ? 0 : parseFloat(val) });
                                }}
                                onKeyDown={(e) => handleKeyDown(e, line.id, 6)}
                                className="w-16 text-center"
                                placeholder="30"
                              />
                            </TableCell>
                            <TableCell className="text-right font-semibold text-blue-600">
                              ${line.finalRetailPrice.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              ${line.lineTotal.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeLine(line.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {lines.length > 0 && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Calculator className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-lg">Purchase Summary</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Items:</span>
                      <span className="font-medium">{totalItems}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Cost:</span>
                      <span className="font-medium">${subtotal.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold pt-2">
                      <span>Amount to Pay:</span>
                      <span className="text-blue-600">${subtotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !selectedSupplier || lines.length === 0}
                    className="w-full mt-6"
                    size="lg"
                  >
                    {isSubmitting ? "Processing..." : editingGRN ? "Update Purchase & Prices" : "Complete Purchase & Update Prices"}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    {editingGRN ? "This will update stock and product retail prices" : "This will add stock to inventory and update product retail prices"}
                  </p>
                  {editingGRN && (
                    <p className="text-xs text-center text-blue-600 font-medium mt-1">
                      Editing GRN: {editingGRN}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Purchase History</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingHistory ? (
                  <div className="text-center py-8">Loading history...</div>
                ) : grnHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No purchase history found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>GRN #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead className="text-right">Total Cost</TableHead>
                        <TableHead>Received By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grnHistory.map((grn) => (
                        <TableRow
                          key={grn.grnNumber}
                          onClick={() => loadGRNForEdit(grn)}
                          className="cursor-pointer hover:bg-accent"
                        >
                          <TableCell className="font-medium">{grn.grnNumber}</TableCell>
                          <TableCell>{grn.date ? new Date(grn.date).toLocaleDateString() : "—"}</TableCell>
                          <TableCell>{grn.supplier?.name || "—"}</TableCell>
                          <TableCell className="text-right">
                            ${grn.totalValue?.toFixed(2) || "0.00"}
                          </TableCell>
                          <TableCell>{grn.user?.email || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
