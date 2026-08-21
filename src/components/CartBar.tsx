import { Link, useRouterState } from "@tanstack/react-router";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { inr } from "@/lib/format";

export function CartBar() {
  const { items, count, subtotal } = useCart();
  const { location } = useRouterState();
  const path = location.pathname;
  const hideOn = ["/cart", "/checkout", "/auth", "/reset-password"];

  if (count === 0 || hideOn.some((p) => path.startsWith(p)) || path.startsWith("/admin") || path.startsWith("/delivery")) {
    return null;
  }

  const totalKg = items.reduce((sum, item) => sum + (Number(item.qty_kg) || 0), 0);
  const firstItemImage = items[0]?.image;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[68px] z-40 px-3 sm:px-4">
      <Link
        to="/cart"
        className="pointer-events-auto mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl bg-card p-2.5 text-card-foreground shadow-2xl border border-primary/20 ring-1 ring-black/5 backdrop-blur-md transition active:scale-[0.99] hover:border-primary/40"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary/10 text-primary">
            {firstItemImage ? (
              <img src={firstItemImage} alt="Cart preview" className="h-full w-full object-cover" />
            ) : (
              <ShoppingBag className="h-5 w-5" />
            )}
            <span className="absolute -top-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {count}
            </span>
          </div>

          <div className="leading-tight min-w-0">
            <div className="text-xs font-bold text-foreground truncate">
              {count} {count === 1 ? "item" : "items"} added
            </div>
            <div className="text-[11px] font-semibold text-muted-foreground">
              {totalKg > 0 ? `${totalKg} kg · ` : ""}{inr(subtotal)}
            </div>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition shrink-0">
          <span>View Cart</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </Link>
    </div>
  );
}

