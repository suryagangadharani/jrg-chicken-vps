import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { realtime } from "@/lib/realtime";
import { CheckCircle2, ChefHat, Bike, PackageCheck, XCircle, Clock, X } from "lucide-react";
import { toast } from "sonner";

const STATUS_META: Record<string, { label: string; emoji: string; gradient: string; Icon: any }> = {
  placed: { label: "Order placed", emoji: "📝", gradient: "from-slate-500 to-slate-700", Icon: Clock },
  confirmed: { label: "Order confirmed", emoji: "✅", gradient: "from-emerald-500 to-green-600", Icon: CheckCircle2 },
  preparing: { label: "We're preparing your order", emoji: "🍗", gradient: "from-amber-500 to-orange-600", Icon: ChefHat },
  out_for_delivery: { label: "Out for delivery", emoji: "🛵", gradient: "from-blue-500 to-indigo-600", Icon: Bike },
  delivered: { label: "Delivered", emoji: "🎉", gradient: "from-green-500 to-emerald-700", Icon: PackageCheck },
  cancelled: { label: "Order cancelled", emoji: "❌", gradient: "from-red-500 to-rose-700", Icon: XCircle },
};

function playChime() {
  try {
    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    [660, 990].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = now + i * 0.15;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.3);
    });
  } catch {}
}

export function CustomerOrderListener() {
  const { user, isAdmin } = useAuth();
  const [banner, setBanner] = useState<{ status: string; orderNumber: string } | null>(null);
  const prevStatus = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!user || isAdmin) return;

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const triggerNotification = (o: any, newStatus: string) => {
      const meta = STATUS_META[newStatus];
      if (!meta) return;

      const orderNo = o.order_number || o.id;
      setBanner({ status: newStatus, orderNumber: orderNo });
      playChime();

      toast.success(`${meta.emoji} ${meta.label}`, {
        description: `Order #${orderNo} is now ${meta.label}`,
        duration: 8000,
      });

      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(`${meta.emoji} ${meta.label}`, {
            body: `Order #${orderNo}`,
            icon: "/jrg-logo.png",
          });
        } catch {}
      }
      setTimeout(() => setBanner((b) => (b?.orderNumber === orderNo ? null : b)), 8000);
    };

    const unsubscribe = realtime.subscribe("ORDER_UPDATED", (updatedOrder) => {
      if (!updatedOrder) return;
      if (updatedOrder.user_id && updatedOrder.user_id !== user.id) return;

      const oldStatus = prevStatus.current[updatedOrder.id];
      prevStatus.current[updatedOrder.id] = updatedOrder.status;

      if (!oldStatus || oldStatus !== updatedOrder.status) {
        triggerNotification(updatedOrder, updatedOrder.status);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user?.id, isAdmin]);

  if (!banner) return null;
  const meta = STATUS_META[banner.status];
  const Icon = meta.Icon;

  return (
    <div className="fixed left-1/2 top-4 z-[100] w-[92%] max-w-md -translate-x-1/2 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${meta.gradient} p-4 text-white shadow-2xl`}>
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_20%_20%,white,transparent_50%)]" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/20 backdrop-blur">
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs opacity-90">Order {banner.orderNumber}</div>
            <div className="truncate text-base font-bold">
              {meta.emoji} {meta.label}
            </div>
          </div>
          <button onClick={() => setBanner(null)} className="rounded-full p-1 hover:bg-white/20" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
