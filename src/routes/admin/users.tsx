import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { dateFmt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Shield, ShieldOff, Mail, Phone, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/admin/users")({
  ssr: false,
  component: AdminUsers,
});

function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [addingUser, setAddingUser] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ title: string; desc: string; run: () => Promise<void> } | null>(null);
  const [busy, setBusy] = useState(false);
  const { user: me } = useAuth();

  const load = async () => {
    try {
      const data = await apiClient.admin.getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch {}
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = (u: any) => {
    setConfirmAction({
      title: "Delete user?",
      desc: `Delete ${u.full_name || u.email}? This will remove their account permanently.`,
      run: async () => {
        try {
          await apiClient.admin.deleteUser(u.id);
          toast.success("User deleted");
          load();
        } catch (e: any) {
          toast.error(e.message || "Failed to delete user");
        }
      },
    });
  };

  const toggleAdmin = (u: any) => {
    const isAdmin = u.role === "admin";
    const newRole = isAdmin ? "customer" : "admin";
    setConfirmAction({
      title: isAdmin ? "Revoke Admin Access?" : "Promote to Admin?",
      desc: isAdmin ? `Change ${u.full_name || u.email}'s role to Customer?` : `Make ${u.full_name || u.email} an Admin?`,
      run: async () => {
        try {
          await apiClient.admin.updateUserRole(u.id, newRole);
          toast.success(isAdmin ? "Role updated to Customer" : "Promoted to Admin!");
          load();
        } catch (e: any) {
          toast.error(e?.message || "Failed to update role");
        }
      },
    });
  };

  const handleCreateUser = async (data: { full_name: string; phone: string; email: string; password?: string; role: string }) => {
    try {
      const email = data.email || `${data.phone}@customer.jrgchicken.in`;
      await apiClient.auth.register({
        email,
        password: data.password || "password123",
        full_name: data.full_name,
        phone: data.phone,
      });

      toast.success(`User ${data.full_name} created successfully!`);
      setAddingUser(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create user");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Users & Admin Roles</h1>
          <p className="text-sm text-muted-foreground">Manage customer accounts, assign Admin privileges, or create new users.</p>
        </div>
        <Button onClick={() => setAddingUser(true)} className="bg-hero shadow-elegant">
          <UserPlus className="mr-2 h-4 w-4" /> Add New User
        </Button>
      </div>

      <div className="mt-5 grid gap-3 md:hidden">
        {users.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No users yet.</div>
        )}
        {users.map((u) => {
          const isAdmin = u.role === "admin";
          const isSelf = me?.id === u.id;
          return (
            <div key={u.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold truncate">{u.full_name || "—"}</div>
                    {isAdmin && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">ADMIN</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{u.email}</span>
                  </div>
                  {u.phone && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" />
                      {u.phone}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground">Joined {dateFmt(u.created_at)}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => toggleAdmin(u)} disabled={isSelf}>
                  {isAdmin ? (
                    <>
                      <ShieldOff className="mr-1 h-3.5 w-3.5" />
                      Revoke Admin
                    </>
                  ) : (
                    <>
                      <Shield className="mr-1 h-3.5 w-3.5" />
                      Make Admin
                    </>
                  )}
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(u)} disabled={isSelf} className="text-destructive hover:text-destructive">
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-border bg-card shadow-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Contact</th>
              <th className="p-3">Joined</th>
              <th className="p-3">Role</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  No users yet.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const isAdmin = u.role === "admin";
              const isSelf = me?.id === u.id;
              return (
                <tr key={u.id} className="border-t border-border">
                  <td className="p-3 font-semibold">{u.full_name || "—"}</td>
                  <td className="p-3 text-muted-foreground">
                    <div>{u.email}</div>
                    {u.phone && <div className="text-xs">{u.phone}</div>}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{dateFmt(u.created_at)}</td>
                  <td className="p-3">
                    {isAdmin ? (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">Admin</span>
                    ) : (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">Customer</span>
                    )}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toggleAdmin(u)}
                      disabled={isSelf}
                      title={isAdmin ? "Revoke admin" : "Make admin"}
                    >
                      {isAdmin ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(u)}
                      disabled={isSelf}
                      className="text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={addingUser} onOpenChange={setAddingUser}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User / Admin</DialogTitle>
          </DialogHeader>
          <AddUserForm onSave={handleCreateUser} onCancel={() => setAddingUser(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmAction} onOpenChange={(v) => !v && !busy && setConfirmAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirmAction?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{confirmAction?.desc}</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                if (!confirmAction) return;
                setBusy(true);
                await confirmAction.run();
                setBusy(false);
                setConfirmAction(null);
              }}
            >
              {busy ? "Working…" : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddUserForm({ onSave, onCancel }: { onSave: (d: any) => void; onCancel: () => void }) {
  const [full_name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ full_name, phone, email, password, role });
      }}
      className="space-y-3"
    >
      <div>
        <Label>Full Name</Label>
        <Input required value={full_name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Sharma" />
      </div>
      <div>
        <Label>Mobile Number</Label>
        <Input
          required
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="10-digit mobile"
          maxLength={10}
        />
      </div>
      <div>
        <Label>Email (Optional)</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
      </div>
      <div>
        <Label>Password</Label>
        <Input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Initial password"
        />
      </div>
      <div>
        <Label>User Role</Label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="customer">Customer</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-hero shadow-elegant">
          Create User
        </Button>
      </div>
    </form>
  );
}
