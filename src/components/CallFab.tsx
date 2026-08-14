import { Phone } from "lucide-react";

const PHONE = "7659018774";

export function CallFab() {
  return (
    <a
      href={`tel:+91${PHONE}`}
      aria-label={`Call JRG Chicken at ${PHONE}`}
      className="fixed bottom-24 right-4 z-40 flex items-center gap-2 md:bottom-6"
    >
      <span className="inline-flex animate-pulse items-center rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-success shadow-elegant ring-1 ring-success/30 sm:px-3 sm:py-1.5 sm:text-xs">
        Call to order
      </span>
      <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-success text-success-foreground shadow-elegant transition hover:scale-105">
        <Phone className="h-7 w-7" fill="currentColor" />
        <span className="pointer-events-none absolute -top-1 -right-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75"></span>
          <span className="relative inline-flex h-3 w-3 rounded-full bg-success ring-2 ring-white"></span>
        </span>
      </span>
    </a>
  );
}
