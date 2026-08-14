import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Trash2,
  Plus,
  Tag,
  ImagePlus,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Ticket,
  LayoutGrid,
  Percent,
  IndianRupee,
  Calendar,
  Users,
} from "lucide-react";
import { dateFmt } from "@/lib/format";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/admin/promos")({
  ssr: false,
  component: AdminPromos,
});

const empty = {
  code: "",
  description: "",
  discount_type: "percent" as "percent" | "flat",
  discount_value: "",
  min_subtotal: "0",
  min_qty_kg: "0",
  max_uses: "",
  expires_at: "",
  active: true,
};

function AdminPromos() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Store Content</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage promo codes, homepage banners, and product categories from one place.
        </p>
      </header>

      <Tabs defaultValue="promos" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="promos" className="gap-2">
            <Ticket className="h-4 w-4" />
            <span className="hidden sm:inline">Promo Codes</span>
            <span className="sm:hidden">Promos</span>
          </TabsTrigger>
          <TabsTrigger value="banners" className="gap-2">
            <ImageIcon className="h-4 w-4" />
            <span>Banners</span>
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            <span>Categories</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="promos" className="mt-6">
          <PromosSection />
        </TabsContent>
        <TabsContent value="banners" className="mt-6">
          <BannersSection />
        </TabsContent>
        <TabsContent value="categories" className="mt-6">
          <CategoriesSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <h2 className="font-display text-lg font-bold sm:text-xl">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function PromosSection() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    try {
      const data = await apiClient.promos.getAll();
      setRows(Array.isArray(data) ? data : []);
    } catch {}
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.discount_value) return toast.error("Code and discount value are required");
    setSaving(true);
    try {
      await apiClient.admin.createPromo({
        code: form.code.trim().toUpperCase(),
        description: form.description || null,
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value),
        min_subtotal: parseFloat(form.min_subtotal || "0"),
        min_qty_kg: parseFloat(form.min_qty_kg || "0"),
        active: form.active,
      });
      setSaving(false);
      toast.success("Promo code created");
      setForm({ ...empty });
      setShowForm(false);
      load();
    } catch (err: any) {
      setSaving(false);
      toast.error(err?.message || "Failed to create promo code");
    }
  };

  const del = async (id: string) => {
    try {
      await apiClient.admin.deletePromo(id);
      toast.success("Deleted");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete");
    }
  };

  const activeCount = rows.filter((r) => r.active).length;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <SectionHeader
          icon={<Ticket className="h-5 w-5" />}
          title="Promo Codes"
          subtitle={`${rows.length} total · ${activeCount} active`}
          action={
            <Button onClick={() => setShowForm((s) => !s)} size="sm" className="bg-hero shadow-elegant">
              <Plus className="mr-1 h-4 w-4" />
              {showForm ? "Close" : "New code"}
            </Button>
          }
        />

        {showForm && (
          <form onSubmit={save} className="mt-5 rounded-xl border border-border bg-secondary/40 p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2 lg:col-span-1">
                <Label>Code</Label>
                <Input
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="WELCOME10"
                  className="font-mono uppercase"
                />
              </div>
              <div>
                <Label>Discount type</Label>
                <select
                  value={form.discount_type}
                  onChange={(e) => setForm({ ...form, discount_type: e.target.value as any })}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="percent">Percent (%)</option>
                  <option value="flat">Flat (₹)</option>
                </select>
              </div>
              <div>
                <Label>Discount value</Label>
                <Input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                  placeholder={form.discount_type === "percent" ? "10" : "50"}
                />
              </div>
              <div>
                <Label>Min subtotal (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.min_subtotal}
                  onChange={(e) => setForm({ ...form, min_subtotal: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-2">
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. 10% OFF on orders above ₹300"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-hero shadow-elegant">
                {saving ? "Saving…" : "Create promo code"}
              </Button>
            </div>
          </form>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {rows.length === 0 && (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground sm:col-span-2">
              No promo codes yet. Create your first one above.
            </div>
          )}
          {rows.map((r) => (
            <div
              key={r.id}
              className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card transition hover:shadow-elegant"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 font-mono text-sm font-bold text-primary">
                      <Tag className="h-3.5 w-3.5" />
                      {r.code}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold">
                      {r.discount_type === "percent" ? (
                        <>
                          <Percent className="h-3 w-3" />
                          {r.discount_value}% off
                        </>
                      ) : (
                        <>
                          <IndianRupee className="h-3 w-3" />
                          {r.discount_value} off
                        </>
                      )}
                    </span>
                  </div>
                  {r.description && <div className="mt-2 text-sm text-muted-foreground line-clamp-2">{r.description}</div>}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <IndianRupee className="h-3 w-3" />
                      Min ₹{r.min_subtotal}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2 border-t border-border pt-3">
                <ConfirmDialog
                  title={`Delete promo "${r.code}"?`}
                  description="Customers will no longer be able to redeem this code."
                  confirmLabel="Delete code"
                  onConfirm={() => del(r.id)}
                >
                  <Button size="sm" variant="outline" className="w-full border-destructive/40 hover:bg-destructive/10">
                    <Trash2 className="mr-1 h-4 w-4 text-destructive" /> Delete Code
                  </Button>
                </ConfirmDialog>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoriesSection() {
  const [cats, setCats] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      const data = await apiClient.categories.getAll();
      setCats(Array.isArray(data) ? data : []);
    } catch {}
  };
  useEffect(() => {
    load();
  }, []);

  const createCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return toast.error("Name is required");
    setCreating(true);
    try {
      await apiClient.admin.createCategory({ name: newName.trim() });
      setCreating(false);
      toast.success("Category added");
      setNewName("");
      setShowForm(false);
      load();
    } catch (err: any) {
      setCreating(false);
      toast.error(err?.message || "Failed to add category");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <SectionHeader
        icon={<LayoutGrid className="h-5 w-5" />}
        title="Categories"
        subtitle={`${cats.length} categories · shown on the home page`}
        action={
          <Button onClick={() => setShowForm((s) => !s)} size="sm" className="bg-hero shadow-elegant">
            <Plus className="mr-1 h-4 w-4" />
            {showForm ? "Close" : "New category"}
          </Button>
        }
      />

      {showForm && (
        <form onSubmit={createCategory} className="mt-5 rounded-xl border border-border bg-secondary/40 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Country Chicken"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating} className="bg-hero shadow-elegant">
              {creating ? "Adding…" : "Add category"}
            </Button>
          </div>
        </form>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cats.map((c) => (
          <div key={c.id} className="group overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="truncate text-sm font-semibold">{c.name}</div>
            <div className="truncate text-xs text-muted-foreground">/{c.slug}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BannersSection() {
  const [banners, setBanners] = useState<any[]>([]);

  const load = async () => {
    try {
      const data = await apiClient.banners.getAll();
      setBanners(Array.isArray(data) ? data : []);
    } catch {}
  };
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <SectionHeader
        icon={<ImageIcon className="h-5 w-5" />}
        title="Homepage Banners"
        subtitle={`${banners.length} active banners`}
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {banners.map((b, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
            <div className="relative aspect-[16/7] bg-secondary">
              <img src={b.image_url} alt="Banner" className="h-full w-full object-cover" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
