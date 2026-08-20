import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";
import {
  Phone,
  Mail,
  MapPin,
  Package,
  LogOut,
  ShieldCheck,
  Pencil,
  Check,
  HelpCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Shield,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My Profile — JRG Chicken" }] }),
  component: Profile,
});

export function Profile() {
  const { user, isAdmin, signOut } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ full_name: "", phone: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
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
  }, [user?.id]);

  const avatarInitial = useMemo(() => {
    const n = (form.full_name || user?.full_name || "").trim();
    if (n) return n[0].toUpperCase();
    if (user?.email) return user.email[0].toUpperCase();
    return "S";
  }, [form.full_name, user]);

  const displayName = useMemo(() => {
    return form.full_name || user?.full_name || "Customer";
  }, [form.full_name, user]);

  const memberSince = useMemo(() => {
    const d = user?.created_at ? new Date(user.created_at) : new Date("2026-08-01");
    return d.toLocaleString("en-IN", { month: "short", year: "numeric" });
  }, [user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await apiClient.user.updateProfile({ full_name: form.full_name, phone: form.phone });
      setLoading(false);
      toast.success("Profile updated successfully");
      setEditing(false);
    } catch (err: any) {
      setLoading(false);
      toast.error(err?.message || "Failed to update profile");
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] dark:bg-background">
      <Navbar />

      <main className="mx-auto max-w-lg px-4 py-5 pb-28 space-y-4">
        {/* 1. Profile Information Card (Matching reference screenshot) */}
        <div className="rounded-3xl border border-border/50 bg-card p-5 shadow-sm">
          <div className="flex items-start gap-4">
            {/* Red rounded square avatar */}
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-md">
              {avatarInitial}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                MY PROFILE
              </div>
              <h1 className="mt-0.5 truncate font-display text-xl font-bold text-foreground">
                {displayName}
              </h1>

              {/* Verified Badge */}
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Verified</span>
              </div>

              {/* Phone, Email, Member Since */}
              <div className="mt-2.5 space-y-1 text-xs text-muted-foreground">
                {(form.phone || user?.phone) && (
                  <div className="flex items-center gap-2 truncate">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                    <span>{form.phone || user?.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 truncate">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                  <span className="truncate">{form.email || user?.email}</span>
                </div>
                <div className="pt-0.5 text-[11px] text-muted-foreground/80">
                  Member since {memberSince}
                </div>
              </div>
            </div>
          </div>

          {/* Edit Profile Button */}
          <button
            onClick={() => setEditing(!editing)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-border/80 bg-amber-50/50 dark:bg-secondary/40 py-2.5 text-xs font-semibold text-foreground transition hover:bg-amber-100/50 active:scale-[0.99]"
          >
            {editing ? (
              <>
                <X className="h-3.5 w-3.5" />
                <span>Close form</span>
              </>
            ) : (
              <>
                <Pencil className="h-3.5 w-3.5" />
                <span>Edit profile</span>
              </>
            )}
          </button>
        </div>

        {/* 2. Edit Profile Form Section */}
        {editing && (
          <div className="rounded-3xl border border-primary/20 bg-card p-5 shadow-sm animate-in fade-in duration-200">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" /> Edit Profile Information
            </h3>
            <form onSubmit={saveProfile} className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Full Name</Label>
                <Input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Enter full name"
                  className="mt-1 h-10 rounded-xl text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Mobile Phone</Label>
                <Input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Enter 10-digit phone"
                  className="mt-1 h-10 rounded-xl text-sm"
                />
              </div>
              <div className="pt-1 flex gap-2">
                <Button type="submit" disabled={loading} className="flex-1 h-10 rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-sm">
                  <Check className="mr-1.5 h-4 w-4" />
                  {loading ? "Saving…" : "Save changes"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditing(false)} className="h-10 rounded-xl text-xs">
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* 3. Orders & Addresses Summary Cards (2 Column Grid) */}
        <div className="grid grid-cols-2 gap-3">
          {/* Orders Card */}
          <Link
            to="/orders"
            className="group rounded-3xl border border-border/50 bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-100/80 dark:bg-rose-950/40 text-primary">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <div className="font-display text-2xl font-black text-foreground">{stats.orders}</div>
                <div className="text-xs font-medium text-muted-foreground">Orders</div>
              </div>
            </div>
          </Link>

          {/* Addresses Card */}
          <Link
            to="/addresses"
            className="group rounded-3xl border border-border/50 bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-100/80 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <div className="font-display text-2xl font-black text-foreground">{stats.addresses}</div>
                <div className="text-xs font-medium text-muted-foreground">Addresses</div>
              </div>
            </div>
          </Link>
        </div>

        {/* 4. Role-Gated Admin Dashboard Card (Visible ONLY for Admin role) */}
        {isAdmin && (
          <Link
            to="/admin"
            className="group flex items-center gap-3 rounded-3xl border border-primary/30 bg-primary/5 p-4 shadow-sm transition hover:bg-primary/10 active:scale-[0.99]"
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Shield className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-primary">Admin Dashboard</div>
              <div className="text-xs text-muted-foreground">Manage orders, products & users</div>
            </div>
          </Link>
        )}

        {/* 5. Help & Support Expandable Card */}
        <div className="rounded-3xl border border-border/50 bg-card p-4 shadow-sm transition">
          <button
            onClick={() => setHelpOpen(!helpOpen)}
            className="flex w-full items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blue-100/80 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">Help & Support</div>
                <div className="text-xs text-muted-foreground">Contact customer assistance</div>
              </div>
            </div>
            {helpOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {helpOpen && (
            <div className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground space-y-2 animate-in fade-in duration-200">
              <p className="leading-relaxed">
                Need help with your order or account? Our support team is ready to assist you!
              </p>
              <div>
                <a
                  href="tel:7659018774"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 px-3.5 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 transition hover:bg-emerald-200"
                >
                  <Phone className="h-4 w-4" />
                  <span>Call: 7659018774</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* 6. Terms & Conditions Card */}
        <Link
          to="/terms"
          className="flex items-center justify-between rounded-3xl border border-border/50 bg-card p-4 shadow-sm transition hover:border-primary/40 active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">Terms & Conditions</div>
              <div className="text-xs text-muted-foreground">Read terms & privacy policies</div>
            </div>
          </div>
        </Link>

        {/* 7. Sign Out Card */}
        <button
          onClick={async () => {
            await signOut();
            nav({ to: "/" });
          }}
          className="flex w-full items-center gap-3.5 rounded-3xl border border-border/50 bg-card p-4 text-left shadow-sm transition hover:border-destructive/40 active:scale-[0.99]"
        >
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-100/80 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
            <LogOut className="h-6 w-6" />
          </div>
          <div>
            <div className="text-base font-bold text-foreground">Sign out</div>
            <div className="text-xs text-muted-foreground">End this session</div>
          </div>
        </button>
      </main>
    </div>
  );
}
