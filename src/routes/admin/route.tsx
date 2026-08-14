import { createFileRoute, Link, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { LayoutDashboard, Package, ShoppingBag, Users, LogOut, Home, Menu, X, Tag } from "lucide-react";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const user = await apiClient.auth.getMe();
    if (!user) throw redirect({ to: "/auth" });
    if (user.role !== "admin") throw redirect({ to: "/auth" });
    return { user };
  },
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/promos", label: "Promos", icon: Tag },
  { to: "/admin/users", label: "Users", icon: Users },
];

function AdminLayout() {
  const loc = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSignOut = async () => {
    await apiClient.auth.logout();
    window.location.href = "/";
  };

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {NAV.map((n) => {
        const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={onClick}
            className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              active ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
            }`}
          >
            <n.icon className="h-4 w-4" />
            {n.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-secondary/30 pb-20 lg:pb-0">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-3 lg:hidden">
        <Link to="/admin" className="flex items-center gap-2 font-display text-base font-bold text-primary">
          <img src="/jrg-logo.png" alt="JRG" className="h-8 w-8 rounded-full object-cover" />
          Admin
        </Link>
        <div className="flex items-center gap-1.5">
          <Link
            to="/"
            aria-label="Back to site"
            className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-secondary"
          >
            <Home className="h-4 w-4" />
          </Link>
          <button
            onClick={handleSignOut}
            aria-label="Sign out"
            className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-secondary"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-secondary"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside
            className="absolute right-0 top-0 h-full w-72 max-w-[85vw] bg-card p-4 shadow-elegant"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-lg font-bold text-primary">Menu</span>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-4 flex flex-col gap-1">
              <NavLinks onClick={() => setDrawerOpen(false)} />
              <div className="my-2 h-px bg-border" />
              <Link
                to="/"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary"
              >
                <Home className="h-4 w-4" />
                Back to site
              </Link>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </nav>
          </aside>
        </div>
      )}

      <div className="grid min-h-screen lg:grid-cols-[240px_1fr]">
        <aside className="hidden border-r border-border bg-card lg:sticky lg:top-0 lg:block lg:h-screen">
          <div className="p-6">
            <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold text-primary">
              <img src="/jrg-logo.png" alt="JRG" className="h-9 w-9 rounded-full object-cover" />
              Admin
            </Link>
          </div>
          <nav className="flex flex-col gap-1 px-3">
            <NavLinks />
            <div className="mt-6 border-t border-border pt-4">
              <Link
                to="/"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
              >
                <Home className="h-4 w-4" />
                Back to site
              </Link>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </nav>
        </aside>

        <main className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-border bg-card/95 backdrop-blur lg:hidden">
        {NAV.map((n) => {
          const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <n.icon className="h-5 w-5" />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
