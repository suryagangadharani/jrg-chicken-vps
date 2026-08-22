import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Trash2,
  Plus,
  Tag,
  Upload,
  Image as ImageIcon,
  Ticket,
  LayoutGrid,
  Percent,
  IndianRupee,
  Pencil,
  X,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/admin/promos")({
  ssr: false,
  component: AdminPromos,
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const emptyPromo = {
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

export function AdminPromos({ defaultTab = "promos" }: { defaultTab?: "promos" | "banners" | "categories" }) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab && ["promos", "banners", "categories"].includes(tab)) {
        setActiveTab(tab);
      }
    }
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Store Content</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage promo codes, homepage banners, and product categories from one place.
        </p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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

/* -------------------------------------------------------------------------- */
/* 1. PROMO CODES SECTION                                                      */
/* -------------------------------------------------------------------------- */
function PromosSection() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ ...emptyPromo });
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
      setForm({ ...emptyPromo });
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
      toast.success("Promo code deleted");
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
              No promo codes yet. Click "New code" above to create one.
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

/* -------------------------------------------------------------------------- */
/* 2. BANNERS SECTION                                                         */
/* -------------------------------------------------------------------------- */
function BannersSection() {
  const [banners, setBanners] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await apiClient.admin.banners.getAll();
      setBanners(Array.isArray(data) ? data : []);
    } catch {}
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing({
      title: "",
      subtitle: "",
      button_text: "Order Now",
      image_url: "",
      link_url: "/products",
      active: true,
      sort_order: banners.length + 1,
    });
    setOpen(true);
  };

  const openEdit = (b: any) => {
    setEditing({ ...b });
    setOpen(true);
  };

  const del = async (id: string) => {
    try {
      await apiClient.admin.banners.delete(id);
      toast.success("Banner deleted");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete banner");
    }
  };

  const toggleActive = async (b: any) => {
    try {
      await apiClient.admin.banners.update(b.id, { active: !b.active });
      setBanners((prev) => prev.map((item) => (item.id === b.id ? { ...item, active: !b.active } : item)));
      toast.success(`Banner ${!b.active ? "enabled" : "disabled"}`);
    } catch (err: any) {
      toast.error("Failed to update status");
    }
  };

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const res = await apiClient.admin.uploadImage(files[0]);
      setEditing((prev: any) => ({ ...prev, image_url: res.url }));
      toast.success("Banner image uploaded");
    } catch (err: any) {
      toast.error(err?.message || "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing?.image_url) return toast.error("Banner image URL is required");

    setSaving(true);
    try {
      if (editing.id) {
        await apiClient.admin.banners.update(editing.id, editing);
        toast.success("Banner updated");
      } else {
        await apiClient.admin.banners.create(editing);
        toast.success("Banner created");
      }

      setOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save banner");
    } finally {
      setSaving(false);
    }
  };

  const activeCount = banners.filter((b) => b.active).length;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <SectionHeader
        icon={<ImageIcon className="h-5 w-5" />}
        title="Homepage Banners"
        subtitle={`${banners.length} total · ${activeCount} active`}
        action={
          <Button onClick={openNew} size="sm" className="bg-hero shadow-elegant">
            <Plus className="mr-1 h-4 w-4" />
            <span>New Banner</span>
          </Button>
        }
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {banners.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No banners found. Click "New Banner" to create one.
          </div>
        )}
        {banners.map((b) => (
          <div key={b.id} className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="relative aspect-[21/9] w-full overflow-hidden rounded-xl bg-secondary">
              <img src={b.image_url} alt={b.title || "Banner"} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4 flex flex-col justify-end text-white">
                {b.title && <h3 className="font-display font-bold text-lg leading-tight">{b.title}</h3>}
                {b.subtitle && <p className="text-xs opacity-90 truncate">{b.subtitle}</p>}
              </div>
              {!b.active && (
                <div className="absolute left-2 top-2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-white shadow">
                  Disabled
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-3">
              <div className="flex items-center gap-2">
                <Switch checked={b.active} onCheckedChange={() => toggleActive(b)} />
                <span className="text-xs font-medium text-muted-foreground">
                  {b.active ? "Active" : "Disabled"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(b)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Edit
                </Button>
                <ConfirmDialog
                  title="Delete Banner?"
                  description="This will remove the banner from your home page."
                  confirmLabel="Delete"
                  onConfirm={() => del(b.id)}
                >
                  <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </ConfirmDialog>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Banner" : "New Banner"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label>Title (optional)</Label>
                <Input
                  value={editing.title || ""}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="e.g. Fresh Farm Chicken Delivered"
                />
              </div>

              <div>
                <Label>Subtitle (optional)</Label>
                <Input
                  value={editing.subtitle || ""}
                  onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                  placeholder="e.g. Get 10% OFF on your first order"
                />
              </div>

              <div>
                <Label>Button Text (optional)</Label>
                <Input
                  value={editing.button_text || ""}
                  onChange={(e) => setEditing({ ...editing, button_text: e.target.value })}
                  placeholder="e.g. Order Now"
                />
              </div>

              <div>
                <Label>Link URL (optional)</Label>
                <Input
                  value={editing.link_url || ""}
                  onChange={(e) => setEditing({ ...editing, link_url: e.target.value })}
                  placeholder="e.g. /products"
                />
              </div>

              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={editing.sort_order ?? 0}
                  onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label>Banner Image</Label>
                <div className="mt-2 space-y-2">
                  {editing.image_url && (
                    <div className="relative aspect-[21/9] w-full overflow-hidden rounded-xl border border-border bg-secondary">
                      <img src={editing.image_url} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setEditing({ ...editing, image_url: "" })}
                        className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground shadow"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-3 text-xs font-medium hover:border-primary">
                    <Upload className="h-4 w-4" />
                    {uploading ? "Uploading..." : "Upload Banner Image"}
                    <input type="file" accept="image/*" hidden onChange={uploadImage} disabled={uploading} />
                  </label>

                  <Input
                    placeholder="Or paste Image URL"
                    value={editing.image_url || ""}
                    onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.active !== false}
                  onCheckedChange={(v) => setEditing({ ...editing, active: v })}
                />
                <span className="text-sm font-medium">Enable Banner on Homepage</span>
              </div>

              <Button type="submit" disabled={saving} className="w-full bg-hero shadow-elegant">
                {saving ? "Saving..." : "Save Banner"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. CATEGORIES SECTION                                                      */
/* -------------------------------------------------------------------------- */
function CategoriesSection() {
  const [categories, setCategories] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const cats = await apiClient.categories.getAll();
      setCategories(Array.isArray(cats) ? cats : []);
    } catch {}
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing({
      name: "",
      slug: "",
      image_url: "",
      sort_order: categories.length + 1,
    });
    setUrlInput("");
    setOpen(true);
  };

  const openEdit = (c: any) => {
    setEditing({ ...c });
    setUrlInput(c.image_url || "");
    setOpen(true);
  };

  const del = async (id: string) => {
    try {
      await apiClient.admin.deleteCategory(id);
      toast.success("Category deleted");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete category");
    }
  };

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const res = await apiClient.admin.uploadImage(files[0]);
      setEditing((prev: any) => ({ ...prev, image_url: res.url }));
      toast.success("Category image uploaded");
    } catch (err: any) {
      toast.error(err?.message || "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing?.name) return toast.error("Category name is required");

    setSaving(true);
    try {
      const payload = {
        name: editing.name,
        slug: editing.slug || slugify(editing.name),
        image_url: editing.image_url || "",
        sort_order: Number(editing.sort_order) || 0,
      };

      if (editing.id) {
        await apiClient.admin.updateCategory(editing.id, payload);
        toast.success("Category updated");
      } else {
        await apiClient.admin.createCategory(payload);
        toast.success("Category created");
      }

      setOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <SectionHeader
        icon={<LayoutGrid className="h-5 w-5" />}
        title="Product Categories"
        subtitle={`${categories.length} categories · displayed on the storefront`}
        action={
          <Button onClick={openNew} size="sm" className="bg-hero shadow-elegant">
            <Plus className="mr-1 h-4 w-4" />
            <span>New Category</span>
          </Button>
        }
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No categories found. Click "New Category" to create one.
          </div>
        )}
        {categories.map((c) => (
          <div key={c.id} className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                {c.image_url ? (
                  <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-2xl">🍗</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-display font-bold">{c.name}</h3>
                <p className="truncate text-xs text-muted-foreground">/{c.slug}</p>
                <p className="mt-1 text-[11px] font-semibold text-primary">Sort Order: {c.sort_order ?? 0}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 border-t border-border/50 pt-3">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(c)}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
              <ConfirmDialog
                title={`Delete category "${c.name}"?`}
                description="This will remove the category. Products assigned to it will remain intact."
                confirmLabel="Delete"
                onConfirm={() => del(c.id)}
              >
                <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </ConfirmDialog>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label>Category Name</Label>
                <Input
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      name: e.target.value,
                      slug: editing.id ? editing.slug : slugify(e.target.value),
                    })
                  }
                  required
                />
              </div>

              <div>
                <Label>Slug</Label>
                <Input
                  value={editing.slug}
                  onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })}
                />
              </div>

              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={editing.sort_order ?? 0}
                  onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label>Category Image</Label>
                <div className="mt-2 flex items-center gap-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border bg-secondary">
                    {editing.image_url ? (
                      <>
                        <img src={editing.image_url} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setEditing({ ...editing, image_url: "" })}
                          className="absolute right-0 top-0 rounded-bl bg-destructive p-0.5 text-destructive-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <div className="grid h-full place-items-center text-xl text-muted-foreground">🖼️</div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-2 text-xs font-medium hover:border-primary">
                      <Upload className="h-3.5 w-3.5" />
                      {uploading ? "Uploading..." : "Upload Image"}
                      <input type="file" accept="image/*" hidden onChange={uploadImage} disabled={uploading} />
                    </label>

                    <div className="flex gap-1.5">
                      <Input
                        placeholder="Paste Image URL"
                        value={urlInput}
                        onChange={(e) => {
                          setUrlInput(e.target.value);
                          setEditing({ ...editing, image_url: e.target.value });
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={saving} className="w-full bg-hero shadow-elegant">
                {saving ? "Saving..." : "Save Category"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
