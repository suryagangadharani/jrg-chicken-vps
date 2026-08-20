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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-background/95 backdrop-blur-md shadow-lg">
      <div className="mx-auto flex max-w-md items-center justify-around px-6 py-1.5">
        <Link
          to="/"
          className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors ${
            isHomeActive ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className={`grid h-8 w-14 place-items-center rounded-full transition-colors ${isHomeActive ? "bg-primary/10" : ""}`}>
            <Home className="h-5 w-5" />
          </div>
          <span className="mt-0.5 text-xs font-semibold">Home</span>
        </Link>

        <Link
          to="/profile"
          className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors ${
            isProfileActive ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className={`grid h-8 w-14 place-items-center rounded-full transition-colors ${isProfileActive ? "bg-primary/10" : ""}`}>
            <User className="h-5 w-5" />
          </div>
          <span className="mt-0.5 text-xs font-semibold">Profile</span>
        </Link>
      </div>
    </nav>
  );
}
