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
  CheckCircle2,
  Package,
  Clock,
  Navigation,
  Check,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SoundUnlockBanner } from "@/components/SoundUnlockBanner";

export const Route = createFileRoute("/delivery/")({
  component: DeliveryDashboardPage,
});

function DeliveryDashboardPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");

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
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["delivery-orders"] });
      toast.success(`Order ${updated.order_number} status updated to ${updated.status.toUpperCase()}`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update order status");
    },
  });

  const activeOrders = orders.filter((o: any) =>
    ["placed", "confirmed", "out_for_delivery"].includes(o.status)
  );

  const completedOrders = orders.filter((o: any) =>
    ["delivered", "cancelled"].includes(o.status)
  );

  const displayOrders = activeTab === "active" ? activeOrders : completedOrders;

  const handleNextStatus = (order: any) => {
    let nextStatus = "";
    if (order.status === "placed") nextStatus = "confirmed";
    else if (order.status === "confirmed") nextStatus = "out_for_delivery";
    else if (order.status === "out_for_delivery") nextStatus = "delivered";

    if (nextStatus) {
      updateStatusMutation.mutate({ id: order.id, status: nextStatus });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "placed":
        return <Badge className="bg-amber-500 text-white hover:bg-amber-600">New Order</Badge>;
      case "confirmed":
        return <Badge className="bg-blue-500 text-white hover:bg-blue-600">Confirmed</Badge>;
      case "out_for_delivery":
        return <Badge className="bg-indigo-600 text-white animate-pulse">Out for Delivery</Badge>;
      case "delivered":
        return <Badge className="bg-emerald-600 text-white">Delivered</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <SoundUnlockBanner />
      {/* Mobile Tab Switcher */}
      <div className="grid grid-cols-2 rounded-2xl bg-secondary/80 p-1 text-sm font-medium">
        <button
          onClick={() => setActiveTab("active")}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 transition-all ${
            activeTab === "active"
              ? "bg-card text-primary font-bold shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Bike className="h-4 w-4" />
          Active Deliveries ({activeOrders.length})
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 transition-all ${
            activeTab === "completed"
              ? "bg-card text-primary font-bold shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          Completed ({completedOrders.length})
        </button>
      </div>

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
            {activeTab === "active" ? "No Pending Deliveries" : "No Completed Deliveries Yet"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {activeTab === "active"
              ? "New customer orders will automatically pop up here in real time."
              : "Completed and delivered orders will be archived here."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayOrders.map((order: any) => {
            const itemsList = Array.isArray(order.items) ? order.items : [];
            const fullAddress = `${order.address_line1}${
              order.address_line2 ? `, ${order.address_line2}` : ""
            }, ${order.city} ${order.pincode}`;

            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              fullAddress
            )}`;

            return (
              <div
                key={order.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3"
              >
                {/* Header: Order ID & Status */}
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      #{order.order_number || order.id.slice(0, 8)}
                    </span>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {dateFmt(order.created_at)}
                    </div>
                  </div>
                  {getStatusBadge(order.status)}
                </div>

                {/* Customer Info & Quick Action Buttons */}
                <div className="rounded-xl bg-secondary/50 p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">Customer</div>
                      <div className="font-bold text-sm text-foreground">{order.customer_name}</div>
                    </div>
                    {order.customer_phone && (
                      <a
                        href={`tel:${order.customer_phone}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Call
                      </a>
                    )}
                  </div>

                  {/* Delivery Address */}
                  <div className="border-t border-border/40 pt-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold flex items-center gap-1 text-primary">
                        <MapPin className="h-3.5 w-3.5" /> Delivery Address
                      </span>
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                      >
                        <Navigation className="h-3 w-3" /> Directions
                      </a>
                    </div>
                    <p className="mt-1 text-foreground font-medium leading-snug">
                      {order.address_line1}
                      {order.address_line2 ? `, ${order.address_line2}` : ""}
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      {order.city} - {order.pincode}
                    </p>
                    {order.landmark && (
                      <p className="mt-1 text-amber-600 dark:text-amber-400 text-[11px] font-medium">
                        Landmark: {order.landmark}
                      </p>
                    )}
                  </div>
                </div>

                {/* Order Items Summary */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                    <Package className="h-3.5 w-3.5" />
                    Items ({itemsList.length})
                  </div>
                  <div className="rounded-lg border border-border/50 p-2.5 space-y-1 bg-background">
                    {itemsList.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="font-medium text-foreground">
                          {item.name} <span className="text-muted-foreground">× {item.qty_kg} kg</span>
                        </span>
                        <span className="font-semibold">{inr((item.price || 0) * (item.qty_kg || 1))}</span>
                      </div>
                    ))}
                    <div className="border-t border-border pt-1.5 mt-1.5 flex justify-between items-center font-bold text-sm">
                      <span>Total ({order.payment_method === "cod" ? "Cash on Delivery" : "Paid Online"})</span>
                      <span className="text-primary text-base">{inr(order.total || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Action Stepper Button */}
                {activeTab === "active" && (
                  <div className="pt-1">
                    {order.status === "placed" && (
                      <Button
                        onClick={() => handleNextStatus(order)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2 py-3 rounded-xl"
                        disabled={updateStatusMutation.isPending}
                      >
                        <Check className="h-4 w-4" /> Confirm Order
                      </Button>
                    )}
                    {order.status === "confirmed" && (
                      <Button
                        onClick={() => handleNextStatus(order)}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2 py-3 rounded-xl"
                        disabled={updateStatusMutation.isPending}
                      >
                        <Bike className="h-4 w-4" /> Start Delivery (Out for Delivery)
                      </Button>
                    )}
                    {order.status === "out_for_delivery" && (
                      <Button
                        onClick={() => handleNextStatus(order)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 py-3 rounded-xl shadow-md"
                        disabled={updateStatusMutation.isPending}
                      >
                        <CheckCircle2 className="h-5 w-5" /> Mark as Delivered
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
