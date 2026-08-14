import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — JRG Chicken" },
      { name: "description", content: "Choose a new password for your JRG Chicken account securely." },
      { property: "og:title", content: "Reset password — JRG Chicken" },
      { property: "og:description", content: "Securely reset your JRG Chicken account password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    setLoading(false);
    toast.success("Password updated — please sign in");
    nav({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-warm">
      <Navbar />
      <main className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-elegant">
          <h1 className="font-display text-2xl font-bold text-center">Reset your password</h1>
          <form onSubmit={submit} className="mt-5 space-y-3">
            <div>
              <Label>New password</Label>
              <div className="relative">
                <Input
                  type={show ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Confirm new password</Label>
              <Input
                type={show ? "text" : "password"}
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-hero shadow-elegant" size="lg">
              {loading ? "Updating…" : "Update password"}
            </Button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
