import { useEffect } from "react";
import { useCountdown } from "@/hooks/useCountdown";
import {
  launchDate,
  whatsappMessage,
  whatsappNumber,
} from "@/config/launch";

const UNITS = ["Days", "Hours", "Minutes", "Seconds"] as const;

export function LaunchOverlay({ onFinished }: { onFinished?: () => void }) {
  const c = useCountdown(launchDate);

  useEffect(() => {
    if (c.finished) onFinished?.();
  }, [c.finished, onFinished]);

  useEffect(() => {
    if (c.finished) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [c.finished]);

  if (c.finished) return null;

  const values = [c.days, c.hours, c.minutes, c.seconds];
  const waHref = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;
  const dateStr = launchDate.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="JRG Chicken grand opening"
      className="fixed inset-0 z-[9999] overflow-y-auto overscroll-contain"
      style={{ background: "#FFF8F2" }}
    >
      {/* soft ambient glows */}
      <div className="pointer-events-none absolute -left-24 top-[-10%] h-72 w-72 rounded-full opacity-30 blur-3xl" style={{ background: "#D6001C" }} />
      <div className="pointer-events-none absolute -right-24 bottom-[-10%] h-80 w-80 rounded-full opacity-25 blur-3xl" style={{ background: "#F5B400" }} />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-7 px-6 py-12 text-center">
        <img
          src="/jrg-logo.png"
          alt="JRG Chicken logo"
          className="h-24 w-24 animate-float rounded-full object-cover shadow-[0_18px_50px_-18px_rgba(0,0,0,0.45)] sm:h-28 sm:w-28"
        />

        <div className="animate-fade-in space-y-2">
          <div className="text-3xl">🐔</div>
          <p
            className="text-[0.7rem] font-semibold uppercase tracking-[0.42em] sm:text-xs"
            style={{ color: "#D6001C" }}
          >
            Grand Opening
          </p>
          <h1
            className="font-display text-4xl font-bold leading-tight text-black sm:text-6xl"
            style={{ letterSpacing: "-0.03em" }}
          >
            {dateStr}
          </h1>
          <p className="text-sm text-neutral-600 sm:text-base">
            Farm Fresh Chicken · Premium Quality · Fast Home Delivery
          </p>
        </div>

        {/* countdown */}
        <div className="grid w-full grid-cols-4 gap-2 sm:gap-4">
          {UNITS.map((label, i) => (
            <div
              key={label}
              className="rounded-2xl border border-white/70 bg-white/60 px-1 py-4 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-transform duration-500 sm:px-3 sm:py-6"
            >
              <div
                className="font-display text-2xl font-bold tabular-nums text-black sm:text-4xl"
                style={{ transition: "opacity .3s ease" }}
              >
                {String(values[i]).padStart(2, "0")}
              </div>
              <div className="mt-1 text-[0.6rem] uppercase tracking-[0.2em] text-neutral-500 sm:text-[0.68rem]">
                {label}
              </div>
            </div>
          ))}
        </div>
        <p className="-mt-3 text-[0.68rem] tracking-wide text-neutral-500">
          Opening at 6:00 AM IST
        </p>

        {/* Opening Day Offer Banner */}
        <section className="opening-offer">
          <img
            src="/opening-offer.png"
            alt="JRG Chicken Opening Day Offer - Buy 1KG Chicken Get 1KG Onions"
            className="opening-offer-image"
          />
        </section>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-full bg-[#25D366] px-7 py-4 text-base font-semibold text-white shadow-[0_16px_40px_-14px_rgba(37,211,102,0.85)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_50px_-14px_rgba(37,211,102,0.95)] active:translate-y-0"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
            <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.95 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.05 1.02-1.05 2.5s1.07 2.9 1.22 3.1c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.75-.71 2-1.4.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 2C6.5 2 2 6.5 2 12.05c0 1.77.46 3.5 1.35 5.02L2 22l5.06-1.32a10 10 0 0 0 4.99 1.33h.01C17.6 22.01 22 17.51 22 11.96 22 6.42 17.6 2 12.05 2z" />
          </svg>
          Notify Me on WhatsApp
        </a>

        <div className="animate-fade-in space-y-1 pt-2">
          <p className="text-sm font-medium text-black">Thank you for your love ❤️</p>
          <p className="text-xs text-neutral-600">
            We&apos;re preparing the freshest chicken experience for you.
          </p>
          <p className="text-xs font-semibold" style={{ color: "#D6001C" }}>
            See you on {dateStr}
          </p>
        </div>
      </div>
    </div>
  );
}

export default LaunchOverlay;
