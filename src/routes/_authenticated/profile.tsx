import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";
import { Phone, Mail, MapPin, Package, LogOut, ShieldCheck, Pencil, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My Profile — JRG Chicken" }] }),
  component: Profile,
});

function Profile() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ full_name: "", phone: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [stats, setStats] = useState({ orders: 0, addresses: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const prof = await apiClient.user.getProfile();
        if (prof) {
          setForm({
            full_name: prof.full_name || "",
            phone: prof.phone || "",
            email: prof.email || user.email || "",
          });
        } else {
          setForm({ full_name: "", phone: "", email: user.email || "" });
        }

        const [myOrders, myAddresses] = await Promise.all([
          apiClient.orders.getMyOrders().catch(() => []),
          apiClient.user.getAddresses().catch(() => []),
        ]);
        setStats({
          orders: Array.isArray(myOrders) ? myOrders.length : 0,
          addresses: Array.isArray(myAddresses) ? myAddresses.length : 0,
        });
      } catch {}
    })();
  }, [user]);

  const initials = useMemo(() => {
    const n = (form.full_name || "").trim();
    if (n) return n.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
    return (form.phone || "U").slice(-2).toUpperCase();
  }, [form.full_name, form.phone]);

  const memberSince = useMemo(() => {
    const d = user?.created_at ? new Date(user.created_at) : null;
    return d ? d.toLocaleString("en-IN", { month: "short", year: "numeric" }) : "";
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await apiClient.user.updateProfile({ full_name: form.full_name, phone: form.phone });
      setLoading(false);
      toast.success("Profile updated");
      setEditing(false);
    } catch (err: any) {
      setLoading(false);
      toast.error(err?.message || "Failed to update profile");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-5 md:px-6 md:py-8">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-start gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-hero text-lg font-bold text-primary-foreground shadow-elegant">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">My Profile</div>
              <h1 className="mt-0.5 truncate text-lg font-bold leading-tight">{form.full_name || "Welcome"}</h1>
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                <ShieldCheck className="h-3 w-3" /> Verified
              </div>
              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                {form.phone && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Phone className="h-3 w-3 shrink-0" />
                    {form.phone}
                  </div>
                )}
                {form.email && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="h-3 w-3 shrink-0" />
                    {form.email}
                  </div>
                )}
              </div>
              {memberSince && <div className="mt-1 text-[10px] text-muted-foreground">Member since {memberSince}</div>}
            </div>
          </div>

          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="mt-3 w-full gap-2 text-xs">
              <Pencil className="h-3.5 w-3.5" /> Edit profile
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)} className="mt-3 w-full text-xs">
              Cancel
            </Button>
          )}
        </section>

        {editing && (
          <section className="mt-3 rounded-2xl border border-border bg-card p-4 shadow-card">
            <form onSubmit={save} className="space-y-3">
              <div>
                <Label className="text-xs">Full Name</Label>
                <Input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Your name"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="10-digit mobile"
                  className="h-9 text-sm"
                />
              </div>
              <Button type="submit" disabled={loading} size="sm" className="w-full gap-2 bg-hero text-xs shadow-elegant">
                <Check className="h-3.5 w-3.5" />
                {loading ? "Saving…" : "Save changes"}
              </Button>
            </form>
          </section>
        )}

        <section className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Link
            to="/orders"
            className="group rounded-2xl border border-border bg-card p-3 shadow-card transition hover:border-primary/40 hover:shadow-elegant"
          >
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <Package className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xl font-black">{stats.orders}</div>
                <div className="text-[11px] text-muted-foreground">Orders</div>
              </div>
            </div>
          </Link>
          <Link
            to="/addresses"
            className="group rounded-2xl border border-border bg-card p-3 shadow-card transition hover:border-primary/40 hover:shadow-elegant"
          >
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-foreground">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xl font-black">{stats.addresses}</div>
                <div className="text-[11px] text-muted-foreground">Addresses</div>
              </div>
            </div>
          </Link>
          <button
            onClick={async () => {
              await signOut();
              nav({ to: "/" });
            }}
            className="col-span-2 rounded-2xl border border-border bg-card p-3 text-left shadow-card transition hover:border-destructive/40 sm:col-span-1"
          >
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-destructive/10 text-destructive">
                <LogOut className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold">Sign out</div>
                <div className="text-[11px] text-muted-foreground">End this session</div>
              </div>
            </div>
          </button>
        </section>
      </main>
      <Footer />
    </div>
  );
}
