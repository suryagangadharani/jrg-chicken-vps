import { Link, useRouterState } from "@tanstack/react-router";
import { ShoppingBag, ChevronRight } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { inr } from "@/lib/format";

export function CartBar() {
  const { items, count, subtotal } = useCart();
  const { location } = useRouterState();
  const path = location.pathname;
  const hideOn = ["/cart", "/checkout", "/auth", "/reset-password"];
  if (count === 0 || hideOn.some((p) => path.startsWith(p)) || path.startsWith("/admin")) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-4 sm:pb-4">
      <Link
        to="/cart"
        className="pointer-events-auto mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-elegant ring-1 ring-primary/40 transition active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-foreground/15">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold">{count} {count === 1 ? "item" : "items"} added</div>
            <div className="text-[11px] opacity-90">{items.reduce((s, i) => s + i.qty_kg, 0)} kg · {inr(subtotal)}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm font-bold">
          View Cart <ChevronRight className="h-4 w-4" />
        </div>
      </Link>
    </div>
  );
}
