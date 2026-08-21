import { Link, useRouterState } from "@tanstack/react-router";
import { Home, User } from "lucide-react";

export function BottomNav() {
  const { location } = useRouterState();
  const path = location.pathname;

  // Do not render bottom nav on admin or delivery management dashboards
  if (path.startsWith("/admin") || path.startsWith("/delivery")) {
    return null;
  }

  const isHomeActive = path === "/" || path.startsWith("/products");
  const isProfileActive = path.startsWith("/profile") || path.startsWith("/orders") || path.startsWith("/addresses");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-card/95 backdrop-blur-md shadow-2xl">
      <div className="mx-auto flex max-w-md items-center justify-around px-6 py-2">
        <Link
          to="/"
          className={`flex flex-1 flex-col items-center justify-center py-1 transition-all ${
            isHomeActive ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-all ${
              isHomeActive ? "bg-primary/10 text-primary ring-1 ring-primary/20" : ""
            }`}
          >
            <Home className="h-4 w-4" />
            <span className="text-xs font-semibold">Home</span>
          </div>
        </Link>

        <Link
          to="/profile"
          className={`flex flex-1 flex-col items-center justify-center py-1 transition-all ${
            isProfileActive ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-all ${
              isProfileActive ? "bg-primary/10 text-primary ring-1 ring-primary/20" : ""
            }`}
          >
            <User className="h-4 w-4" />
            <span className="text-xs font-semibold">Profile</span>
          </div>
        </Link>
      </div>
    </nav>
  );
}

