import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Upload, X, Image as ImageIcon } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/admin/banners")({
  ssr: false,
  component: AdminBanners,
});

function AdminBanners() {
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

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Banners</h1>
          <p className="text-sm text-muted-foreground">Manage homepage promotional banners and sliders.</p>
        </div>
        <Button onClick={openNew} size="sm" className="bg-hero shadow-elegant sm:size-default">
          <Plus className="mr-1 h-4 w-4" />
          <span>New Banner</span>
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {banners.length === 0 && (
          <div className="col-span-full rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No banners found. Click "New Banner" to add one.
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
