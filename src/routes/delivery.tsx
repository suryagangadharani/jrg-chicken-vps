import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { apiClient } from "@/lib/api-client";
import { Bike, LogOut, Home } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NotificationCenter } from "@/components/NotificationCenter";

export const Route = createFileRoute("/delivery")({
  ssr: false,
  beforeLoad: async () => {
    const user = await apiClient.auth.getMe();
    if (!user) throw redirect({ to: "/auth" });
    if (user.role !== "delivery_boy" && user.role !== "admin") {
      throw redirect({ to: "/auth" });
    }
    return { user };
  },
  component: DeliveryLayout,
});

function DeliveryLayout() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/auth";
  };

  return (
    <div className="min-h-screen bg-secondary/30 pb-16">
      {/* Mobile-first sticky header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/jrg-logo.png" alt="JRG Chicken" className="h-9 w-9 rounded-full object-cover border border-primary/20" />
            <div>
              <h1 className="font-display text-base font-bold text-primary leading-tight">JRG Chicken</h1>
              <p className="text-[11px] text-muted-foreground font-medium">Delivery Dashboard · {user?.full_name || "Personnel"}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <NotificationCenter />
            {user?.role === "admin" && (
              <Link
                to="/admin"
                className="grid h-9 w-9 place-items-center rounded-xl border border-border hover:bg-secondary text-xs"
                title="Admin Dashboard"
              >
                <Home className="h-4 w-4" />
              </Link>
            )}
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              className="grid h-9 w-9 place-items-center rounded-xl border border-border hover:bg-secondary text-muted-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main delivery dashboard outlet */}
      <main className="mx-auto max-w-lg p-4">
        <Outlet />
      </main>
    </div>
  );
}
