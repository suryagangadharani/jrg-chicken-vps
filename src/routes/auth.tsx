import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — JRG Chicken" },
      { name: "description", content: "Sign in to JRG Chicken with your mobile number or email to order fresh exclusive chicken cuts." },
      { property: "og:title", content: "Sign in — JRG Chicken" },
      { property: "og:description", content: "Access your JRG Chicken account for online orders and order tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const normalizePhone = (raw: string) => {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits;
};
const isValidPhone = (raw: string) => normalizePhone(raw).length === 10;

function AuthPage() {
  return (
    <div className="min-h-screen bg-warm">
      <Navbar />
      <main className="mx-auto grid max-w-md px-4 py-8 md:px-6 md:py-10">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-elegant sm:p-6 md:p-8">
          <h1 className="font-display text-2xl font-bold text-center sm:text-3xl">Welcome</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Sign in with your mobile number or email address.
          </p>

          <Tabs defaultValue="signin" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-4"><SignIn /></TabsContent>
            <TabsContent value="signup" className="mt-4"><SignUp /></TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function PasswordInput({ id, value, onChange, placeholder }: any) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        required
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        minLength={6}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function SignIn() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { refetchUser } = useAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputVal = identifier.trim();
    if (!inputVal) return toast.error("Enter your mobile number or email");
    setLoading(true);

    try {
      const res = await apiClient.auth.login({ email: inputVal, password });
      await refetchUser();
      setLoading(false);

      const user = res.user;
      if (user?.role === "admin") {
        toast.success("Welcome Admin! Access granted.");
        window.location.href = "/admin";
      } else {
        toast.success(`Welcome back, ${user?.full_name || "customer"}! 🎉`);
        nav({ to: "/" });
      }
    } catch (err: any) {
      setLoading(false);
      toast.error(err?.message || "Sign in failed");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label htmlFor="si-identifier">Mobile number or Email</Label>
        <Input
          id="si-identifier"
          type="text"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Mobile or admin@jrgchicken.in"
        />
      </div>
      <div>
        <Label htmlFor="si-pass">Password</Label>
        <PasswordInput
          id="si-pass"
          value={password}
          onChange={(e: any) => setPassword(e.target.value)}
          placeholder="Your password"
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full bg-hero shadow-elegant" size="lg">
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function SignUp() {
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const nav = useNavigate();
  const { refetchUser } = useAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accepted) return toast.error("Please check and accept the Terms & Conditions box");

    const cleanPhone = normalizePhone(form.phone);
    if (cleanPhone.length !== 10) return toast.error("Enter a valid 10-digit mobile number (e.g. 7659018774)");
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters long");
    if (form.password !== form.confirm) return toast.error("Passwords do not match. Please check again.");

    setLoading(true);
    try {
      const email = form.email?.trim() || `${cleanPhone}@customer.jrgchicken.in`;
      await apiClient.auth.register({
        email,
        password: form.password,
        full_name: form.full_name,
        phone: cleanPhone,
      });

      await refetchUser();
      setLoading(false);
      toast.success("Account created successfully — welcome!");
      nav({ to: "/" });
    } catch (err: any) {
      setLoading(false);
      toast.error(err?.message || "Sign up failed. Please try again.");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Full Name</Label>
        <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
      </div>
      <div>
        <Label>Mobile number</Label>
        <Input
          type="tel"
          inputMode="numeric"
          required
          maxLength={10}
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="10-digit mobile"
        />
      </div>
      <div>
        <Label>
          Email <span className="text-xs text-muted-foreground">(optional)</span>
        </Label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="you@example.com"
        />
      </div>
      <div>
        <Label>Password</Label>
        <PasswordInput
          value={form.password}
          onChange={(e: any) => setForm({ ...form, password: e.target.value })}
          placeholder="At least 6 characters"
        />
      </div>
      <div>
        <Label>Confirm Password</Label>
        <PasswordInput
          value={form.confirm}
          onChange={(e: any) => setForm({ ...form, confirm: e.target.value })}
          placeholder="Re-enter password"
        />
      </div>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I agree to the{" "}
          <Link to="/terms" target="_blank" className="text-primary underline">
            Terms & Conditions
          </Link>
          .
        </span>
      </label>
      <Button type="submit" disabled={loading} className="w-full bg-hero shadow-elegant" size="lg">
        {loading ? "Creating…" : "Create Account"}
      </Button>
    </form>
  );
}
