import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  role: "admin" | "customer" | "delivery_boy";
  created_at?: string;
}

interface AuthCtx {
  user: AuthUser | null;
  session: { user: AuthUser } | null;
  loading: boolean;
  isAdmin: boolean;
  isDeliveryBoy: boolean;
  isAdminOrDeliveryBoy: boolean;
  fullName: string;
  signOut: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  isDeliveryBoy: false,
  isAdminOrDeliveryBoy: false,
  fullName: "",
  signOut: async () => {},
  refetchUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const current = await apiClient.auth.getMe();
      setUser(current);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const signOut = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await apiClient.auth.logout();
    setUser(null);
  }, [queryClient]);

  const isAdmin = user?.role === "admin";
  const isDeliveryBoy = user?.role === "delivery_boy";
  const isAdminOrDeliveryBoy = isAdmin || isDeliveryBoy;
  const fullName = user?.full_name || "";
  const session = useMemo(() => (user ? { user } : null), [user]);

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      isAdmin,
      isDeliveryBoy,
      isAdminOrDeliveryBoy,
      fullName,
      signOut,
      refetchUser: fetchCurrentUser,
    }),
    [user, session, loading, isAdmin, isDeliveryBoy, isAdminOrDeliveryBoy, fullName, signOut, fetchCurrentUser]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
