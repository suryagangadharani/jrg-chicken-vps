import { MessageCircle, Percent } from "lucide-react";

const ADS = [
  {
    icon: MessageCircle,
    text: "WhatsApp order — click now",
    href: "https://wa.me/917032424774",
    color: "bg-green-500",
  },
  { icon: Percent, text: "Bulk order discount", href: "/products", color: "bg-orange-500" },
];

export function AdTicker() {
  const items = [...ADS, ...ADS, ...ADS, ...ADS];
  return (
    <div className="relative overflow-hidden border-y border-border bg-card py-3">
      <div className="animate-marquee flex w-max gap-4 hover:[animation-play-state:paused]">
        {items.map((ad, i) => (
          <a
            key={i}
            href={ad.href}
            target={ad.href.startsWith("http") ? "_blank" : undefined}
            rel={ad.href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium shadow-card transition hover:shadow-elegant"
          >
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-white ${ad.color}`}>
              <ad.icon className="h-3.5 w-3.5" />
            </span>
            <span className="whitespace-nowrap text-foreground">{ad.text}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
