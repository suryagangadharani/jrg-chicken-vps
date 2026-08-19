import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Upload, Link as LinkIcon, X, FolderTree } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/admin/categories")({
  ssr: false,
  component: AdminCategories,
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function AdminCategories() {
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
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Categories</h1>
          <p className="text-sm text-muted-foreground">Manage product categories and category images.</p>
        </div>
        <Button onClick={openNew} size="sm" className="bg-hero shadow-elegant sm:size-default">
          <Plus className="mr-1 h-4 w-4" />
          <span>New Category</span>
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.length === 0 && (
          <div className="col-span-full rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
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
