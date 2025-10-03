import type {
  LoginInput,
  RegisterInput,
  CreateProductInput,
  CreateSaleInput,
  CreatePOInput,
  CreateGRNInput,
} from "shared-types";

export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl = "/api") {
    this.baseUrl = baseUrl;
  }

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: response.statusText,
      }));
      throw new Error(error.message || "Request failed");
    }

    return response.json();
  }

  // Auth
  async login(data: LoginInput) {
    return this.request<{ accessToken: string; refreshToken: string; user: any }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  }

  async register(data: RegisterInput) {
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

    return this.request<{ products: any[]; total: number }>(
      `/products?${searchParams}`
    );
  }

  async getProduct(id: string) {
    return this.request<{ product: any }>(`/products/${id}`);
  }

  async createProduct(data: CreateProductInput) {
    return this.request<{ product: any }>("/products", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: string, data: Partial<CreateProductInput>) {
    return this.request<{ product: any }>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(id: string) {
    return this.request<{ success: boolean }>(`/products/${id}`, {
      method: "DELETE",
    });
  }

  // Batches
  async getBatches(productId?: string) {
    const params = productId ? `?productId=${productId}` : "";
    return this.request<{ batches: any[] }>(`/batches${params}`);
  }

  async getExpiringBatches(days = 30) {
    return this.request<{ batches: any[] }>(`/batches/expiring?days=${days}`);
  }

  // Sales
  async createSale(data: CreateSaleInput) {
    return this.request<{ sale: any }>("/sales", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getSale(id: string) {
    return this.request<{ sale: any }>(`/sales/${id}`);
  }

  async refundSale(id: string) {
    return this.request<{ sale: any }>(`/sales/${id}/refund`, {
      method: "POST",
    });
  }

  // Suppliers
  async getSuppliers() {
    return this.request<{ suppliers: any[] }>("/suppliers");
  }

  async createSupplier(data: any) {
    return this.request<{ supplier: any }>("/suppliers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Purchase Orders
  async getPurchaseOrders(params?: { status?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);

    return this.request<{ pos: any[] }>(`/po?${searchParams}`);
  }

  async createPODraft(data: CreatePOInput) {
    return this.request<{ po: any }>("/po/draft", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async approvePO(id: string) {
    return this.request<{ po: any }>(`/po/${id}/approve`, {
      method: "POST",
    });
  }

  async createGRN(data: CreateGRNInput) {
    return this.request<{ grn: any }>("/po/grn", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Reports
  async getSalesReport(params: { from: string; to: string }) {
    return this.request<{ report: any }>(
      `/reports/sales?from=${params.from}&to=${params.to}`
    );
  }

  async getMarginsReport() {
    return this.request<{ report: any }>("/reports/margins");
  }

  async getDeadStockReport() {
    return this.request<{ report: any }>("/reports/dead-stock");
  }
}

export const apiClient = new ApiClient();