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
      const res = await request<{ user: any; token: string; isFirstUser?: boolean }>("/api/auth/register", {
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
    async googleLogin(data: { credential?: string; access_token?: string; email?: string; full_name?: string; phone?: string }) {
      const res = await request<{ user: any; token: string; isFirstUser?: boolean; isNewUser?: boolean }>("/api/auth/google", {
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
    async updateProfile(data: { full_name?: string; phone?: string; email?: string }) {
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
  visits: {
    async record(session_id?: string, path?: string) {
      return request<{ success: boolean }>("/api/visits", {
        method: "POST",
        body: JSON.stringify({ session_id, path }),
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
    async updateCategory(id: string, categoryData: any) {
      return request<any>(`/api/admin/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify(categoryData),
      });
    },
    async deleteCategory(id: string) {
      return request<{ success: boolean }>(`/api/admin/categories/${id}`, {
        method: "DELETE",
      });
    },
    async updateCategoryPrice(id: string, price_per_kg: number) {
      return request<{ success: boolean; count: number }>(`/api/admin/categories/${id}/price`, {
        method: "PUT",
        body: JSON.stringify({ price_per_kg }),
      });
    },
    banners: {
      async getAll() {
        return request<any[]>("/api/admin/banners");
      },
      async create(bannerData: any) {
        return request<any>("/api/admin/banners", {
          method: "POST",
          body: JSON.stringify(bannerData),
        });
      },
      async update(id: string, bannerData: any) {
        return request<any>(`/api/admin/banners/${id}`, {
          method: "PUT",
          body: JSON.stringify(bannerData),
        });
      },
      async delete(id: string) {
        return request<{ success: boolean }>(`/api/admin/banners/${id}`, {
          method: "DELETE",
        });
      },
    },
    visits: {
      async getStats() {
        return request<{ today: number; yesterday: number; last7Days: number; last30Days: number; total: number }>("/api/admin/visits/stats");
      },
    },
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
    async updateUser(id: string, data: { full_name?: string; phone?: string; email?: string; role?: string }) {
      return request<{ success: boolean }>(`/api/admin/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
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
    async updateStoreStatus(data: { manualLunchBreak?: boolean; manualStoreClosed?: boolean } | boolean) {
      const bodyObj = typeof data === "boolean" ? { manualLunchBreak: data } : data;
      return request<any>("/api/admin/store-status", {
        method: "PUT",
        body: JSON.stringify(bodyObj),
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
    async getDeliveryBoys() {
      return request<any[]>("/api/admin/delivery-boys");
    },
    async createDeliveryBoy(data: { email: string; password: string; full_name: string; phone?: string }) {
      return request<any>("/api/admin/delivery-boys", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    async resetDeliveryBoyPassword(id: string, new_password: string) {
      return request<{ success: boolean; message: string }>(`/api/admin/delivery-boys/${id}/reset-password`, {
        method: "PUT",
        body: JSON.stringify({ new_password }),
      });
    },
    async getFcmStatus(userId: string) {
      return request<{ userId: string; role: string; activeTokenCount: number; totalDeviceCount: number; devices: any[] }>(`/api/admin/fcm/status/${userId}`);
    },
    async getVisits() {
      return request<{ today: number; total: number }>("/api/admin/visits");
    },
  },
  delivery: {
    async getOrders() {
      return request<any[]>("/api/delivery/orders");
    },
    async updateOrderStatus(id: string, status: string) {
      return request<any>(`/api/delivery/orders/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
    },
  },
  fcm: {
    async registerToken(token: string, device_info?: string) {
      return request<{ success: boolean }>("/api/fcm/register", {
        method: "POST",
        body: JSON.stringify({ token, device_info }),
      });
    },
    async unregisterToken(token: string) {
      return request<{ success: boolean }>("/api/fcm/unregister", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
    },
  },
  notifications: {
    async getAll() {
      return request<any[]>("/api/notifications");
    },
    async getUnreadCount() {
      return request<{ unreadCount: number }>("/api/notifications/unread-count");
    },
    async markRead(id: string) {
      return request<{ success: boolean }>(`/api/notifications/${id}/read`, { method: "PUT" });
    },
    async markAllRead() {
      return request<{ success: boolean }>("/api/notifications/read-all", { method: "PUT" });
    },
    async deleteSingle(id: string) {
      return request<{ success: boolean }>(`/api/notifications/${id}`, { method: "DELETE" });
    },
    async deleteAll() {
      return request<{ success: boolean }>("/api/notifications", { method: "DELETE" });
    },
    async sendTestNotification(data?: { soundType?: string; title?: string; message?: string }) {
      return request<any>("/api/notifications/test", {
        method: "POST",
        body: JSON.stringify(data || {}),
      });
    },
  },
  visits: {
    async record(path?: string) {
      if (typeof window === "undefined") return;
      let sid = localStorage.getItem("jrg_session_id");
      if (!sid) {
        sid = "s_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
        localStorage.setItem("jrg_session_id", sid);
      }
      return request<{ success: boolean }>("/api/visits", {
        method: "POST",
        body: JSON.stringify({ session_id: sid, path: path || window.location.pathname }),
      }).catch(() => {});
    },
  },
  storeStatus: {
    async get() {
      return request<any>("/api/store-status");
    },
    async updateManualLunchBreak(manualLunchBreak: boolean) {
      return request<any>("/api/admin/store-status", {
        method: "PUT",
        body: JSON.stringify({ manualLunchBreak }),
      });
    },
  },
};
