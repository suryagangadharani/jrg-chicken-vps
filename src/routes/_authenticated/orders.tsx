import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";
import { realtime } from "@/lib/realtime";
import { inr, dateFmt, statusLabel, statusColor } from "@/lib/format";
import { Package } from "lucide-react";

const STEPS = ["placed", "confirmed", "preparing", "out_for_delivery", "delivered"];

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({ meta: [{ title: "My Orders — JRG Chicken" }] }),
  component: OrdersPage,
});

function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const loadOrders = async () => {
      try {
        const data = await apiClient.orders.getMyOrders();
        setOrders(Array.isArray(data) ? data : []);
      } catch {}
    };

    loadOrders();

    const unsubscribe = realtime.subscribe("ORDER_UPDATED", (updatedOrder) => {
      if (updatedOrder && updatedOrder.user_id === user.id) {
        loadOrders();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">
        <h1 className="font-display text-3xl font-bold">My Orders</h1>
        {orders.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed p-12 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-semibold">No orders yet</p>
            <Link to="/products" className="mt-3 inline-block text-sm text-primary hover:underline">
              Start shopping →
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {orders.map((o) => {
              const stepIdx = STEPS.indexOf(o.status);
              const cancelled = o.status === "cancelled";
              return (
                <div key={o.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">{dateFmt(o.created_at)}</div>
                      <div className="font-bold">{o.order_number}</div>
                    </div>
                    <div className="text-right">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusColor[o.status] || ""}`}>
                        {statusLabel[o.status]}
                      </span>
                      <div className="mt-1 text-lg font-bold text-primary">{inr(o.total)}</div>
                    </div>
                  </div>

                  {!cancelled && (
                    <div className="mt-4 flex items-center gap-1">
                      {STEPS.map((s, i) => (
                        <div key={s} className="flex flex-1 items-center">
                          <div className={`h-2 flex-1 rounded-full ${i <= stepIdx ? "bg-primary" : "bg-secondary"}`} />
                          {i < STEPS.length - 1 && <div className="w-1" />}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-1 grid grid-cols-5 text-[10px] text-muted-foreground sm:text-xs">
                    {STEPS.map((s, i) => (
                      <div key={s} className={`text-center ${i <= stepIdx && !cancelled ? "font-semibold text-primary" : ""}`}>
                        {statusLabel[s]}
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 rounded-xl border border-border bg-secondary/20 p-3 text-sm">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items</div>
                    <ul className="mt-2 space-y-2">
                      {(Array.isArray(o.items) ? o.items : []).map((i: any, idx: number) => (
                        <li key={idx} className="flex flex-wrap items-start justify-between gap-2 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-foreground flex items-center flex-wrap gap-2">
                              <span>{i.name}</span>
                              <span className="text-muted-foreground font-normal">× {i.qty_kg} kg</span>
                            </div>
                          </div>
                          <span className="font-semibold">{inr(i.price * i.qty_kg)}</span>
                        </li>
                      ))}
                    </ul>
                    {o.cutting_instructions && (
                      <div className="mt-2 rounded-lg bg-primary/5 p-2 text-xs">
                        <span className="font-semibold">✂ Cutting:</span> {o.cutting_instructions}
                      </div>
                    )}
                    {o.promo_code && Number(o.discount) > 0 && (
                      <div className="mt-2 text-xs text-success">
                        <span className="font-semibold">🏷 Promo {o.promo_code}:</span> −{inr(o.discount)}
                      </div>
                    )}
                    <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                      Delivering to: {o.address_line1}
                      {o.address_line2 ? `, ${o.address_line2}` : ""}, {o.city} - {o.pincode}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Payment: {o.payment_method === "cod" ? "Cash on Delivery" : "Online"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
