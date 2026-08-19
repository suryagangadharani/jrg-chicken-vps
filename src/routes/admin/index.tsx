import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { realtime } from "@/lib/realtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inr, dateFmt, statusLabel } from "@/lib/format";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { ShoppingBag, Users, Eye, TrendingUp, IndianRupee as Rupee } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  ssr: false,
  component: AdminDashboard,
});

function AdminDashboard() {
  const [stats, setStats] = useState({ orders: 0, revenue: 0, visitsToday: 0, visitsTotal: 0, users: 0, pending: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [chart, setChart] = useState<any[]>([]);

  const loadData = async () => {
    try {
      const [adminStats, allOrders, users, visitStats] = await Promise.all([
        apiClient.admin.getStats().catch(() => null),
        apiClient.admin.getOrders().catch(() => []),
        apiClient.admin.getUsers().catch(() => []),
        apiClient.admin.visits.getStats().catch(() => ({ today: 0, total: 0 })),
      ]);

      const ordersList = Array.isArray(allOrders) ? allOrders : [];
      const revenue = ordersList.filter((o: any) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total || 0), 0);
      const pendingCount = ordersList.filter((o: any) => ["placed", "confirmed", "preparing"].includes(o.status)).length;

      setStats({
        orders: adminStats?.totalOrders ?? ordersList.length,
        revenue: adminStats?.totalRevenue ?? revenue,
        visitsToday: visitStats?.today || 0,
        visitsTotal: visitStats?.total || 0,
        users: Array.isArray(users) ? users.length : 0,
        pending: adminStats?.pendingOrders ?? pendingCount,
      });

      setRecent(ordersList.slice(0, 8));

      // Last 7 days chart
      const days = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0, 0, 0, 0);
        return { day: d.toLocaleDateString("en-IN", { weekday: "short" }), date: d, orders: 0, revenue: 0 };
      });

      ordersList.forEach((o: any) => {
        const od = new Date(o.created_at);
        od.setHours(0, 0, 0, 0);
        const bucket = days.find((d) => d.date.getTime() === od.getTime());
        if (bucket) {
          bucket.orders += 1;
          if (o.status !== "cancelled") bucket.revenue += Number(o.total || 0);
        }
      });
      setChart(days);
    } catch {}
  };

  useEffect(() => {
    loadData();

    const unsubscribeCreated = realtime.subscribe("ORDER_CREATED", () => {
      loadData();
    });
    const unsubscribeUpdated = realtime.subscribe("ORDER_UPDATED", () => {
      loadData();
    });

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
    };
  }, []);

  const cards = [
    { label: "Total Orders", value: stats.orders, icon: ShoppingBag, tone: "bg-primary/10 text-primary" },
    { label: "Revenue", value: inr(stats.revenue), icon: Rupee, tone: "bg-success/10 text-success" },
    { label: "Today's Visits", value: stats.visitsToday.toLocaleString("en-IN"), icon: Eye, tone: "bg-accent text-accent-foreground" },
    { label: "Total Visits", value: stats.visitsTotal.toLocaleString("en-IN"), icon: TrendingUp, tone: "bg-warning/20 text-warning-foreground" },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Dashboard</h1>
      <p className="text-sm text-muted-foreground">Live view of orders, revenue and site activity.</p>

      <TodayPriceCard />

      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-3 shadow-card sm:p-4">
            <div className={`grid h-8 w-8 place-items-center rounded-lg sm:h-9 sm:w-9 ${c.tone}`}>
              <c.icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="mt-2 text-lg font-bold sm:text-2xl">{c.value}</div>
            <div className="text-[11px] text-muted-foreground sm:text-xs">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card lg:col-span-2">
          <h2 className="font-semibold">Last 7 days</h2>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: any, name) => (name === "revenue" ? inr(v) : v)} />
                <Line type="monotone" dataKey="orders" stroke="var(--primary)" strokeWidth={2} />
                <Line type="monotone" dataKey="revenue" stroke="var(--primary-glow)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-semibold">Recent Orders</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {recent.length === 0 && <li className="text-muted-foreground">No orders yet.</li>}
            {recent.map((o, i) => (
              <li key={i} className="flex justify-between gap-2 border-b border-border/50 pb-2 last:border-0">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{o.customer_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {dateFmt(o.created_at)} · {statusLabel[o.status]}
                  </div>
                </div>
                <div className="font-bold text-primary">{inr(o.total)}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
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
    <div className="mt-5 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-accent/20 p-4 shadow-card sm:p-5">
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <Rupee className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold">Today's meat price</h2>
          <p className="text-xs text-muted-foreground">
            Pick a category and set today's price per kg — updates every product in that category.
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
                active ? "border-primary bg-primary/10 shadow-elegant" : "border-border bg-card hover:border-primary/40"
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
                <span className="text-sm font-semibold">{c.name}</span>
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
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
          <Input
            type="number"
            min={0}
            step="1"
            placeholder={selectedCat ? `Enter price per kg for ${selectedCat.name}` : "Enter price per kg"}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="pl-7"
          />
        </div>
        <Button onClick={apply} disabled={saving || !price || !selected} className="bg-hero shadow-elegant">
          {saving ? "Applying…" : current ? `Apply to ${current.count} products` : "Apply"}
        </Button>
      </div>
    </div>
  );
}
