import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inr } from "@/lib/format";
import { Plus, Pencil, Trash2, Upload, Link as LinkIcon, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/admin/products")({
  ssr: false,
  component: AdminProducts,
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    try {
      const [p, c] = await Promise.all([apiClient.products.getAll(), apiClient.categories.getAll()]);
      setProducts(Array.isArray(p) ? p : []);
      setCategories(Array.isArray(c) ? c : []);
    } catch {}
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing({
      name: "",
      slug: "",
      description: "",
      price_per_kg: "",
      category_id: categories[0]?.id,
      in_stock: true,
      images: [],
      price_presets: [],
      sort_order: 0,
      badge: "",
    });
    setOpen(true);
  };
  const openEdit = (p: any) => {
    setEditing({ ...p });
    setOpen(true);
  };

  const del = async (id: string) => {
    try {
      await apiClient.admin.deleteProduct(id);
      toast.success("Product deleted");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete product");
    }
  };

  const updateSort = async (id: string, sort_order: number) => {
    try {
      await apiClient.admin.updateProduct(id, { sort_order });
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, sort_order } : p)));
    } catch {}
  };

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Products</h1>
          <p className="truncate text-sm text-muted-foreground">Add, edit, and manage chicken products.</p>
        </div>
        <Button onClick={openNew} size="sm" className="shrink-0 bg-hero shadow-elegant sm:size-default">
          <Plus className="mr-1 h-4 w-4" />
          <span className="hidden sm:inline">New Product</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:hidden">
        {products.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No products. Add your first one.
          </div>
        )}
        {products.map((p) => (
          <div key={p.id} className="rounded-2xl border border-border bg-card p-3 shadow-card">
            <div className="flex gap-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-secondary">
                {p.images?.[0] ? (
                  <img src={p.images[0]} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-2xl">🍗</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.categories?.name || "—"}</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-semibold text-primary">{inr(p.price_per_kg)}</span>
                  {p.in_stock ? (
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                      In stock
                    </span>
                  ) : (
                    <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                      Out
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                Order
                <Input
                  type="number"
                  className="h-8 w-16"
                  value={p.sort_order ?? 0}
                  onChange={(e) => updateSort(p.id, Number(e.target.value) || 0)}
                />
              </label>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(p)}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
              <ConfirmDialog
                title={`Delete "${p.name}"?`}
                description="This product will be permanently removed from your shop. This cannot be undone."
                confirmLabel="Delete product"
                onConfirm={() => del(p.id)}
              >
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Delete
                </Button>
              </ConfirmDialog>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-border bg-card shadow-card sm:block">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">Category</th>
              <th className="p-3">Price</th>
              <th className="p-3">Order</th>
              <th className="p-3 hidden md:table-cell">Stock</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No products. Add your first one.
                </td>
              </tr>
            )}
            {products.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 overflow-hidden rounded bg-secondary">
                      {p.images?.[0] ? (
                        <img src={p.images[0]} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-lg">🍗</div>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.images?.length || 0} img{p.images?.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">{p.categories?.name || "—"}</td>
                <td className="p-3 font-semibold text-primary">{inr(p.price_per_kg)}</td>
                <td className="p-3">
                  <Input
                    type="number"
                    className="h-8 w-20"
                    value={p.sort_order ?? 0}
                    onChange={(e) => updateSort(p.id, Number(e.target.value) || 0)}
                  />
                </td>
                <td className="p-3 hidden md:table-cell">
                  {p.in_stock ? (
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                      In stock
                    </span>
                  ) : (
                    <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                      Out
                    </span>
                  )}
                </td>
                <td className="p-3 text-right">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <ConfirmDialog
                    title={`Delete "${p.name}"?`}
                    description="This product will be permanently removed from your shop. This cannot be undone."
                    confirmLabel="Delete product"
                    onConfirm={() => del(p.id)}
                  >
                    <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </ConfirmDialog>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit product" : "New product"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <ProductForm
              value={editing}
              categories={categories}
              onSave={() => {
                setOpen(false);
                load();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductForm({ value, categories, onSave }: any) {
  const [form, setForm] = useState({ ...value });
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const addUrl = () => {
    if (!urlInput.trim()) return;
    setForm({ ...form, images: [...(form.images || []), urlInput.trim()] });
    setUrlInput("");
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const uploaded: string[] = [];
    for (const f of files) {
      try {
        const res = await apiClient.admin.uploadImage(f);
        if (res.url) uploaded.push(res.url);
      } catch (err: any) {
        toast.error(`Upload failed: ${err.message}`);
      }
    }
    setForm({ ...form, images: [...(form.images || []), ...uploaded] });
    setUploading(false);
    e.target.value = "";
  };

  const removeImg = (i: number) =>
    setForm({ ...form, images: form.images.filter((_: any, idx: number) => idx !== i) });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const presets = Array.isArray(form.price_presets)
      ? form.price_presets
      : String(form.price_presets || "")
          .split(",")
          .map((s: string) => Number(s.trim()))
          .filter((n: number) => Number.isFinite(n) && n > 0);
    const payload: any = {
      name: form.name,
      slug: form.slug || slugify(form.name),
      description: form.description || null,
      price_per_kg: Number(form.price_per_kg),
      category_id: form.category_id,
      in_stock: form.in_stock,
      images: form.images || [],
      price_presets: presets,
      sort_order: Number(form.sort_order) || 0,
      badge: form.badge?.trim() ? form.badge.trim() : null,
    };

    try {
      if (form.id) {
        await apiClient.admin.updateProduct(form.id, payload);
      } else {
        await apiClient.admin.createProduct(payload);
      }
      setSaving(false);
      toast.success("Saved");
      onSave();
    } catch (err: any) {
      setSaving(false);
      toast.error(err?.message || "Failed to save product");
    }
  };

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Name</Label>
          <Input
            required
            value={form.name}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })
            }
          />
        </div>
        <div>
          <Label>Slug</Label>
          <Input required value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} />
        </div>
        <div>
          <Label>Category</Label>
          <select
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.category_id || ""}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          >
            {categories.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Price per kg (₹)</Label>
          <Input
            required
            type="number"
            min={0}
            step="0.01"
            value={form.price_per_kg}
            onChange={(e) => setForm({ ...form, price_per_kg: e.target.value })}
          />
        </div>
        <div>
          <Label>Display order (within category)</Label>
          <Input
            type="number"
            value={form.sort_order ?? 0}
            onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
          />
          <p className="mt-1 text-xs text-muted-foreground">Lower numbers appear first. Use 1, 2, 3…</p>
        </div>
        <div>
          <Label>Badge / Tag (optional)</Label>
          <Input
            placeholder="e.g. Highly ordered, Bestseller, New"
            value={form.badge || ""}
            onChange={(e) => setForm({ ...form, badge: e.target.value })}
          />
          <p className="mt-1 text-xs text-muted-foreground">Shown as a small chip on product card.</p>
        </div>
      </div>
      <div>
        <Label>Description</Label>
        <Textarea rows={3} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>

      <div>
        <Label>Quick price options (optional)</Label>
        <Input
          placeholder="e.g. 150, 200, 250"
          value={Array.isArray(form.price_presets) ? form.price_presets.join(", ") : form.price_presets || ""}
          onChange={(e) => setForm({ ...form, price_presets: e.target.value })}
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={form.in_stock} onCheckedChange={(v) => setForm({ ...form, in_stock: v })} />
        <span className="text-sm">In stock</span>
      </div>

      <div>
        <Label>Images</Label>
        <div className="mt-1 flex flex-wrap gap-2">
          {(form.images || []).map((src: string, i: number) => (
            <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border">
              <img src={src} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeImg(i)}
                className="absolute right-0 top-0 rounded-bl bg-destructive p-0.5 text-destructive-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-3 text-sm hover:border-primary">
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : "Upload image"}
            <input type="file" accept="image/*" multiple hidden onChange={upload} disabled={uploading} />
          </label>
          <div className="flex gap-2">
            <Input
              placeholder="Paste image URL"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
            />
            <Button type="button" variant="outline" onClick={addUrl}>
              <LinkIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Button type="submit" disabled={saving} className="w-full bg-hero shadow-elegant">
        {saving ? "Saving…" : "Save product"}
      </Button>
    </form>
  );
}
