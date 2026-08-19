import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingCart, User, Menu, X, Shield, LogOut, MapPin, Package } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NotificationCenter } from "@/components/NotificationCenter";

export function Navbar() {
  const { user, isAdmin, signOut } = useAuth();
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  const links = [
    { to: "/", label: "Home" },
    { to: "/products", label: "Shop" },
    { to: "/terms", label: "Terms" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold text-primary md:text-xl">
          <img src="/jrg-logo.png" alt="JRG Chicken" className="h-10 w-10 rounded-full object-cover shadow-elegant ring-2 ring-primary/20" />
          <span className="flex flex-col leading-tight">
            <span className="truncate max-w-[160px] sm:max-w-none">JRG Chicken</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">Exclusive Cuts</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="text-sm font-medium text-muted-foreground transition hover:text-foreground [&.active]:text-primary">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/cart" className="relative">
            <Button variant="ghost" size="icon" aria-label="Cart">
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {count}
                </span>
              )}
            </Button>
          </Link>

          {user && <NotificationCenter />}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Account">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-xs">
                  <div className="font-semibold text-foreground">You are signed in 👋</div>
                  <div className="truncate text-muted-foreground">{user.email}</div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => nav({ to: "/profile" })}><User className="mr-2 h-4 w-4" />My Profile</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => nav({ to: "/orders" })}><Package className="mr-2 h-4 w-4" />My Orders</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => nav({ to: "/addresses" })}><MapPin className="mr-2 h-4 w-4" />Addresses</DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => nav({ to: "/admin" })}><Shield className="mr-2 h-4 w-4" />Admin Dashboard</DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={async () => { await signOut(); nav({ to: "/" }); }}>
                  <LogOut className="mr-2 h-4 w-4" />Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth"><Button size="sm">Sign in</Button></Link>
          )}

          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border/60 md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 p-3">
            {links.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-secondary [&.active]:bg-secondary [&.active]:text-primary">
                {l.label}
              </Link>
            ))}
            {!user && <Link to="/auth" onClick={() => setOpen(false)} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Sign in</Link>}
          </div>
        </div>
      )}
    </header>
  );
}
