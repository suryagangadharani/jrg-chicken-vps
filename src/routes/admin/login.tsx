import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate } from "@tanstack/react-router";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Lock } from "lucide-react";

export const Route = createFileRoute("/admin/login")({
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Enter admin email and password");
    setLoading(true);

    try {
      const res = await apiClient.auth.login({ email, password });
      if (res.user.role !== "admin") {
        setLoading(false);
        return toast.error("Account does not have admin permissions");
      }

      toast.success("Welcome Admin! Access granted.");
      setLoading(false);
      window.location.href = "/admin";
    } catch (err: any) {
      setLoading(false);
      toast.error(err?.message || "Admin login failed");
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-elegant md:p-8">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold">Admin Portal Login</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in with your admin credentials to access the store management dashboard.</p>
        </div>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="admin-email">Admin Email / Username</Label>
            <Input
              id="admin-email"
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <Label htmlFor="admin-password">Admin Password</Label>
            <div className="relative">
              <Input
                id="admin-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
              <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full bg-hero shadow-elegant" size="lg">
            {loading ? "Verifying..." : "Sign In to Admin Dashboard"}
          </Button>

          <div className="text-center pt-2">
            <Link to="/" className="text-xs text-muted-foreground hover:underline">
              ← Return to Main Store
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
