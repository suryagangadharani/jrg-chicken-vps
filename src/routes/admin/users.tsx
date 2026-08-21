import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { dateFmt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Shield, ShieldOff, Mail, Phone, UserPlus, Bike, Pencil } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/admin/users")({
  ssr: false,
  component: AdminUsers,
});

const isDummyEmail = (email?: string | null) => {
  if (!email) return true;
  const e = email.trim().toLowerCase();
  return e.endsWith("@customer.jrgchicken.in") || e.endsWith("@placeholder.com");
};

function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [addingUser, setAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ title: string; desc: string; confirmText?: string; isDestructive?: boolean; run: () => Promise<void> } | null>(null);
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
    const name = u.full_name || u.email || "this user";
    setConfirmAction({
      title: "Delete User?",
      desc: `Are you sure you want to delete ${name}? This action cannot be undone.`,
      confirmText: "Delete User",
      isDestructive: true,
      run: async () => {
        try {
          await apiClient.admin.deleteUser(u.id);
          toast.success("User account deleted");
          load();
        } catch (e: any) {
          toast.error(e?.message || "Failed to delete user");
        }
      },
    });
  };

  const toggleAdmin = (u: any) => {
    const isAdmin = u.role === "admin";
    const newRole = isAdmin ? "customer" : "admin";
    const name = u.full_name || u.email || "this user";

    setConfirmAction({
      title: isAdmin ? "Revoke Admin Access?" : "Make this user an admin?",
      desc: isAdmin
        ? `Change ${name}'s role to Customer? Administrator privileges will be revoked.`
        : `${name} will receive administrator access.`,
      confirmText: isAdmin ? "Revoke Admin" : "Make Admin",
      isDestructive: false,
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

  const toggleDeliveryBoy = (u: any) => {
    const isDelivery = u.role === "delivery_boy";
    const newRole = isDelivery ? "customer" : "delivery_boy";
    const name = u.full_name || u.email || "this user";

    setConfirmAction({
      title: isDelivery ? "Revoke Delivery Role?" : "Make Delivery Boy?",
      desc: isDelivery
        ? `Change ${name}'s role to Customer? Delivery access will be revoked.`
        : `Assign Delivery Boy role to ${name}?`,
      confirmText: isDelivery ? "Revoke Delivery" : "Make Delivery Boy",
      isDestructive: false,
      run: async () => {
        try {
          await apiClient.admin.updateUserRole(u.id, newRole);
          toast.success(isDelivery ? "Role updated to Customer" : "Assigned as Delivery Boy!");
          load();
        } catch (e: any) {
          toast.error(e?.message || "Failed to update role");
        }
      },
    });
  };

  const handleRoleChange = async (u: any, newRole: string) => {
    if (u.role === newRole) return;
    const name = u.full_name || u.email || "this user";
    try {
      await apiClient.admin.updateUserRole(u.id, newRole);
      toast.success(`Role for ${name} updated to ${newRole === "admin" ? "Admin 🛡️" : newRole === "delivery_boy" ? "Delivery Boy 🛵" : "Customer 👤"}`);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update role");
    }
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

  const handleSaveEditUser = async (data: { full_name: string; phone: string; email: string; role: string }) => {
    if (!editingUser) return;
    try {
      await apiClient.admin.updateUser(editingUser.id, data);
      toast.success(`User updated successfully!`);
      setEditingUser(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update user");
    }
  };

  return (
    <div className="space-y-4 pb-24 md:pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl text-foreground">Users & Admin Roles</h1>
          <p className="text-xs text-muted-foreground">Manage user accounts, assign Admin privileges, or remove accounts.</p>
        </div>
        <Button onClick={() => setAddingUser(true)} className="bg-primary text-xs font-bold text-primary-foreground shadow-sm rounded-xl">
          <UserPlus className="mr-1.5 h-4 w-4" /> Add New User
        </Button>
      </div>

      {/* MOBILE CARD LAYOUT (Clean Form-Style Role Selector + Action Buttons) */}
      <div className="mt-4 grid gap-3 md:hidden">
        {users.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No registered users found.
          </div>
        )}
        {users.map((u) => {
          const isAdmin = u.role === "admin";
          const isDeliveryBoy = u.role === "delivery_boy";
          const isSelf = me?.id === u.id;
          const initial = (u.full_name || u.email || "S")[0].toUpperCase();

          return (
            <div key={u.id} className="rounded-3xl border border-border/60 bg-card p-4.5 shadow-sm space-y-3">
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-sm">
                  {initial}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-base text-foreground truncate">{u.full_name || "Customer"}</h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        isAdmin
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : isDeliveryBoy
                          ? "bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950 dark:text-blue-300"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {isAdmin ? "Admin 🛡️" : isDeliveryBoy ? "Delivery 🛵" : "Customer 👤"}
                    </span>
                  </div>

                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    {!isDummyEmail(u.email) && u.email && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span className="truncate">{u.email}</span>
                      </div>
                    )}
                    {u.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span>{u.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground bg-secondary/30 rounded-xl px-3 py-1.5">
                <div>Orders: <strong className="text-foreground">{u.orders_count ?? 0}</strong></div>
                <div>Joined: <strong className="text-foreground">{dateFmt(u.created_at)}</strong></div>
              </div>

              {/* FORM-STYLE USER ROLE & ACTIONS CONTROL */}
              <div className="pt-2 border-t border-border/50 space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Change Role / Actions
                </label>

                <div className="flex items-center gap-2">
                  <select
                    value={u.role || "customer"}
                    disabled={isSelf}
                    onChange={(e) => handleRoleChange(u, e.target.value)}
                    className="flex-1 h-9 rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-bold text-foreground shadow-xs focus:ring-1 focus:ring-primary"
                  >
                    <option value="customer">👤 Customer</option>
                    <option value="admin">🛡️ Admin</option>
                    <option value="delivery_boy">🛵 Delivery Boy</option>
                  </select>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingUser(u)}
                    className="h-9 px-3 text-xs font-bold rounded-xl"
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(u)}
                    disabled={isSelf}
                    className="h-9 px-3 text-xs font-bold text-destructive hover:bg-rose-50 rounded-xl border-destructive/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* DESKTOP TABLE LAYOUT */}
      <div className="mt-4 hidden overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm md:block">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60">
            <tr>
              <th className="p-3.5 pl-5">User</th>
              <th className="p-3.5">Contact</th>
              <th className="p-3.5">Joined</th>
              <th className="p-3.5">Orders</th>
              <th className="p-3.5">Role</th>
              <th className="p-3.5 pr-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No users found.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const isAdmin = u.role === "admin";
              const isDeliveryBoy = u.role === "delivery_boy";
              const isSelf = me?.id === u.id;
              const initial = (u.full_name || u.email || "S")[0].toUpperCase();

              return (
                <tr key={u.id} className="hover:bg-secondary/20 transition">
                  <td className="p-3.5 pl-5 font-bold">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-xs font-bold text-primary-foreground">
                        {initial}
                      </div>
                      <span className="text-foreground">{u.full_name || "—"}</span>
                    </div>
                  </td>
                  <td className="p-3.5 text-xs text-muted-foreground">
                    {!isDummyEmail(u.email) && <div className="font-semibold text-foreground">{u.email}</div>}
                    {u.phone && <div>{u.phone}</div>}
                  </td>
                  <td className="p-3.5 text-xs text-muted-foreground">{dateFmt(u.created_at)}</td>
                  <td className="p-3.5 font-bold text-xs">{u.orders_count ?? 0}</td>
                  <td className="p-3.5">
                    {isAdmin ? (
                      <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-bold text-primary">
                        Admin 🛡️
                      </span>
                    ) : isDeliveryBoy ? (
                      <span className="rounded-full bg-blue-100 border border-blue-200 px-2.5 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        Delivery 🛵
                      </span>
                    ) : (
                      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                        Customer 👤
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 pr-5 text-right whitespace-nowrap space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleAdmin(u)}
                      disabled={isSelf}
                      className="text-xs rounded-xl"
                    >
                      {isAdmin ? "Revoke Admin" : "Make Admin"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleDeliveryBoy(u)}
                      disabled={isSelf}
                      className="text-xs rounded-xl"
                    >
                      {isDeliveryBoy ? "Revoke Delivery" : "Make Delivery"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingUser(u)}
                      className="text-xs rounded-xl"
                    >
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(u)}
                      disabled={isSelf}
                      className="text-destructive hover:bg-rose-50 text-xs rounded-xl border-destructive/20"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit User Modal */}
      <Dialog open={!!editingUser} onOpenChange={(v) => !v && setEditingUser(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Edit User Profile & Role</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <EditUserModal user={editingUser} onSave={handleSaveEditUser} onCancel={() => setEditingUser(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Add User Modal */}
      <Dialog open={addingUser} onOpenChange={setAddingUser}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Add New User / Admin Account</DialogTitle>
          </DialogHeader>
          <AddUserForm onSave={handleCreateUser} onCancel={() => setAddingUser(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmAction} onOpenChange={(v) => !v && !busy && setConfirmAction(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">{confirmAction?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground leading-relaxed">{confirmAction?.desc}</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setConfirmAction(null)} className="rounded-xl text-xs">
              Cancel
            </Button>

            <Button
              disabled={busy}
              className={`rounded-xl text-xs font-bold ${
                confirmAction?.isDestructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-primary text-primary-foreground"
              }`}
              onClick={async () => {
                if (!confirmAction) return;
                setBusy(true);
                await confirmAction.run();
                setBusy(false);
                setConfirmAction(null);
              }}
            >
              {busy ? "Working…" : confirmAction?.confirmText || "Confirm"}
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

function EditUserModal({ user, onSave, onCancel }: { user: any; onSave: (d: any) => void; onCancel: () => void }) {
  const [full_name, setName] = useState(user?.full_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email && !user.email.endsWith("@customer.jrgchicken.in") ? user.email : "");
  const [role, setRole] = useState(user?.role || "customer");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ full_name, phone, email, role });
      }}
      className="space-y-3"
    >
      <div>
        <Label className="text-xs text-muted-foreground">Full Name</Label>
        <Input required value={full_name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="mt-1 h-10 rounded-xl text-sm" />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Mobile Phone</Label>
        <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" maxLength={10} className="mt-1 h-10 rounded-xl text-sm" />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Email Address</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" className="mt-1 h-10 rounded-xl text-sm" />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">User Role</Label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold text-foreground"
        >
          <option value="customer">Customer 👤</option>
          <option value="admin">Admin 🛡️</option>
          <option value="delivery_boy">Delivery Boy 🛵</option>
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl text-xs">
          Cancel
        </Button>
        <Button type="submit" className="bg-primary text-xs font-bold text-primary-foreground shadow-sm rounded-xl">
          Save Changes
        </Button>
      </div>
    </form>
  );
}
