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
import { MapPin, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/addresses")({
  head: () => ({ meta: [{ title: "Saved Addresses — JRG Chicken" }] }),
  component: AddressesPage,
});

function AddressesPage() {
  const { user } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
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
    try {
      await apiClient.user.addAddress(form);
      toast.success("Address saved");
      setShowForm(false);
      setForm({
        label: "Home",
        full_name: "",
        phone: "",
        line1: "",
        line2: "",
        city: "Jangareddygudem",
        pincode: "",
        landmark: "",
      });
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save address");
    }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this address?")) return;
    try {
      await apiClient.user.deleteAddress(id);
      load();
    } catch {
      toast.error("Failed to delete address");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 md:px-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-bold">Saved Addresses</h1>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-1 h-4 w-4" />
            New
          </Button>
        </div>

        {showForm && (
          <form
            onSubmit={add}
            className="mt-4 grid gap-3 rounded-2xl border border-border bg-card p-5 shadow-card sm:grid-cols-2"
          >
            <div className="sm:col-span-2">
              <Label>Label</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Home / Work"
              />
            </div>
            <div>
              <Label>Full Name</Label>
              <Input
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                required
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Address Line 1</Label>
              <Input required value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Address Line 2</Label>
              <Input value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} />
            </div>
            <div>
              <Label>City</Label>
              <Input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <Label>Pincode</Label>
              <Input required value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Landmark</Label>
              <Input value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" className="bg-hero shadow-elegant">
                Save address
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        <div className="mt-4 space-y-3">
          {list.length === 0 && !showForm && (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No saved addresses yet.
            </div>
          )}
          {list.map((a) => (
            <div key={a.id} className="flex gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
              <MapPin className="mt-1 h-5 w-5 shrink-0 text-primary" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{a.label}</span>
                  {a.is_default && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      DEFAULT
                    </span>
                  )}
                </div>
                <div className="text-sm">
                  {a.full_name} · {a.phone}
                </div>
                <div className="text-sm text-muted-foreground">
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}, {a.city} - {a.pincode}
                  {a.landmark ? ` (${a.landmark})` : ""}
                </div>
              </div>
              <button onClick={() => del(a.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
