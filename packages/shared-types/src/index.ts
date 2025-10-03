// ===== User & Auth Types =====

export enum UserRole {
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  CASHIER = "CASHIER",
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  storeId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  role: UserRole;
  storeId?: string;
}

export interface UpdateUserRequest {
  email?: string;
  password?: string;
  role?: UserRole;
  storeId?: string;
  isActive?: boolean;
}

// ===== Product Types =====

export enum ProductStatus {
  ACTIVE = "ACTIVE",
  DISCONTINUED = "DISCONTINUED",
  OUT_OF_STOCK = "OUT_OF_STOCK",
}

export interface ActiveIngredient {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  description?: string | null;
  activeIngredientId?: string | null;
  activeIngredient?: ActiveIngredient;
  dosage?: string | null;
  unit: string;
  packSize: number;
  categoryId?: string | null;
  taxClassId?: string | null;
  defaultRetailPrice?: number | null;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
  batches?: Batch[];
  category?: Category;
  taxClass?: TaxClass;
}

export interface CreateProductRequest {
  name: string;
  sku: string;
  barcode?: string;
  description?: string;
  activeIngredientId?: string;
  dosage?: string;
  unit?: string;
  packSize?: number;
  categoryId?: string;
  taxClassId?: string;
  defaultRetailPrice?: number;
  status?: ProductStatus;
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {}

export interface CreateActiveIngredientRequest {
  name: string;
}

// ===== Category Types =====

export interface Category {
  id: string;
  name: string;
  parentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ===== Tax Types =====

export interface TaxClass {
  id: string;
  name: string;
  rate: number;
  createdAt: Date;
  updatedAt: Date;
}

// ===== Inventory Types =====

export interface Batch {
  id: string;
  productId: string;
  supplierId?: string | null;
  storeId: string;
  batchNumber?: string | null;
  expiryDate?: Date | null;
  unitCost: number;
  qtyOnHand: number;
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  product?: Product;
  supplier?: Supplier;
}

export enum StockMovementType {
  RECEIVE = "RECEIVE",
  SALE = "SALE",
  RETURN = "RETURN",
  ADJUSTMENT = "ADJUSTMENT",
  TRANSFER = "TRANSFER",
  WASTE = "WASTE",
}

// ===== Supplier Types =====

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  leadTimeDays: number;
  deliveryDays: string[];
  deliverySchedule?: any;
  moq?: number | null;
  currency: string;
  paymentTerms?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSupplierRequest {
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  leadTimeDays?: number;
  deliveryDays?: string[];
  moq?: number;
  currency?: string;
  paymentTerms?: string;
}

export interface UpdateSupplierRequest extends Partial<CreateSupplierRequest> {}

// ===== Purchase Order Types =====

export enum POStatus {
  DRAFT = "DRAFT",
  APPROVED = "APPROVED",
  SENT = "SENT",
  PARTIAL = "PARTIAL",
  RECEIVED = "RECEIVED",
  CANCELLED = "CANCELLED",
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  status: POStatus;
  totalCost: number;
  expectedAt?: Date | null;
  notes?: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  supplier?: Supplier;
  lines?: POLine[];
  creator?: User;
}

export interface POLine {
  id: string;
  poId: string;
  productId: string;
  qty: number;
  unitCost: number;
  notes?: string | null;
  createdAt: Date;
  product?: Product;
}

export interface CreatePORequest {
  supplierId: string;
  lines: Array<{
    productId: string;
    qty: number;
    unitCost: number;
    notes?: string;
  }>;
  expectedAt?: string;
  notes?: string;
}

// ===== Sales Types =====

export enum SaleStatus {
  COMPLETED = "COMPLETED",
  REFUNDED = "REFUNDED",
  VOIDED = "VOIDED",
}

export interface Sale {
  id: string;
  saleNumber: string;
  storeId: string;
  cashierId: string;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  paid: number;
  change: number;
  paymentMethod: string;
  status: SaleStatus;
  notes?: string | null;
  createdAt: Date;
  lines?: SaleLine[];
  cashier?: User;
}

export interface SaleLine {
  id: string;
  saleId: string;
  productId: string;
  batchId?: string | null;
  qty: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  lineTotal: number;
  createdAt: Date;
  product?: Product;
}

export interface CreateSaleRequest {
  storeId: string;
  lines: Array<{
    productId: string;
    batchId?: string;
    qty: number;
    unitPrice: number;
    taxRate: number;
    discount?: number;
  }>;
  paymentMethod: string;
  paid: number;
  notes?: string;
}

// ===== Reorder Suggestion Types =====

export enum UrgencyLevel {
  CRITICAL = "CRITICAL",
  WARNING = "WARNING",
  GOOD = "GOOD",
  OVERSTOCKED = "OVERSTOCKED",
}

export interface ReorderSuggestion {
  id: string;
  productId: string;
  storeId: string;
  supplierId?: string | null;
  suggestionDate: Date;
  rop: number;
  orderQty: number;
  reason: {
    currentStock: number;
    meanDemand: number;
    stdDevDemand: number;
    safetyStock: number;
    leadTimeDays: number;
    serviceLevel: number;
    shouldReorder: boolean;
    manualNote?: string;
    analysisNote?: string;
  };
  status: string;
  analysisPeriodDays: number;
  stockDuration?: number | null;
  urgencyLevel?: UrgencyLevel | null;
  nextDeliveryDate?: Date | null;
  scenarios?: Array<{
    label: string;
    orderQty: number;
    projectedStock: number;
    projectedDuration: number;
    coverageDays?: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
  product?: Product;
  supplier?: Supplier;
  store?: Store;
}

export interface GenerateReorderSuggestionsRequest {
  storeId: string;
  serviceLevel?: number;
}

export interface ApproveReorderSuggestionsRequest {
  suggestionIds: string[];
  generatePO?: boolean;
}

// ===== Store Types =====

export interface Store {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ===== Pricing Types =====

export enum PriceRuleScope {
  GLOBAL = "GLOBAL",
  CATEGORY = "CATEGORY",
  PRODUCT = "PRODUCT",
}

export enum PriceRuleType {
  MARKUP_PERCENT = "MARKUP_PERCENT",
  FIXED_PRICE = "FIXED_PRICE",
  DISCOUNT = "DISCOUNT",
}

export enum RoundingMode {
  NONE = "NONE",
  NEAREST_99 = "NEAREST_99",
  NEAREST_95 = "NEAREST_95",
  NEAREST_50 = "NEAREST_50",
  ROUND_UP = "ROUND_UP",
  ROUND_DOWN = "ROUND_DOWN",
}

export interface PriceRule {
  id: string;
  scope: PriceRuleScope;
  scopeId?: string | null;
  ruleType: PriceRuleType;
  value: number;
  roundingMode: RoundingMode;
  startDate?: Date | null;
  endDate?: Date | null;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  product?: Product;
}

export interface CreatePriceRuleRequest {
  scope: PriceRuleScope;
  scopeId?: string;
  ruleType: PriceRuleType;
  value: number;
  roundingMode?: RoundingMode;
  startDate?: string;
  endDate?: string;
  priority?: number;
}

export interface UpdatePriceRuleRequest extends Partial<CreatePriceRuleRequest> {
  isActive?: boolean;
}

// ===== GRN Types =====

export interface GoodsReceipt {
  id: string;
  grNumber: string;
  poId?: string | null;
  refNo?: string | null;
  receivedAt: Date;
  notes?: string | null;
  receivedBy: string;
  createdAt: Date;
  lines?: GRNLine[];
  receiver?: User;
}

export interface GRNLine {
  id: string;
  grId: string;
  productId: string;
  batchId: string;
  qty: number;
  unitCost: number;
  createdAt: Date;
  product?: Product;
}

export interface CreateGRNRequest {
  poId?: string;
  refNo?: string;
  lines: Array<{
    productId: string;
    qty: number;
    unitCost: number;
    batchNumber?: string;
    expiryDate?: string;
  }>;
  notes?: string;
}

// ===== API Response Types =====

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
