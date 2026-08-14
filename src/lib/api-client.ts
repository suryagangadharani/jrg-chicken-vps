// Centralized JRG Chicken API Client replacing Supabase & Firebase

const TOKEN_KEY = "jrg_auth_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || `HTTP ${response.status}: Request failed`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const apiClient = {
  auth: {
    async register(data: { email: string; password: string; full_name?: string; phone?: string }) {
      const res = await request<{ user: any; token: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (res.token) setStoredToken(res.token);
      return res;
    },
    async login(data: { email: string; password: string }) {
      const res = await request<{ user: any; token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (res.token) setStoredToken(res.token);
      return res;
    },
    async logout() {
      try {
        await request("/api/auth/logout", { method: "POST" });
      } catch {}
      setStoredToken(null);
    },
    async getMe() {
      if (!getStoredToken()) return null;
      try {
        const res = await request<{ user: any }>("/api/auth/me");
        return res.user;
      } catch {
        setStoredToken(null);
        return null;
      }
    },
  },
  products: {
    async getAll() {
      return request<any[]>("/api/products");
    },
    async getBySlug(slug: string) {
      return request<any>(`/api/products/${slug}`);
    },
  },
  categories: {
    async getAll() {
      return request<any[]>("/api/categories");
    },
  },
  banners: {
    async getAll() {
      return request<any[]>("/api/banners");
    },
  },
  promos: {
    async getAll() {
      return request<any[]>("/api/promos");
    },
    async validate(code: string, subtotal: number) {
      return request<{ valid: boolean; discount: number; promo: any }>("/api/promos/validate", {
        method: "POST",
        body: JSON.stringify({ code, subtotal }),
      });
    },
  },
  orders: {
    async createOrder(orderData: any) {
      return request<any>("/api/orders", {
        method: "POST",
        body: JSON.stringify(orderData),
      });
    },
    async getMyOrders() {
      return request<any[]>("/api/orders/my-orders");
    },
    async getById(id: string) {
      return request<any>(`/api/orders/${id}`);
    },
  },
  user: {
    async getProfile() {
      return request<any>("/api/user/profile");
    },
    async updateProfile(data: { full_name?: string; phone?: string }) {
      return request<any>("/api/user/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    async getAddresses() {
      return request<any[]>("/api/user/addresses");
    },
    async addAddress(addressData: any) {
      return request<any>("/api/user/addresses", {
        method: "POST",
        body: JSON.stringify(addressData),
      });
    },
    async deleteAddress(id: string) {
      return request<{ success: boolean }>(`/api/user/addresses/${id}`, {
        method: "DELETE",
      });
    },
  },
  admin: {
    async getStats() {
      return request<any>("/api/admin/stats");
    },
    async getOrders() {
      return request<any[]>("/api/admin/orders");
    },
    async updateOrderStatus(id: string, status: string, admin_notes?: string) {
      return request<any>(`/api/admin/orders/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status, admin_notes }),
      });
    },
    async createProduct(productData: any) {
      return request<any>("/api/admin/products", {
        method: "POST",
        body: JSON.stringify(productData),
      });
    },
    async updateProduct(id: string, productData: any) {
      return request<any>(`/api/admin/products/${id}`, {
        method: "PUT",
        body: JSON.stringify(productData),
      });
    },
    async deleteProduct(id: string) {
      return request<{ success: boolean }>(`/api/admin/products/${id}`, {
        method: "DELETE",
      });
    },
    async createCategory(categoryData: any) {
      return request<any>("/api/admin/categories", {
        method: "POST",
        body: JSON.stringify(categoryData),
      });
    },
    async createPromo(promoData: any) {
      return request<any>("/api/admin/promos", {
        method: "POST",
        body: JSON.stringify(promoData),
      });
    },
    async deletePromo(id: string) {
      return request<{ success: boolean }>(`/api/admin/promos/${id}`, {
        method: "DELETE",
      });
    },
    async getUsers() {
      return request<any[]>("/api/admin/users");
    },
    async updateUserRole(id: string, role: string) {
      return request<{ success: boolean }>(`/api/admin/users/${id}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
    },
    async deleteUser(id: string) {
      return request<{ success: boolean }>(`/api/admin/users/${id}`, {
        method: "DELETE",
      });
    },
    async uploadImage(file: File) {
      const token = getStoredToken();
      const formData = new FormData();
      formData.append("file", file);

      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        headers,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Image upload failed");
      return data as { url: string };
    },
  },
};
