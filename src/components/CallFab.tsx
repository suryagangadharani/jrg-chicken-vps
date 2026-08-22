import { Phone } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useRouterState } from "@tanstack/react-router";

const PHONE = "7032424774";

export function CallFab() {
  const { count } = useCart();
  const { location } = useRouterState();
  const path = location.pathname;

  if (path.startsWith("/admin") || path.startsWith("/delivery")) return null;

  // If cart is present, position above sticky cart; otherwise position above bottom nav
  const hasCartBar = count > 0 && !["/cart", "/checkout", "/auth", "/reset-password"].some((p) => path.startsWith(p));
  const bottomClass = hasCartBar ? "bottom-[136px] sm:bottom-[140px]" : "bottom-20 sm:bottom-24";

  return (
    <a
      href={`tel:+91${PHONE}`}
      aria-label={`Call JRG Chicken at ${PHONE}`}
      className={`fixed right-4 z-40 flex items-center gap-2 transition-all duration-300 ${bottomClass}`}
    >
      <span className="inline-flex animate-pulse items-center rounded-full bg-card/95 px-2.5 py-1 text-[10px] font-semibold text-emerald-600 shadow-md ring-1 ring-emerald-500/30 backdrop-blur sm:px-3 sm:py-1.5 sm:text-xs">
        Call to order
      </span>
      <span className="relative flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl transition hover:scale-105 active:scale-95">
        <Phone className="h-6 w-6 sm:h-7 sm:w-7" fill="currentColor" />
        <span className="pointer-events-none absolute -top-1 -right-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white"></span>
        </span>
      </span>
    </a>
  );
}

