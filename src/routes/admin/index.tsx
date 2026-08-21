import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { realtime } from "@/lib/realtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inr, dateFmt, statusLabel, statusColor } from "@/lib/format";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { ShoppingBag, Bike, Eye, TrendingUp, IndianRupee as Rupee, Clock, ArrowRight, CheckCircle2, ChefHat, AlertTriangle, UtensilsCrossed, Users, Store } from "lucide-react";
import { computeStoreStatus, StoreStatus } from "@/lib/store-hours";

export const Route = createFileRoute("/admin/")({
  ssr: false,
  component: AdminDashboard,
});

function AdminDashboard() {
  const [stats, setStats] = useState({
    totalOrders: 0,
    todaysOrders: 0,
    totalRevenue: 0,
    todaysRevenue: 0,
    pendingOrders: 0,
    activeDeliveries: 0,
    registeredUsers: 0,
    websiteVisits: 0,
  });
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
    placed: 0,
    confirmed: 0,
    preparing: 0,
    out_for_delivery: 0,
    delivered: 0,
    cancelled: 0,
  });
  const [recent, setRecent] = useState<any[]>([]);
  const [chart, setChart] = useState<any[]>([]);
  const [storeStatus, setStoreStatus] = useState<StoreStatus>(() => computeStoreStatus());

  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      apiClient.storeStatus.get().then((st) => {
        if (st) setStoreStatus(st);
      }).catch(() => {});

      const [adminStats, ordersList, visitStats, usersList] = await Promise.all([
        apiClient.admin.getStats(),
        apiClient.admin.getOrders(),
        apiClient.admin.getVisits().catch(() => ({ today: 0, total: 0 })),
        apiClient.admin.getUsers().catch(() => []),
      ]);

      console.log("[Dashboard Data Loaded]", {
        adminStats,
        ordersCount: Array.isArray(ordersList) ? ordersList.length : 0,
        visitStats,
        usersCount: Array.isArray(usersList) ? usersList.length : 0,
      });

      const counts: Record<string, number> = {
        placed: 0,
        confirmed: 0,
        preparing: 0,
        out_for_delivery: 0,
        delivered: 0,
        cancelled: 0,
      };

      let todaysOrdersCount = 0;
      let todaysRevenueSum = 0;
      let totalRevSum = 0;
      let activeDeliveriesCount = 0;
      let pendingCount = 0;

      const todayStr = new Date().toDateString();
      const validOrders = Array.isArray(ordersList) ? ordersList : [];

      validOrders.forEach((o: any) => {
        if (counts[o.status] !== undefined) counts[o.status] += 1;
        if (o.status !== "cancelled") totalRevSum += Number(o.total || 0);

        const oDateStr = new Date(o.created_at).toDateString();
        if (oDateStr === todayStr) {
          todaysOrdersCount += 1;
          if (o.status !== "cancelled") todaysRevenueSum += Number(o.total || 0);
        }

        if (["placed", "confirmed", "preparing", "out_for_delivery"].includes(o.status)) {
          pendingCount += 1;
        }
        if (o.status === "out_for_delivery") {
          activeDeliveriesCount += 1;
        }
      });

      setStatusCounts(counts);

      setStats({
        totalOrders: adminStats?.totalOrders ?? validOrders.length,
        todaysOrders: adminStats?.todaysOrders ?? todaysOrdersCount,
        totalRevenue: adminStats?.totalRevenue ?? totalRevSum,
        todaysRevenue: adminStats?.todaysRevenue ?? todaysRevenueSum,
        pendingOrders: adminStats?.pendingOrders ?? pendingCount,
        activeDeliveries: activeDeliveriesCount,
        registeredUsers: adminStats?.registeredUsers ?? (Array.isArray(usersList) ? usersList.length : 0),
        websiteVisits: adminStats?.websiteVisits ?? (visitStats?.total || visitStats?.today || 0),
      });

      setRecent(validOrders.slice(0, 8));

      // Last 7 days chart
      const days = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0, 0, 0, 0);
        return { day: d.toLocaleDateString("en-IN", { weekday: "short" }), date: d, orders: 0, revenue: 0 };
      });

      validOrders.forEach((o: any) => {
        const od = new Date(o.created_at);
        od.setHours(0, 0, 0, 0);
        const bucket = days.find((d) => d.date.getTime() === od.getTime());
        if (bucket) {
          bucket.orders += 1;
          if (o.status !== "cancelled") bucket.revenue += Number(o.total || 0);
        }
      });
      setChart(days);
      setDataError(null);
    } catch (err: any) {
      console.error("[Dashboard Load Error]:", err);
      setDataError(err?.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // 3-second auto-polling for instant live order & revenue updates
    const pollInterval = setInterval(() => {
      loadData();
    }, 3000);

    const unsubscribeCreated = realtime.subscribe("ORDER_CREATED", () => {
      loadData();
    });
    const unsubscribeUpdated = realtime.subscribe("ORDER_UPDATED", () => {
      loadData();
    });
    const unsubscribeStoreStatus = realtime.subscribe("STORE_STATUS_UPDATED", (payload: any) => {
      if (payload) setStoreStatus(payload);
    });

    return () => {
      clearInterval(pollInterval);
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeStoreStatus();
    };
  }, []);

  const summaryCards = [
    { label: "Total Orders", value: stats.totalOrders, icon: ShoppingBag, tone: "bg-rose-100/80 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400" },
    { label: "Revenue", value: inr(stats.totalRevenue), icon: Rupee, tone: "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400" },
    { label: "Pending Orders", value: stats.pendingOrders, icon: TrendingUp, tone: "bg-amber-100/80 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400" },
    { label: "Registered Users", value: stats.registeredUsers, icon: Users, tone: "bg-orange-100/80 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400" },
    { label: "Website Visits", value: stats.websiteVisits, icon: Eye, tone: "bg-amber-100/80 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of sales, real-time orders, and store activity.</p>
        </div>

        {/* Live Admin Store Status Badge (Section 18) */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-xs ${
              storeStatus.badgeColor === "emerald"
                ? "bg-emerald-100 text-emerald-800 border border-emerald-500/30"
                : storeStatus.badgeColor === "amber"
                ? "bg-amber-100 text-amber-800 border border-amber-500/30"
                : "bg-rose-100 text-rose-800 border border-rose-500/30"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${
              storeStatus.badgeColor === "emerald" ? "bg-emerald-500 animate-pulse" : storeStatus.badgeColor === "amber" ? "bg-amber-500" : "bg-rose-500"
            }`} />
            {storeStatus.status === "open" ? "🟢 Orders Open" : storeStatus.status === "lunch_break" ? "🟠 Lunch Break Active" : "🔴 Orders Closed"}
          </span>
        </div>
      </div>

      {/* ERROR BANNER IF DATA FETCH FAILS */}
      {dataError && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-800 dark:text-rose-300 flex items-center justify-between text-xs font-semibold">
          <span>⚠️ Unable to load dashboard data: {dataError}</span>
          <Button size="sm" variant="outline" onClick={loadData} className="text-xs font-bold rounded-xl h-8">
            Retry
          </Button>
        </div>
      )}

      {/* 1. Today's Meat Price Updater Box */}
      <TodayPriceCard />

      {/* 2. Side-by-Side Store Hours & Lunch Break Control Box */}
      <StoreAndLunchControls storeStatus={storeStatus} onStatusChange={setStoreStatus} />

      {/* 3. Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {summaryCards.map((c) => (
          <div key={c.label} className="rounded-3xl border border-border/60 bg-card p-5 shadow-xs flex flex-col justify-between gap-3 transition hover:shadow-md">
            <div className={`grid h-11 w-11 place-items-center rounded-2xl ${c.tone}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-2xl font-black text-foreground">
                {loading ? <span className="animate-pulse opacity-40">---</span> : c.value}
              </div>
              <div className="mt-0.5 text-xs font-semibold text-muted-foreground">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Order Status Breakdown */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
        <h2 className="font-display text-base font-bold text-foreground">Order Status Overview</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <StatusCountChip label="New Placed" count={statusCounts.placed} color="bg-amber-500/10 text-amber-700 border-amber-500/20" />
          <StatusCountChip label="Confirmed" count={statusCounts.confirmed} color="bg-blue-500/10 text-blue-700 border-blue-500/20" />
          <StatusCountChip label="Preparing" count={statusCounts.preparing} color="bg-orange-500/10 text-orange-700 border-orange-500/20" />
          <StatusCountChip label="Out for Delivery" count={statusCounts.out_for_delivery} color="bg-indigo-500/10 text-indigo-700 border-indigo-500/20" />
          <StatusCountChip label="Delivered" count={statusCounts.delivered} color="bg-emerald-500/10 text-emerald-700 border-emerald-500/20" />
          <StatusCountChip label="Cancelled" count={statusCounts.cancelled} color="bg-red-500/10 text-red-700 border-red-500/20" />
        </div>
      </div>

      {/* Chart & Recent Orders */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-foreground">Revenue & Orders (Last 7 Days)</h2>
          </div>
          <div className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: any, name) => (name === "revenue" ? inr(v) : v)} />
                <Line type="monotone" dataKey="orders" stroke="#c53030" strokeWidth={2} name="Orders" />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-foreground">Recent Orders</h2>
            <Link to="/admin/orders" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-3 divide-y divide-border/60">
            {recent.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">No recent orders found.</div>
            )}
            {recent.map((o: any) => (
              <div key={o.id} className="pt-3 first:pt-0 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-bold text-xs text-foreground truncate">{o.customer_name || "Customer"}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${statusColor[o.status] || ""}`}>
                      {statusLabel[o.status]}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <span>#{o.order_number || o.id.slice(0, 8)}</span>
                    <span>·</span>
                    <span>{dateFmt(o.created_at)}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-xs text-primary">{inr(o.total || 0)}</div>
                  <Link
                    to="/admin/orders"
                    className="inline-flex items-center text-[10px] font-semibold text-primary hover:underline"
                  >
                    Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusCountChip({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`rounded-xl border p-3 flex flex-col justify-between ${color}`}>
      <span className="text-[11px] font-medium opacity-90">{label}</span>
      <span className="text-lg font-bold mt-1">{count}</span>
    </div>
  );
}

function TodayPriceCard() {
  const [categories, setCategories] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [prices, setPrices] = useState<Record<string, { min: number; max: number; count: number }>>({});

  const loadAll = async () => {
    try {
      const cats = await apiClient.categories.getAll();
      setCategories(Array.isArray(cats) ? cats : []);
      if (cats && cats.length && !selected) setSelected(cats[0].id);

      const prods = await apiClient.products.getAll();
      const map: Record<string, { min: number; max: number; count: number }> = {};
      (Array.isArray(prods) ? prods : []).forEach((p: any) => {
        if (!p.category_id) return;
        const v = Number(p.price_per_kg);
        const e = map[p.category_id];
        if (!e) map[p.category_id] = { min: v, max: v, count: 1 };
        else {
          e.min = Math.min(e.min, v);
          e.max = Math.max(e.max, v);
          e.count += 1;
        }
      });
      setPrices(map);
    } catch {}
  };

  useEffect(() => {
    loadAll();
  }, []);

  const current = prices[selected];
  const selectedCat = categories.find((c) => c.id === selected);

  const apply = async () => {
    const v = parseFloat(price);
    if (isNaN(v) || v <= 0) return toast.error("Enter a valid price");
    if (!selectedCat) return toast.error("Select a category");
    if (!confirm(`Update all ${selectedCat.name} products to ₹${v}/kg?`)) return;

    setSaving(true);
    try {
      await apiClient.admin.updateCategoryPrice(selected, v);
      setSaving(false);
      toast.success(`${selectedCat.name} products updated to ₹${v}/kg`);
      setPrice("");
      loadAll();
    } catch (err: any) {
      setSaving(false);
      toast.error(err?.message || "Failed to update prices");
    }
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2.5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Rupee className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-foreground">Today's Meat Price Updater</h2>
          <p className="text-xs text-muted-foreground">
            Select a category to set today's price per kg across all matching items.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {categories.map((c) => {
          const active = selected === c.id;
          const p = prices[c.id];
          return (
            <label
              key={c.id}
              className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-left transition ${
                active ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="tdy-category"
                  checked={active}
                  onChange={() => setSelected(c.id)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-xs font-bold text-foreground truncate">{c.name}</span>
              </div>
              <span className="pl-6 text-[11px] text-muted-foreground">
                {p ? (p.min === p.max ? inr(p.min) : `${inr(p.min)} – ${inr(p.max)}`) : "No products"}
                {p ? ` · ${p.count}` : ""}
              </span>
            </label>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
          <Input
            type="number"
            min={0}
            step="1"
            placeholder={selectedCat ? `Enter price per kg for ${selectedCat.name}` : "Enter price per kg"}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="pl-7 rounded-xl"
          />
        </div>
        <Button onClick={apply} disabled={saving || !price || !selected} className="bg-primary text-primary-foreground font-bold shadow-sm rounded-xl">
          {saving ? "Applying…" : current ? `Apply to ${current.count} products` : "Apply"}
        </Button>
      </div>
    </div>
  );
}

function StoreAndLunchControls({ storeStatus, onStatusChange }: { storeStatus: StoreStatus; onStatusChange: (st: StoreStatus) => void }) {
  const [updatingLunch, setUpdatingLunch] = useState(false);
  const [updatingStore, setUpdatingStore] = useState(false);
  const [confirmModal, setConfirmModal] = useState<"open" | "close" | null>(null);

  const isStoreOpen = storeStatus?.status !== "closed" && storeStatus?.storeOrderingEnabled !== false;
  const isLunchOn = storeStatus?.status === "lunch_break" || Boolean(storeStatus?.manualLunchOverride);

  const handleOpenStore = async () => {
    setConfirmModal(null);
    setUpdatingStore(true);
    try {
      const updated = await apiClient.admin.updateStoreStatus({ storeOrderingEnabled: true });
      if (updated) onStatusChange(updated);
      toast.success("🟢 Store opened. New orders are now enabled.");
    } catch (err: any) {
      toast.error("Failed to open store");
    } finally {
      setUpdatingStore(false);
    }
  };

  const handleCloseStore = async () => {
    setConfirmModal(null);
    setUpdatingStore(true);
    try {
      const updated = await apiClient.admin.updateStoreStatus({ storeOrderingEnabled: false });
      if (updated) onStatusChange(updated);
      toast.success("🔴 Store closed. New orders are now paused.");
    } catch (err: any) {
      toast.error("Failed to close store");
    } finally {
      setUpdatingStore(false);
    }
  };

  const toggleManualLunch = async () => {
    const nextState = !isLunchOn;
    setUpdatingLunch(true);
    try {
      const updated = await apiClient.admin.updateStoreStatus({ manualLunchBreak: nextState });
      if (updated) onStatusChange(updated);
      toast.success(nextState ? "🍽️ Lunch break enabled. New orders are paused." : "🟢 Lunch break disabled. Normal ordering resumed.");
    } catch (err: any) {
      toast.error("Failed to update lunch break status");
    } finally {
      setUpdatingLunch(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 1. STORE ORDERING CONTROL */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary font-bold">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground">🏪 Store Ordering</h3>
                <p className="text-[11px] text-muted-foreground">Normal timing: 6:00 AM – 8:00 PM IST</p>
              </div>
            </div>

            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              isStoreOpen ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
            }`}>
              {isStoreOpen ? "🟢 Orders Open" : "🔴 Orders Closed"}
            </span>
          </div>

          {/* TWO CLEAR BUTTONS: OPEN STORE / CLOSE STORE */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              disabled={updatingStore}
              onClick={() => isStoreOpen ? null : setConfirmModal("open")}
              className={`rounded-xl text-xs font-bold py-2.5 transition h-10 ${
                isStoreOpen
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-600/30 font-extrabold"
                  : "bg-secondary hover:bg-secondary/80 text-muted-foreground border border-border"
              }`}
            >
              🟢 OPEN STORE
            </Button>

            <Button
              type="button"
              disabled={updatingStore}
              onClick={() => !isStoreOpen ? null : setConfirmModal("close")}
              className={`rounded-xl text-xs font-bold py-2.5 transition h-10 ${
                !isStoreOpen
                  ? "bg-rose-600 hover:bg-rose-700 text-white shadow-sm ring-2 ring-rose-600/30 font-extrabold"
                  : "bg-secondary hover:bg-secondary/80 text-muted-foreground border border-border"
              }`}
            >
              🔴 CLOSE STORE
            </Button>
          </div>
        </div>

        {/* 2. LUNCH BREAK CONTROL */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-bold ${
              isLunchOn ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-secondary text-muted-foreground"
            }`}>
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-foreground truncate">🍽️ Lunch Break</h3>
                {isLunchOn ? (
                  <span className="rounded-full bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                    PAUSED
                  </span>
                ) : (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    NORMAL
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                Schedule: <strong>2:00 PM – 4:00 PM IST</strong>
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={toggleManualLunch}
            disabled={updatingLunch}
            className={`rounded-xl text-xs font-bold px-3.5 py-2 shadow-sm transition shrink-0 ${
              isLunchOn
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-secondary hover:bg-secondary/80 text-foreground border border-border"
            }`}
          >
            {updatingLunch ? "Updating…" : isLunchOn ? "ON — Orders Paused" : "OFF — Normal"}
          </Button>
        </div>
      </div>

      {/* CONFIRMATION MODALS (Requirement 16) */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="space-y-1.5">
              <h3 className="font-bold text-lg text-foreground">
                {confirmModal === "open" ? "Open Store?" : "Close Store?"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {confirmModal === "open"
                  ? "Customers will be able to place new orders immediately."
                  : "New customers will not be able to place orders."}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setConfirmModal(null)}
                className="rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmModal === "open" ? handleOpenStore : handleCloseStore}
                className={`rounded-xl text-xs font-bold text-white ${
                  confirmModal === "open" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {confirmModal === "open" ? "Open Store" : "Close Store"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

