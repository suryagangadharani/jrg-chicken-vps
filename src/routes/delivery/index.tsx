import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";
import { inr, dateFmt } from "@/lib/format";
import { toast } from "sonner";
import {
  Bike,
  Phone,
  MapPin,
  Clock,
  Navigation,
  Package,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SoundUnlockBanner } from "@/components/SoundUnlockBanner";

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

type StatusFilter = "all" | "placed" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All Orders" },
  { id: "placed", label: "New Orders" },
  { id: "confirmed", label: "Confirmed" },
  { id: "preparing", label: "Preparing" },
  { id: "out_for_delivery", label: "Out for Delivery" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

export const Route = createFileRoute("/delivery/")({
  component: DeliveryDashboardPage,
});

function DeliveryDashboardPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Subscribe to real-time WebSocket order changes
  useRealtimeOrders();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["delivery-orders"],
    queryFn: () => apiClient.delivery.getOrders(),
    refetchInterval: 10000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.delivery.updateOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-orders"] });
      toast.success("Order status updated successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update order status");
    },
  });

  const deleteSingleOrderMutation = useMutation({
    mutationFn: (id: string) => apiClient.delivery.deleteOrder(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["delivery-orders"] });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deletedId);
        return next;
      });
      toast.success("Order deleted successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete order");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => apiClient.delivery.bulkDeleteOrders(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-orders"] });
      setSelectedIds(new Set());
      toast.success("Selected orders deleted successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete orders");
    },
  });

  // Calculate dynamic status counts
  const counts: Record<StatusFilter, number> = {
    all: orders.length,
    placed: orders.filter((o: any) => o.status === "placed").length,
    confirmed: orders.filter((o: any) => o.status === "confirmed").length,
    preparing: orders.filter((o: any) => o.status === "preparing").length,
    out_for_delivery: orders.filter((o: any) => o.status === "out_for_delivery").length,
    delivered: orders.filter((o: any) => o.status === "delivered").length,
    cancelled: orders.filter((o: any) => o.status === "cancelled").length,
  };

  // Filter orders dynamically based on selected status tab
  const displayOrders = statusFilter === "all"
    ? orders
    : orders.filter((o: any) => o.status === statusFilter);

  const displayOrderIds = displayOrders.map((o: any) => o.id);
  const isAllSelected = displayOrders.length > 0 && displayOrders.every((o: any) => selectedIds.has(o.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        displayOrderIds.forEach((id: string) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        displayOrderIds.forEach((id: string) => next.add(id));
        return next;
      });
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "placed":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-1 text-xs rounded-full shadow-sm">New Order</Badge>;
      case "confirmed":
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1 text-xs rounded-full shadow-sm">Confirmed</Badge>;
      case "preparing":
        return <Badge className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1 text-xs rounded-full shadow-sm">Preparing</Badge>;
      case "out_for_delivery":
        return <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1 text-xs rounded-full shadow-sm animate-pulse">Out for Delivery</Badge>;
      case "delivered":
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1 text-xs rounded-full shadow-sm">Delivered ✅</Badge>;
      case "cancelled":
        return <Badge variant="destructive" className="font-bold px-3 py-1 text-xs rounded-full shadow-sm">Cancelled ❌</Badge>;
      default:
        return <Badge variant="outline" className="font-bold px-3 py-1 text-xs rounded-full">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <SoundUnlockBanner />

      {/* Horizontally Scrollable Responsive Mobile Status Filter Navigation */}
      <div className="overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        <div className="flex items-center gap-2 min-w-max">
          {STATUS_TABS.map((tab) => {
            const isActive = statusFilter === tab.id;
            const count = counts[tab.id] || 0;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20 font-bold"
                    : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground border border-border"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bulk Delete & Select Bar */}
      {displayOrders.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-foreground">
            <Checkbox checked={isAllSelected} onCheckedChange={toggleSelectAll} />
            <span>Select All Visible ({displayOrders.length})</span>
          </label>

          {selectedIds.size > 0 && (
            <ConfirmDialog
              title={`Delete ${selectedIds.size} selected order(s)?`}
              description="This will permanently delete the selected orders from database and delivery page."
              confirmLabel={`Delete (${selectedIds.size})`}
              onConfirm={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
            >
              <Button variant="destructive" size="sm" className="h-8 text-xs font-bold shadow-sm">
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete Selected ({selectedIds.size})
              </Button>
            </ConfirmDialog>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading assigned orders...
        </div>
      ) : displayOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-3 bg-card/50">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Bike className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-base">
            No orders in "{STATUS_TABS.find((t) => t.id === statusFilter)?.label}"
          </h3>
          <p className="text-xs text-muted-foreground">
            {statusFilter === "all"
              ? "No assigned customer orders currently found."
              : "Orders will automatically appear here when updated to this status."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayOrders.map((order: any) => {
            const itemsList = Array.isArray(order.items) ? order.items : [];
            const isSelected = selectedIds.has(order.id);
            const fullAddress = `${order.address_line1}${
              order.address_line2 ? `, ${order.address_line2}` : ""
            }, ${order.city || "Jangareddygudem"} ${order.pincode}`;

            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              fullAddress
            )}`;

            return (
              <div
                key={order.id}
                className={`rounded-2xl border bg-card p-4 shadow-sm space-y-3 transition ${
                  isSelected ? "border-primary ring-1 ring-primary/30" : "border-border"
                }`}
              >
                {/* Header: Prominent Order ID & Status Badge with Select Checkbox */}
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelectOne(order.id)}
                    />
                    <div>
                      <span className="text-base sm:text-lg font-extrabold font-mono text-foreground tracking-tight">
                        #{order.order_number || order.id.slice(0, 8)}
                      </span>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 font-medium">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
                        {dateFmt(order.created_at)}
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(order.status)}
                </div>

                {/* Customer Info & Quick Action Buttons */}
                <div className="rounded-xl bg-secondary/50 p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">Customer Name</div>
                      <div className="font-bold text-sm text-foreground">{order.customer_name}</div>
                    </div>
                    {order.customer_phone && (
                      <a
                        href={`tel:${order.customer_phone}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Call Customer
                      </a>
                    )}
                  </div>

                  {/* Clean Full Delivery Address */}
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2 border-b border-primary/10 pb-2">
                      <span className="font-bold text-xs text-primary flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" /> Full Delivery Address
                      </span>
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
                      >
                        <Navigation className="h-3 w-3" /> Directions
                      </a>
                    </div>

                    <div className="space-y-1 pt-1 text-foreground">
                      <p className="font-semibold text-sm leading-snug">
                        🏠 {order.address_line1}
                      </p>
                      {order.address_line2 && (
                        <p className="text-muted-foreground font-medium">
                          🏢 {order.address_line2}
                        </p>
                      )}
                      <p className="font-medium text-muted-foreground">
                        📍 City: <span className="font-bold text-foreground">{order.city || "Jangareddygudem"}</span> | Pincode: <span className="font-bold text-foreground">{order.pincode}</span>
                      </p>
                      {order.landmark && (
                        <div className="mt-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 p-2 text-amber-700 dark:text-amber-300 font-semibold text-[11px]">
                          📍 Landmark: {order.landmark}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Order Items Summary with Category Badges */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                    <Package className="h-3.5 w-3.5" />
                    Ordered Items ({itemsList.length})
                  </div>
                  <div className="rounded-xl border border-border/60 p-3 space-y-2 bg-background">
                    {itemsList.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-border/40 last:border-0">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                            {item.name}
                            <span className="inline-block rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                              🏷 {getItemCategory(item)}
                            </span>
                          </span>
                          <span className="text-muted-foreground text-[11px]">Quantity: {item.qty_kg} kg</span>
                        </div>
                        <span className="font-bold text-foreground text-sm">{inr((item.price || 0) * (item.qty_kg || 1))}</span>
                      </div>
                    ))}
                    <div className="border-t border-border pt-2 mt-2 flex justify-between items-center font-bold text-sm">
                      <span>Total Payment ({order.payment_method === "cod" ? "Cash on Delivery" : "Paid Online"})</span>
                      <span className="text-primary text-base">{inr(order.total || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Interactive Status Selector Dropdown & Delete Order Button */}
                <div className="pt-2 border-t border-border/60 flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2">
                    <label htmlFor={`status-select-${order.id}`} className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                      Status:
                    </label>
                    <select
                      id={`status-select-${order.id}`}
                      value={order.status}
                      onChange={(e) => updateStatusMutation.mutate({ id: order.id, status: e.target.value })}
                      className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs font-bold text-foreground shadow-sm focus:ring-2 focus:ring-primary focus:outline-none transition cursor-pointer"
                      disabled={updateStatusMutation.isPending}
                    >
                      <option value="placed">New Order (Placed)</option>
                      <option value="confirmed">Order Confirmed</option>
                      <option value="preparing">Preparing Order</option>
                      <option value="out_for_delivery">Out for Delivery</option>
                      <option value="delivered">Delivered ✅</option>
                      <option value="cancelled">Cancelled ❌</option>
                    </select>
                  </div>

                  <ConfirmDialog
                    title={`Delete order #${order.order_number || order.id.slice(0, 8)}?`}
                    description="This will delete the order record permanently."
                    confirmLabel="Delete"
                    onConfirm={() => deleteSingleOrderMutation.mutate(order.id)}
                  >
                    <Button variant="outline" size="sm" className="h-10 border-destructive/40 text-destructive hover:bg-destructive/10 shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </ConfirmDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
