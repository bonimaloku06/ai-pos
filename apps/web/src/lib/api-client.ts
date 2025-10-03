class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl = "/api") {
    this.baseUrl = baseUrl;
  }

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    // Always get the latest token from localStorage
    const token = localStorage.getItem("accessToken");

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    // Only set Content-Type if there's a body
    if (options.body) {
      headers["Content-Type"] = "application/json";
    }

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      // Handle 401 Unauthorized - redirect to login
      if (response.status === 401) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
        throw new Error("Session expired. Please log in again.");
      }

      const error = await response.json().catch(() => ({
        message: response.statusText,
      }));
      throw new Error(error.error || error.message || "Request failed");
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // Generic HTTP methods
  async get<T = any>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  async post<T = any>(path: string, data?: any): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T = any>(path: string, data?: any): Promise<T> {
    return this.request<T>(path, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(path: string, data?: any): Promise<T> {
    return this.request<T>(path, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(path: string): Promise<T> {
    return this.request<T>(path, {
      method: "DELETE",
    });
  }

  // Auth
  async login(data: { email: string; password: string }) {
    return this.request<{ accessToken: string; refreshToken: string; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async register(data: { email: string; password: string; role?: string }) {
    return this.request<{ user: any }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getMe() {
    return this.request<{ user: any }>("/auth/me");
  }

  // Products
  async getProducts(params?: { query?: string; page?: number; limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.query) searchParams.set("query", params.query);
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());

    return this.request<{ products: any[]; total: number }>(`/products?${searchParams}`);
  }

  async getProduct(id: string) {
    return this.request<{ product: any }>(`/products/${id}`);
  }

  async createProduct(data: any) {
    return this.request<{ product: any }>("/products", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: string, data: any) {
    return this.request<{ product: any }>(`/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(id: string) {
    return this.request<{ success: boolean }>(`/products/${id}`, {
      method: "DELETE",
    });
  }

  // Batches
  async getBatches(params?: {
    productId?: string;
    page?: number;
    limit?: number;
    hasStock?: boolean;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.productId) searchParams.set("productId", params.productId);
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.hasStock !== undefined) searchParams.set("hasStock", params.hasStock.toString());

    return this.request<{ batches: any[]; total: number; page: number; limit: number }>(
      `/batches?${searchParams}`
    );
  }

  async getExpiringBatches(days = 90) {
    return this.request<{ batches: any[] }>(`/batches/expiring?days=${days}`);
  }

  async getInventorySummary(storeId?: string) {
    const params = storeId ? `?storeId=${storeId}` : "";
    return this.request<{ inventory: any[] }>(`/batches/inventory-summary${params}`);
  }

  // Sales
  async createSale(data: any) {
    return this.request<{ sale: any }>("/sales", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getSale(id: string) {
    return this.request<{ sale: any }>(`/sales/${id}`);
  }

  // GRN (Goods Receipt)
  async createGRN(data: any) {
    return this.request<{ grn: any }>("/grn", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getGRNHistory(params?: { page?: number; limit?: number; supplierId?: string; productId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.supplierId) searchParams.set("supplierId", params.supplierId);
    if (params?.productId) searchParams.set("productId", params.productId);

    return this.request<{ grns: any[]; total: number }>(`/grn?${searchParams}`);
  }

  async updateGRN(grnNumber: string, data: any) {
    return this.request<{ grn: any }>(`/grn/${grnNumber}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // Suppliers
  async getSuppliers(params?: { page?: number; limit?: number; isActive?: boolean }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.isActive !== undefined) searchParams.set("isActive", params.isActive.toString());

    return this.request<{ suppliers: any[]; total: number }>(`/suppliers?${searchParams}`);
  }

  async getSupplier(id: string) {
    return this.request<{ supplier: any }>(`/suppliers/${id}`);
  }

  async createSupplier(data: any) {
    return this.request<{ supplier: any }>("/suppliers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateSupplier(id: string, data: any) {
    return this.request<{ supplier: any }>(`/suppliers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteSupplier(id: string) {
    return this.request<{ success: boolean }>(`/suppliers/${id}`, {
      method: "DELETE",
    });
  }

  async getSupplierCalendar(id: string) {
    return this.request<{ deliveryDays: string[]; leadTimeDays: number; nextDeliveries: any[] }>(
      `/suppliers/${id}/calendar`
    );
  }

  // Purchase Orders
  async getPurchaseOrders(params?: {
    page?: number;
    limit?: number;
    status?: string;
    supplierId?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.status) searchParams.set("status", params.status);
    if (params?.supplierId) searchParams.set("supplierId", params.supplierId);

    return this.request<{ pos: any[]; total: number }>(`/po?${searchParams}`);
  }

  async getPurchaseOrder(id: string) {
    return this.request<{ po: any }>(`/po/${id}`);
  }

  async createPurchaseOrder(data: any) {
    return this.request<{ po: any }>("/po", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updatePurchaseOrder(id: string, data: any) {
    return this.request<{ po: any }>(`/po/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async approvePurchaseOrder(id: string) {
    return this.request<{ po: any }>(`/po/${id}/approve`, {
      method: "POST",
    });
  }

  async cancelPurchaseOrder(id: string) {
    return this.request<{ po: any }>(`/po/${id}/cancel`, {
      method: "POST",
    });
  }

  async receivePurchaseOrder(id: string, grnNumber: string) {
    return this.request<{ po: any }>(`/po/${id}/receive`, {
      method: "POST",
      body: JSON.stringify({ grnNumber }),
    });
  }

  // Reports
  async getSalesReport(params: { from: string; to: string }) {
    return this.request<{ report: any }>(`/reports/sales?from=${params.from}&to=${params.to}`);
  }
}

export const apiClient = new ApiClient();
