import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { realtime } from "@/lib/realtime";
import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";
import { inr, dateFmt, statusLabel, statusColor } from "@/lib/format";
import { Phone, MapPin, Bike } from "lucide-react";

const STATUSES = ["placed", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"];

function getItemCategory(item: any): string {
  if (item?.category_name) return item.category_name;
  if (item?.category) return item.category;
  const name = String(item?.name || "").toLowerCase();
  if (name.includes("skinless")) return "Skinless Chicken";
  if (name.includes("skin") || name.includes("with skin")) return "Chicken With Skin";
  if (name.includes("broiler")) return "Broiler Chicken";
  if (name.includes("layer")) return "Layer Chicken";
  if (name.includes("boneless")) return "Boneless Cut";
  if (name.includes("drumstick") || name.includes("leg")) return "Special Cut";
  return "Fresh Chicken";
}

export const Route = createFileRoute("/admin/orders")({
  ssr: false,
  component: AdminOrders,
});

function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");

  // Custom hook for automatic cache & realtime order state refresh
  useRealtimeOrders();

  const loadOrders = async () => {
    try {
      const data = await apiClient.admin.getOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch {}
  };

  useEffect(() => {
    loadOrders();

    const unsubscribeCreated = realtime.subscribe("ORDER_CREATED", () => {
      loadOrders();
    });
    const unsubscribeUpdated = realtime.subscribe("ORDER_UPDATED", () => {
      loadOrders();
    });

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
    };
  }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      await apiClient.admin.updateOrderStatus(id, status);
      setOrders((prev) => prev.map((o) => (o.id === id || o.order_number === id ? { ...o, status } : o)));
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status");
    }
  };

  const visible = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Orders</h1>
      <p className="text-sm text-muted-foreground">Manage and update delivery status. Live order alerts enabled.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <FilterChip label="All" active={filter === "all"} onClick={() => setFilter("all")} count={orders.length} />
        {STATUSES.map((s) => (
          <FilterChip
            key={s}
            label={statusLabel[s]}
            active={filter === s}
            onClick={() => setFilter(s)}
            count={orders.filter((o) => o.status === s).length}
          />
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {visible.length === 0 && <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">No orders here.</div>}
        {visible.map((o) => {
          const itemsList = Array.isArray(o.items) ? o.items : [];
          return (
            <div key={o.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{o.order_number || o.id}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusColor[o.status] || ""}`}>
                      {statusLabel[o.status]}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{o.payment_method === "cod" ? "COD" : "Online"}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{dateFmt(o.created_at)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-primary">{inr(o.total || 0)}</div>
                  <div className="text-xs text-muted-foreground">{itemsList.length} item(s)</div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-secondary/40 p-3 text-sm">
                  <div className="font-semibold">{o.customer_name || "Customer"}</div>
                  {o.customer_phone && (
                    <a href={`tel:${o.customer_phone}`} className="flex items-center gap-1 text-primary hover:underline">
                      <Phone className="h-3.5 w-3.5" />
                      {o.customer_phone}
                    </a>
                  )}
                  {o.customer_email && <div className="truncate text-xs text-muted-foreground">{o.customer_email}</div>}
                </div>
                <div className="rounded-xl bg-secondary/40 p-3 text-sm">
                  <div className="flex items-start gap-1">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      {o.address_line1}
                      {o.address_line2 ? `, ${o.address_line2}` : ""}, {o.city} - {o.pincode}
                      {o.landmark ? ` (${o.landmark})` : ""}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-border bg-secondary/20 p-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items</div>
                <ul className="mt-2 space-y-2">
                  {itemsList.map((i: any, idx: number) => (
                    <li key={idx} className="flex flex-wrap items-start justify-between gap-2 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground flex items-center flex-wrap gap-2">
                          <span className="font-semibold">{i.name}</span>
                          <span className="inline-block rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                            🏷 {getItemCategory(i)}
                          </span>
                          <span className="text-muted-foreground font-normal">× {i.qty_kg} kg</span>
                        </div>
                      </div>
                      <span className="font-semibold">{inr(i.price * i.qty_kg)}</span>
                    </li>
                  ))}
                </ul>
                {o.cutting_instructions && (
                  <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs">
                    <span className="font-semibold text-primary">✂ Cutting:</span> {o.cutting_instructions}
                  </div>
                )}
                {o.promo_code && Number(o.discount) > 0 && (
                  <div className="mt-2 text-xs text-success">
                    <span className="font-semibold">🏷 Promo {o.promo_code}:</span> −{inr(o.discount)}
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold text-muted-foreground">Update status:</label>
                <select
                  value={o.status}
                  onChange={(e) => updateStatus(o.id, e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick, count }: any) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40"
      }`}
    >
      {label} · {count}
    </button>
  );
}
