import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { Bike, Plus, Key, Phone, Mail, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AdminNotificationTest } from "@/components/AdminNotificationTest";
import { SoundUnlockBanner } from "@/components/SoundUnlockBanner";

export const Route = createFileRoute("/admin/delivery-boys")({
  component: DeliveryBoysPage,
});

function DeliveryBoysPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [selectedBoy, setSelectedBoy] = useState<any | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const { data: deliveryBoys = [], isLoading } = useQuery({
    queryKey: ["admin-delivery-boys"],
    queryFn: () => apiClient.admin.getDeliveryBoys(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient.admin.createDeliveryBoy(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-delivery-boys"] });
      toast.success("Delivery Boy account created successfully!");
      setCreateOpen(false);
      setName("");
      setEmail("");
      setPhone("");
      setPassword("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create account");
    },
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, pass }: { id: string; pass: string }) => apiClient.admin.resetDeliveryBoyPassword(id, pass),
    onSuccess: () => {
      toast.success("Password reset successfully!");
      setResetOpen(false);
      setSelectedBoy(null);
      setNewPassword("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reset password");
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error("Please fill in all required fields.");
      return;
    }
    createMutation.mutate({ full_name: name, email, phone, password });
  };

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBoy || !newPassword) return;
    resetMutation.mutate({ id: selectedBoy.id, pass: newPassword });
  };

  return (
    <div className="space-y-6">
      <SoundUnlockBanner />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Bike className="h-6 w-6 text-primary" />
            Delivery Boy Management
          </h1>
          <p className="text-xs text-muted-foreground">Manage active delivery accounts and password resets.</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm gap-2">
              <Plus className="h-4 w-4" />
              Add Delivery Boy
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bike className="h-5 w-5 text-primary" /> Create Delivery Account
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g. Ramesh Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Mobile Number</Label>
                <Input
                  id="phone"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="delivery@jrgchicken.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Login Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Delivery Account"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading delivery personnel...</div>
      ) : deliveryBoys.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center space-y-3">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Bike className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-lg">No Delivery Accounts Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Create your first delivery boy account to enable mobile order tracking and status updates.
          </p>
          <Button onClick={() => setCreateOpen(true)} className="bg-primary">
            Add Delivery Boy
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {deliveryBoys.map((boy: any) => (
            <div key={boy.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 font-bold">
                    <Bike className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base leading-tight">{boy.full_name || "Delivery Boy"}</h3>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-1">
                      <ShieldCheck className="h-3 w-3" /> Active Personnel
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-muted-foreground border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-primary" />
                  <span>{boy.email}</span>
                </div>
                {boy.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-primary" />
                    <a href={`tel:${boy.phone}`} className="hover:underline text-foreground">
                      {boy.phone}
                    </a>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="rounded-xl bg-secondary/60 p-2.5">
                  <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
                    <Clock className="h-3 w-3" /> Active
                  </div>
                  <div className="text-base font-bold text-foreground">{boy.active_deliveries || 0}</div>
                </div>
                <div className="rounded-xl bg-secondary/60 p-2.5">
                  <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Completed
                  </div>
                  <div className="text-base font-bold text-foreground">{boy.completed_deliveries || 0}</div>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs gap-1.5"
                onClick={() => {
                  setSelectedBoy(boy);
                  setResetOpen(true);
                }}
              >
                <Key className="h-3.5 w-3.5" />
                Reset Password
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Live Notification & Sound Test Suite */}
      <AdminNotificationTest />

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" /> Reset Password
            </DialogTitle>
          </DialogHeader>
          {selectedBoy && (
            <form onSubmit={handleReset} className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground">
                Set a new password for <span className="font-semibold text-foreground">{selectedBoy.full_name}</span> ({selectedBoy.email}).
              </p>
              <div>
                <Label htmlFor="newPassword">New Password *</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-primary" disabled={resetMutation.isPending}>
                {resetMutation.isPending ? "Updating..." : "Update Password"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
