import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, X, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initFirebasePushNotifications } from "@/lib/fcm-client";

const DISMISS_KEY = "jrg_push_dismissed_v2";

export function FcmRegister() {
  const [needsPrompt, setNeedsPrompt] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
      // Auto-register service worker & sync FCM token with backend
      initFirebasePushNotifications().catch(() => {});
      return;
    }

    if (Notification.permission === "default" && !localStorage.getItem(DISMISS_KEY)) {
      const timer = setTimeout(() => {
        setNeedsPrompt(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const enable = async () => {
    try {
      if (!("Notification" in window)) {
        toast.error("Notifications are not supported on this browser.");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        setNeedsPrompt(false);
        const registered = await initFirebasePushNotifications();
        toast.success("Notifications Enabled! 🔔", {
          description: registered
            ? "Background notifications active! You will get alerts even when the site is closed."
            : "You will receive real-time order status updates.",
          duration: 6000,
        });
      } else {
        toast.error("Notification permission was denied in your browser settings.");
        setNeedsPrompt(false);
      }
    } catch {
      toast.error("Could not enable notifications.");
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setNeedsPrompt(false);
  };

  if (!needsPrompt) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl border border-primary/20 text-foreground animate-in zoom-in-95 duration-200">
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center space-y-4 pt-2">
          <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary border border-primary/20 shadow-md">
            <BellRing className="h-8 w-8 animate-bounce text-primary" />
          </div>

          <div>
            <h3 className="font-display text-xl font-bold text-foreground">
              Enable Notifications 🔔
            </h3>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              Get instant alerts for your order confirmation, preparation progress, and delivery updates!
            </p>
          </div>

          <div className="rounded-2xl bg-secondary/40 p-3 text-left space-y-2 border border-border/60">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span>Real-time Order Status Alerts</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              <span>Live Order Tracking</span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Button
              onClick={enable}
              className="w-full bg-hero text-primary-foreground font-semibold h-11 rounded-xl shadow-elegant transition-all flex items-center justify-center gap-2"
            >
              <BellRing className="h-4 w-4" />
              <span>Enable Notifications</span>
            </Button>
            <Button
              variant="ghost"
              onClick={dismiss}
              className="w-full text-xs text-muted-foreground hover:text-foreground h-9"
            >
              Maybe Later
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
