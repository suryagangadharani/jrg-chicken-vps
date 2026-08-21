import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { realtime } from "@/lib/realtime";
import { inr, dateFmt } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, MapPin, User, Package, BellRing } from "lucide-react";

/** Plays a repeating chime until stopped. */
function useChime() {
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);

  const stop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const ring = () => {
    stop();
    try {
      const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      if (!ctxRef.current) ctxRef.current = new AC();
      const ctx = ctxRef.current!;
      const play = () => {
        const now = ctx.currentTime;
        [880, 1320].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          o.frequency.value = freq;
          const t = now + i * 0.18;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
          o.connect(g);
          g.connect(ctx.destination);
          o.start(t);
          o.stop(t + 0.3);
        });
      };
      play();
      intervalRef.current = window.setInterval(play, 1500) as unknown as number;
      setTimeout(stop, 30000);
    } catch {}
  };

  return { ring, stop };
}

export function NewOrderListener() {
  const [order, setOrder] = useState<any | null>(null);
  const { ring, stop } = useChime();
  const { isAdmin, isDeliveryBoy, isAdminOrDeliveryBoy } = useAuth();
  const seenOrderIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isAdminOrDeliveryBoy) return;

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const unsubscribe = realtime.subscribe("ORDER_CREATED", (newOrder) => {
      if (!newOrder || !newOrder.id) return;
      if (seenOrderIds.current.has(newOrder.id)) return;
      seenOrderIds.current.add(newOrder.id);

      setOrder(newOrder);
      ring();

      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(isDeliveryBoy ? "🚴 New Delivery Order!" : "🛒 New Order Received!", {
            body: `${newOrder.customer_name || "Customer"} — ${inr(newOrder.total || 0)}`,
          });
        } catch {}
      }
    });

    return () => {
      unsubscribe();
      stop();
    };
  }, [isAdminOrDeliveryBoy, isDeliveryBoy]);

  const close = () => {
    stop();
    setOrder(null);
  };

  return (
    <Dialog open={!!order} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary animate-pulse">
              <BellRing className="h-5 w-5" />
            </span>
            New Order Received!
          </DialogTitle>
        </DialogHeader>
        {order && (() => {
          const itemsList = Array.isArray(order.items) ? order.items : [];
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-hero p-3 text-primary-foreground">
                <div>
                  <div className="text-xs opacity-80">Order</div>
                  <div className="text-lg font-bold">{order.order_number || order.id}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs opacity-80">Total</div>
                  <div className="text-xl font-bold">{inr(order.total || 0)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-secondary/60 p-2">
                  <div className="text-muted-foreground">Payment</div>
                  <div className="font-semibold">
                    {order.payment_method === "cod" ? "Cash on Delivery" : "Online"}
                  </div>
                </div>
                <div className="rounded-lg bg-secondary/60 p-2">
                  <div className="text-muted-foreground">Placed</div>
                  <div className="font-semibold">{dateFmt(order.created_at)}</div>
                </div>
              </div>

              <div className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <User className="h-4 w-4" />Customer
                </div>
                <div className="mt-1 text-sm">{order.customer_name || "Customer"}</div>
                {order.customer_phone && (
                  <a
                    href={`tel:${order.customer_phone}`}
                    className="mt-0.5 flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {order.customer_phone}
                  </a>
                )}
                {order.customer_email && (
                  <div className="text-xs text-muted-foreground truncate">{order.customer_email}</div>
                )}
              </div>

              <div className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MapPin className="h-4 w-4" />Delivery address
                </div>
                <div className="mt-1 text-sm">
                  {order.address_line1}
                  {order.address_line2 ? `, ${order.address_line2}` : ""}
                  <br />
                  {order.city} - {order.pincode}
                  {order.landmark && (
                    <>
                      <br />
                      <span className="text-muted-foreground">Landmark: {order.landmark}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Package className="h-4 w-4" />Items ({itemsList.length})
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {itemsList.map((i: any, idx: number) => (
                    <li key={idx} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">
                        {i.name} × {i.qty_kg} kg
                      </span>
                      <span className="shrink-0 font-semibold">
                        {inr((i.price || 0) * (i.qty_kg || 1))}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex justify-between border-t pt-2 text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{inr(order.subtotal || order.total || 0)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t pt-2 font-bold text-primary">
                  <span>Total</span>
                  <span>{inr(order.total || 0)}</span>
                </div>
              </div>

              <Button onClick={close} className="w-full bg-hero shadow-elegant" size="lg">
                Acknowledge & silence
              </Button>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}
