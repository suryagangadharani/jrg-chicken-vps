import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  role: "admin" | "customer";
  created_at?: string;
}

interface AuthCtx {
  user: AuthUser | null;
  session: { user: AuthUser } | null;
  loading: boolean;
  isAdmin: boolean;
  fullName: string;
  signOut: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
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

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await apiClient.auth.logout();
    setUser(null);
  };

  const isAdmin = user?.role === "admin";
  const fullName = user?.full_name || "";
  const session = user ? { user } : null;

  return (
    <Ctx.Provider value={{ user, session, loading, isAdmin, fullName, signOut, refetchUser: fetchCurrentUser }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
