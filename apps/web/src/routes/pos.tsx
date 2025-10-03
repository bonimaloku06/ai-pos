import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Package, Minus, Plus, Trash2, CreditCard, Banknote, Smartphone, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/pos")({
  component: POSScreen,
});

interface CartItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  lineTotal: number;
}

interface ProductSearchResult {
  id: string;
  name: string;
  sku: string;
  activeIngredient?: { name: string } | null;
  batches?: { qtyOnHand: number; unitCost: number }[];
  taxClass?: { rate: number } | null;
  defaultRetailPrice?: number | null;
}

function POSScreen() {
  const { user, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("CASH");
  const [amountPaid, setAmountPaid] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [cartDiscountType, setCartDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [cartDiscountValue, setCartDiscountValue] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Search products
  const handleSearch = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const data = await apiClient.getProducts({ query, limit: 10 });
      setSearchResults(data.products || []);
    } catch (error: any) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedResultIndex(0);
  }, [searchResults]);

  // Calculate total stock for a product
  const getTotalStock = (product: ProductSearchResult) => {
    return product.batches?.reduce((sum, batch) => sum + batch.qtyOnHand, 0) || 0;
  };

  // Get price - use defaultRetailPrice if available, otherwise fallback to batch cost + markup
  const getPrice = (product: ProductSearchResult) => {
    // Use the retail price if set
    if (product.defaultRetailPrice && product.defaultRetailPrice > 0) {
      return Number(product.defaultRetailPrice);
    }

    // Fallback to batch cost + markup if no retail price is set
    const firstBatch = product.batches?.[0];
    if (!firstBatch) return 0;
    return Number(firstBatch.unitCost) * 1.3; // 30% markup as fallback
  };

  // Add product to cart
  const addToCart = (product: ProductSearchResult) => {
    const taxRate = product.taxClass?.rate || 0;
    const unitPrice = getPrice(product); // This is already the final price with tax included
    const existingItem = cart.find(item => item.productId === product.id);

    if (existingItem) {
      // Increment quantity
      setCart(cart.map(item =>
        item.productId === product.id
          ? {
              ...item,
              qty: item.qty + 1,
              lineTotal: (item.qty + 1) * unitPrice * (1 - item.discount), // No tax addition - already included
            }
          : item
      ));
    } else {
      // Add new item
      const newItem: CartItem = {
        id: `${product.id}-${Date.now()}`,
        productId: product.id,
        name: product.name,
        sku: product.sku,
        qty: 1,
        unitPrice, // Final price with tax already included
        taxRate, // Store for reference/reporting, but don't add it again
        discount: 0,
        lineTotal: unitPrice, // 1 * unitPrice (no tax addition)
      };
      setCart([...cart, newItem]);
    }

    setSearchQuery("");
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  // Update cart item quantity
  const updateQuantity = (itemId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(itemId);
      return;
    }

    setCart(cart.map(item =>
      item.id === itemId
        ? {
            ...item,
            qty,
            lineTotal: qty * item.unitPrice * (1 - item.discount), // No tax addition - already included in unitPrice
          }
        : item
    ));
  };

  // Update item discount (percentage as decimal, e.g., 0.1 for 10%)
  const updateItemDiscount = (itemId: string, discountPercent: number) => {
    const discount = Math.min(Math.max(discountPercent / 100, 0), 1); // Convert to decimal and clamp 0-1
    setCart(cart.map(item =>
      item.id === itemId
        ? {
            ...item,
            discount,
            lineTotal: item.qty * item.unitPrice * (1 - discount),
          }
        : item
    ));
  };

  // Remove from cart
  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  // Calculate totals
  // Note: unitPrice already includes tax, so we need to calculate tax backwards for display
  const subtotalBeforeCartDiscount = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const itemDiscountTotal = cart.reduce((sum, item) => sum + (item.qty * item.unitPrice * item.discount), 0);

  // Apply cart-level discount
  const cartDiscount = cartDiscountType === "percentage"
    ? subtotalBeforeCartDiscount * (cartDiscountValue / 100)
    : cartDiscountValue;

  const total = Math.max(subtotalBeforeCartDiscount - cartDiscount, 0);

  // Calculate tax component from the final price (for reporting/display only)
  const taxTotal = cart.reduce((sum, item) => {
    const priceWithTax = item.unitPrice;
    const taxRate = item.taxRate;
    // Reverse calculate: if price = base * (1 + tax), then base = price / (1 + tax)
    const basePrice = taxRate > 0 ? priceWithTax / (1 + taxRate) : priceWithTax;
    const taxAmount = priceWithTax - basePrice;
    return sum + (item.qty * taxAmount * (1 - item.discount)); // Apply item discount to tax too
  }, 0);

  const subtotal = subtotalBeforeCartDiscount - itemDiscountTotal; // Before cart discount
  const paid = parseFloat(amountPaid) || total;
  const change = paid - total;

  // Process checkout
  const handleCheckout = async () => {
    if (cart.length === 0) return;

    setIsProcessing(true);
    try {
      const saleData = {
        storeId: user?.storeId || "default-store",
        lines: cart.map(item => ({
          productId: item.productId,
          qty: item.qty,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          discount: item.discount,
        })),
        paymentMethod: selectedPaymentMethod,
        paid,
      };

      const result = await apiClient.createSale(saleData);

      alert(`Sale completed! Change: $${change.toFixed(2)}`);

      // Reset cart
      setCart([]);
      setAmountPaid("");
      setCartDiscountValue(0);
      searchInputRef.current?.focus();
    } catch (error: any) {
      alert(`Checkout failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Clear cart
  const clearCart = () => {
    if (confirm("Clear entire cart?")) {
      setCart([]);
      setCartDiscountValue(0);
    }
  };

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
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="bg-card shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Point of Sale</h1>
            <p className="text-sm text-muted-foreground">Cashier: {user.email}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left side - Product Search & Cart */}
        <div className="flex-1 flex flex-col p-6 space-y-4 relative">
          {/* Search */}
          <div className="space-y-2 relative z-20">
            <label className="text-sm font-medium">
              Search Product
            </label>
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (!searchResults.length) return;

                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelectedResultIndex((prev) =>
                    prev < searchResults.length - 1 ? prev + 1 : prev
                  );
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelectedResultIndex((prev) => (prev > 0 ? prev - 1 : 0));
                } else if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  if (searchResults[selectedResultIndex]) {
                    addToCart(searchResults[selectedResultIndex]);
                  }
                } else if (e.key === "Escape") {
                  setSearchQuery("");
                  setSearchResults([]);
                }
              }}
              placeholder="Search by name, SKU, barcode, or active ingredient..."
              className="text-lg"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Type to search products
            </p>

            {/* Search Results Table - Dropdown Overlay */}
            {searchQuery && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card rounded-lg border shadow-lg overflow-hidden z-30 max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Active Ingredient</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((product, index) => {
                      const stock = getTotalStock(product);
                      const price = getPrice(product);
                      const isSelected = index === selectedResultIndex;

                      return (
                        <TableRow
                          key={product.id}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-primary/10 hover:bg-primary/15"
                              : "hover:bg-accent"
                          }`}
                          onClick={() => addToCart(product)}
                        >
                          <TableCell>
                            <div>
                              <div className={`font-medium ${isSelected ? "text-primary" : ""}`}>
                                {product.name}
                              </div>
                              <div className="text-sm text-muted-foreground">{product.sku}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {product.activeIngredient?.name || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={stock > 0 ? "text-foreground" : "text-destructive"}>
                              {stock}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${price.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {searchQuery && isSearching && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card rounded-lg border shadow-lg p-4 z-30">
                <div className="text-center text-muted-foreground">
                  Searching...
                </div>
              </div>
            )}

            {searchQuery && !isSearching && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card rounded-lg border shadow-lg p-4 z-30">
                <div className="text-center text-muted-foreground">
                  No products found
                </div>
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="flex-1 bg-card rounded-lg border shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-muted/50 border-b flex items-center justify-between">
              <h2 className="font-semibold text-lg">Cart ({cart.length} items)</h2>
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCart}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  Clear All
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center py-12">
                    <Package className="h-16 w-16 mx-auto mb-4 opacity-20" strokeWidth={1.5} />
                    <p className="text-lg font-medium">Cart is empty</p>
                    <p className="text-sm mt-1">Search for products to add</p>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/30 backdrop-blur-sm">
                    <TableRow>
                      <TableHead className="font-semibold">Product</TableHead>
                      <TableHead className="text-center font-semibold">Qty</TableHead>
                      <TableHead className="text-right font-semibold">Price</TableHead>
                      <TableHead className="text-center font-semibold">Disc%</TableHead>
                      <TableHead className="text-right font-semibold">Total</TableHead>
                      <TableHead className="text-center font-semibold w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map((item) => (
                      <TableRow key={item.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <div>
                            <div className="font-semibold">{item.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{item.sku}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(item.id, item.qty - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              value={item.qty}
                              onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0)}
                              className="w-14 h-8 text-center px-1"
                              min="1"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(item.id, item.qty + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          ${item.unitPrice.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={item.discount * 100}
                            onChange={(e) => updateItemDiscount(item.id, parseFloat(e.target.value) || 0)}
                            className="w-16 h-8 text-center px-1"
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          ${item.lineTotal.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>

        {/* Right side - Checkout */}
        <div className="w-96 bg-muted/30 border-l p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">Checkout</h2>
          </div>

          {/* Totals Card */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium tabular-nums">${subtotalBeforeCartDiscount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax (included)</span>
                <span className="font-medium tabular-nums">${taxTotal.toFixed(2)}</span>
              </div>
              {itemDiscountTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Item Discounts</span>
                  <span className="font-medium text-green-600 tabular-nums">-${itemDiscountTotal.toFixed(2)}</span>
                </div>
              )}
              {cartDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cart Discount</span>
                  <span className="font-medium text-green-600 tabular-nums">-${cartDiscount.toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-xl font-bold pt-1">
                <span>Total</span>
                <span className="tabular-nums">${total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Cart Discount */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Label>Cart Discount</Label>
              <div className="flex gap-2">
                <Select value={cartDiscountType} onValueChange={(v: any) => setCartDiscountType(v)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">%</SelectItem>
                    <SelectItem value="fixed">$</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step={cartDiscountType === "percentage" ? "1" : "0.01"}
                  max={cartDiscountType === "percentage" ? "100" : undefined}
                  value={cartDiscountValue}
                  onChange={(e) => setCartDiscountValue(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {cartDiscountType === "percentage"
                  ? "Enter discount percentage (e.g., 10 for 10%)"
                  : "Enter fixed discount amount"}
              </p>
            </CardContent>
          </Card>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label htmlFor="payment-method">Payment Method</Label>
            <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
              <SelectTrigger id="payment-method" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4" />
                    <span>Cash</span>
                  </div>
                </SelectItem>
                <SelectItem value="CARD">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    <span>Card</span>
                  </div>
                </SelectItem>
                <SelectItem value="MOBILE">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    <span>Mobile Payment</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount Paid */}
          <div className="space-y-2">
            <Label htmlFor="amount-paid">Amount Paid</Label>
            <Input
              id="amount-paid"
              type="number"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="0.00"
              step="0.01"
              className="h-11 text-lg tabular-nums"
            />
          </div>

          {/* Change */}
          {paid > 0 && (
            <Card className={change >= 0 ? "border-green-500 bg-green-50 dark:bg-green-950" : "border-destructive bg-destructive/10"}>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground mb-1">Change</div>
                <div className={`text-3xl font-bold tabular-nums ${change >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                  ${Math.abs(change).toFixed(2)}
                </div>
                {change < 0 && (
                  <p className="text-sm text-destructive mt-2">Insufficient payment</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="mt-auto space-y-2">
            <Button
              onClick={handleCheckout}
              disabled={cart.length === 0 || isProcessing || change < 0}
              className="w-full h-12 text-lg font-semibold"
              size="lg"
            >
              {isProcessing ? "Processing..." : `Complete Sale ($${total.toFixed(2)})`}
            </Button>

            <Button
              variant="outline"
              onClick={clearCart}
              disabled={cart.length === 0}
              className="w-full h-10"
            >
              Cancel Sale
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
