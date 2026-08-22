import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — JRG Chicken" },
      { name: "description", content: "Sign in to JRG Chicken with your mobile number, email, or Google account to order fresh exclusive chicken cuts." },
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

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" {...props}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function GoogleAuthButton({ label = "Continue with Google" }: { label?: string }) {
  const [loading, setLoading] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");

  const nav = useNavigate();
  const { refetchUser } = useAuth();

  const handleGoogleTokenSuccess = async (data: { credential?: string; access_token?: string; email?: string; full_name?: string }) => {
    setLoading(true);
    try {
      const res = await apiClient.auth.googleLogin(data);
      await refetchUser();
      setLoading(false);
      setPromptOpen(false);

      const user = res.user;
      if (user?.role === "admin") {
        toast.success("🎉 Welcome Admin! Account authenticated with Google.");
        window.location.href = "/admin";
      } else if (user?.role === "delivery_boy") {
        toast.success(`Welcome ${user?.full_name || "Delivery Partner"}! 🚴`);
        window.location.href = "/delivery";
      } else {
        toast.success(`Welcome back, ${user?.full_name || "customer"}! Logged in with Google 🎉`);
        nav({ to: "/" });
      }
    } catch (err: any) {
      setLoading(false);
      toast.error(err?.message || "Google sign in failed");
    }
  };

  const handleGoogleClick = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId || clientId === "undefined" || clientId.trim() === "") {
      setPromptOpen(true);
      return;
    }

    setLoading(true);

    // 1. GIS Token Client (Primary method for custom button - opens Google OAuth popup)
    if (typeof window !== "undefined" && (window as any).google?.accounts?.oauth2) {
      try {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "openid email profile",
          callback: async (response: any) => {
            if (response?.access_token) {
              await handleGoogleTokenSuccess({ access_token: response.access_token });
            } else {
              setLoading(false);
              if (response?.error && response.error !== "popup_closed_by_user") {
                toast.error("Google sign in was cancelled or failed.");
              }
            }
          },
          error_callback: (err: any) => {
            console.error("GIS Token Client error:", err);
            setLoading(false);
            setPromptOpen(true);
          },
        });
        tokenClient.requestAccessToken();
        return;
      } catch (e) {
        console.warn("GIS oauth2 init error, falling back to id client:", e);
      }
    }

    // 2. GIS ID Client (Fallback if oauth2 namespace is unavailable)
    if (typeof window !== "undefined" && (window as any).google?.accounts?.id) {
      try {
        (window as any).google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: any) => {
            if (response?.credential) {
              handleGoogleTokenSuccess({ credential: response.credential });
            } else {
              setLoading(false);
            }
          },
          auto_select: false,
        });

        (window as any).google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment() || notification.isDismissedMoment()) {
            setLoading(false);
            setPromptOpen(true);
          }
        });
        return;
      } catch (e) {
        console.warn("GIS id client error:", e);
      }
    }

    setLoading(false);
    setPromptOpen(true);
  };

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("Please enter a valid Google email address.");
    handleGoogleTokenSuccess({ email: email.trim(), full_name: fullName.trim() || undefined });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={handleGoogleClick}
        disabled={loading}
        className="w-full relative flex items-center justify-center gap-3 border-border hover:bg-accent/50 transition-all font-medium py-5 shadow-sm rounded-xl"
      >
        <GoogleIcon />
        <span>{loading ? "Connecting to Google..." : label}</span>
      </Button>

      <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GoogleIcon /> Google Sign In
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePromptSubmit} className="space-y-4 pt-2">
            <p className="text-xs text-muted-foreground">
              Enter your Google account email to sign in or create your JRG Chicken account instantly.
            </p>
            <div>
              <Label htmlFor="g-email">Google Email Address *</Label>
              <Input
                id="g-email"
                type="email"
                placeholder="your.email@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="g-name">Your Full Name (Optional)</Label>
              <Input
                id="g-name"
                type="text"
                placeholder="e.g. Ramesh Kumar"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full bg-primary font-semibold" disabled={loading}>
              {loading ? "Signing in..." : "Continue with Google Account"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AuthPage() {
  const nav = useNavigate();
  const { user, refetchUser } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (user.role === "admin") {
      window.location.href = "/admin";
    } else if (user.role === "delivery_boy") {
      window.location.href = "/delivery";
    }
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    const search = window.location.search;
    if (!hash && !search) return;

    const params = new URLSearchParams(hash.replace(/^#/, "") || search.replace(/^\?/, ""));
    const idToken = params.get("id_token") || params.get("credential");
    const accessToken = params.get("access_token");
    const error = params.get("error");

    if (error) {
      window.history.replaceState(null, "", window.location.pathname);
      toast.error("Google authentication was cancelled or denied.");
      return;
    }

    if (idToken || accessToken) {
      window.history.replaceState(null, "", window.location.pathname);
      (async () => {
        try {
          toast.loading("Authenticating with Google...", { id: "g-auth" });
          const res = await apiClient.auth.googleLogin({
            credential: idToken || undefined,
            access_token: accessToken || undefined,
          });
          await refetchUser();
          toast.dismiss("g-auth");

          if (res.user?.role === "admin") {
            toast.success("🎉 Welcome Admin! Your account has full Admin access.");
            window.location.href = "/admin";
          } else if (res.user?.role === "delivery_boy") {
            toast.success(`Welcome ${res.user?.full_name || "Delivery Partner"}! 🚴`);
            window.location.href = "/delivery";
          } else {
            toast.success(`Welcome back, ${res.user?.full_name || "customer"}! 🎉`);
            nav({ to: "/" });
          }
        } catch (err: any) {
          toast.dismiss("g-auth");
          toast.error(err?.message || "Google authentication failed");
        }
      })();
    }
  }, []);

  return (
    <div className="min-h-screen bg-warm">
      <Navbar />
      <main className="mx-auto grid max-w-md px-4 py-8 md:px-6 md:py-10">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-elegant sm:p-6 md:p-8">
          <h1 className="font-display text-2xl font-bold text-center sm:text-3xl">Welcome</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Sign in with Google, mobile number, or email.
          </p>

          <div className="mt-5">
            <GoogleAuthButton label="Continue with Google" />
          </div>

          <div className="relative my-5 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <span className="relative bg-card px-3 text-xs uppercase tracking-wider text-muted-foreground">
              Or continue with
            </span>
          </div>

          <Tabs defaultValue="signin">
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
      } else if (user?.role === "delivery_boy") {
        toast.success(`Welcome ${user?.full_name || "Delivery Partner"}! 🚴 Opening Delivery Dashboard...`);
        window.location.href = "/delivery";
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
          placeholder="Mobile or email address"
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
      const res = await apiClient.auth.register({
        email,
        password: form.password,
        full_name: form.full_name,
        phone: cleanPhone,
      });

      await refetchUser();
      setLoading(false);

      if (res.user?.role === "admin" || res.isFirstUser) {
        toast.success("🎉 Account created! As the first registered user, you are now the Admin!");
        window.location.href = "/admin";
      } else {
        toast.success("Account created successfully — welcome!");
        nav({ to: "/" });
      }
    } catch (err: any) {
      setLoading(false);
      toast.error(err?.message || "Sign up failed. Please try again.");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Full Name</Label>
        <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="John Doe" />
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
          placeholder="10-digit mobile number"
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
