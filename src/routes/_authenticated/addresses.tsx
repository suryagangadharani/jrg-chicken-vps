import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";
import { MapPin, Trash2, Plus, Check, Home, Briefcase, Building } from "lucide-react";

export const Route = createFileRoute("/_authenticated/addresses")({
  head: () => ({ meta: [{ title: "Saved Addresses — JRG Chicken" }] }),
  component: AddressesPage,
});

function AddressesPage() {
  const { user } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    label: "Home",
    full_name: "",
    phone: "",
    line1: "",
    line2: "",
    city: "Jangareddygudem",
    pincode: "",
    landmark: "",
  });

  const load = async () => {
    if (!user) return;
    try {
      const data = await apiClient.user.getAddresses();
      setList(Array.isArray(data) ? data : []);
    } catch {}
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await apiClient.user.addAddress(form);
      toast.success("Address saved successfully");
      setShowForm(false);
      setForm({
        label: "Home",
        full_name: user.full_name || "",
        phone: user.phone || "",
        line1: "",
        line2: "",
        city: "Jangareddygudem",
        pincode: "",
        landmark: "",
      });
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save address");
    } finally {
      setLoading(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this saved address?")) return;
    try {
      await apiClient.user.deleteAddress(id);
      toast.success("Address deleted");
      load();
    } catch {
      toast.error("Failed to delete address");
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] dark:bg-background">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-6 pb-28 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Saved Delivery Addresses</h1>
            <p className="text-xs text-muted-foreground">Manage your delivery locations for faster checkout.</p>
          </div>
          <Button
            onClick={() => {
              setForm((f) => ({
                ...f,
                full_name: f.full_name || user?.full_name || "",
                phone: f.phone || user?.phone || "",
              }));
              setShowForm(!showForm);
            }}
            className="bg-primary text-xs font-bold text-primary-foreground shadow-sm rounded-xl"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            + Add New
          </Button>
        </div>

        {showForm && (
          <form
            onSubmit={add}
            className="rounded-3xl border border-primary/20 bg-card p-5 shadow-sm space-y-3 animate-in fade-in duration-200"
          >
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> Add New Address
            </h3>

            <div>
              <Label className="text-xs text-muted-foreground">Address Label</Label>
              <div className="mt-1.5 flex gap-2">
                {["Home", "Work", "Other"].map((lbl) => (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => setForm({ ...form, label: lbl })}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition flex items-center justify-center gap-1.5 ${
                      form.label === lbl
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-secondary/40 border-border text-foreground hover:bg-secondary"
                    }`}
                  >
                    {lbl === "Home" && <Home className="h-3.5 w-3.5" />}
                    {lbl === "Work" && <Briefcase className="h-3.5 w-3.5" />}
                    {lbl === "Other" && <Building className="h-3.5 w-3.5" />}
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">Full Name</Label>
                <Input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Enter full name"
                  className="mt-1 h-10 rounded-xl text-xs"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Phone Number</Label>
                <Input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="10-digit mobile"
                  className="mt-1 h-10 rounded-xl text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Street Address / Line 1</Label>
              <Input
                required
                value={form.line1}
                onChange={(e) => setForm({ ...form, line1: e.target.value })}
                placeholder="Door No / Street / Building Name"
                className="mt-1 h-10 rounded-xl text-xs"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Area / Colony / Line 2 (Optional)</Label>
              <Input
                value={form.line2}
                onChange={(e) => setForm({ ...form, line2: e.target.value })}
                placeholder="Area or Street continuation"
                className="mt-1 h-10 rounded-xl text-xs"
              />
            </div>

            <div className="grid gap-3 grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">City</Label>
                <Input
                  required
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="mt-1 h-10 rounded-xl text-xs"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Pincode</Label>
                <Input
                  required
                  value={form.pincode}
                  onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                  placeholder="534447"
                  className="mt-1 h-10 rounded-xl text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Landmark (Optional)</Label>
              <Input
                value={form.landmark}
                onChange={(e) => setForm({ ...form, landmark: e.target.value })}
                placeholder="e.g. Near Bus Stand, opposite SBI"
                className="mt-1 h-10 rounded-xl text-xs"
              />
            </div>

            <div className="pt-2 flex gap-2">
              <Button type="submit" disabled={loading} className="flex-1 h-10 rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-sm">
                <Check className="mr-1.5 h-4 w-4" />
                {loading ? "Saving…" : "Save Address"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="h-10 rounded-xl text-xs">
                Cancel
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {list.length === 0 && !showForm && (
            <div className="rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center space-y-2">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-700">
                <MapPin className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-sm text-foreground">No Saved Addresses Yet</h3>
              <p className="text-xs text-muted-foreground">Add your delivery location to make placing orders fast and simple.</p>
              <Button onClick={() => setShowForm(true)} className="mt-2 bg-primary text-xs font-bold rounded-xl">
                + Add Address Now
              </Button>
            </div>
          )}
          {list.map((a, idx) => (
            <div
              key={a.id}
              className="group rounded-3xl border border-border/60 bg-card p-4 shadow-sm space-y-2 transition hover:border-primary/40"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary font-bold text-xs">
                    {a.label === "Work" ? "🏢" : a.label === "Other" ? "📍" : "🏠"}
                  </span>
                  <div>
                    <div className="font-bold text-sm text-foreground flex items-center gap-2">
                      {a.label || "Home"}
                      {(a.is_default || idx === 0) && (
                        <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-medium text-muted-foreground">{a.full_name} · {a.phone}</div>
                  </div>
                </div>
                <button
                  onClick={() => del(a.id)}
                  aria-label="Delete address"
                  className="grid h-8 w-8 place-items-center rounded-xl text-muted-foreground hover:bg-rose-50 hover:text-destructive transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="rounded-2xl bg-secondary/40 p-3 text-xs text-foreground space-y-0.5">
                <div className="font-semibold">{a.line1}</div>
                {a.line2 && <div className="text-muted-foreground">{a.line2}</div>}
                <div className="text-muted-foreground">
                  {a.city} — <span className="font-bold text-foreground">{a.pincode}</span>
                </div>
                {a.landmark && (
                  <div className="mt-1 font-semibold text-amber-700 dark:text-amber-400 text-[11px]">
                    📍 Landmark: {a.landmark}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
