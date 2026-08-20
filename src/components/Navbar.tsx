import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingCart, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "@/components/NotificationCenter";

export function Navbar() {
  const { user, signOut } = useAuth();
  const { count } = useCart();
  const nav = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-2.5 md:px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold text-primary md:text-xl">
          <img src="/jrg-logo.png" alt="JRG Chicken" className="h-9 w-9 rounded-full object-cover shadow-sm ring-2 ring-primary/20" />
          <span className="flex flex-col leading-tight">
            <span className="truncate max-w-[140px] sm:max-w-none text-base font-bold">JRG Chicken</span>
            <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground sm:text-[10px]">Exclusive Cuts</span>
          </span>
        </Link>

        {/* Header Right Controls: ONLY Cart, Notifications, Logout */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Link to="/cart" className="relative">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Cart">
              <ShoppingCart className="h-5 w-5 text-foreground" />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {count}
                </span>
              )}
            </Button>
          </Link>

          {user && <NotificationCenter />}

          {user ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={async () => {
                await signOut();
                nav({ to: "/" });
              }}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          ) : (
            <Link to="/auth">
              <Button size="sm" className="h-8 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm">
                Sign in
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
