import { useEffect, useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { realtime } from "@/lib/realtime";
import { notificationSounds, type SoundType } from "@/lib/notification-sounds";
import { BellRing, X, ArrowRight, ShoppingBag, Bike, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotificationToast() {
  const [notification, setNotification] = useState<any | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = realtime.subscribe("NOTIFICATION_CREATED", (data) => {
      if (!data || !data.id) return;
      if (seenIds.current.has(data.id)) return;
      seenIds.current.add(data.id);

      setNotification(data);

      // Play audio chime
      const soundType: SoundType = (data.sound_type as SoundType) || "normal_alert";
      notificationSounds.play(soundType);

      // Auto dismiss soft notifications after 12s (keep loud alerts until manually dismissed)
      if (data.sound_type !== "loud_alert") {
        setTimeout(() => {
          setNotification((prev: any) => (prev?.id === data.id ? null : prev));
        }, 12000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const close = () => {
    notificationSounds.stop();
    setNotification(null);
  };

  if (!notification) return null;

  const isLoud = notification.sound_type === "loud_alert";

  const getIcon = () => {
    switch (notification.type) {
      case "NEW_ORDER":
        return <ShoppingBag className="h-6 w-6 text-primary" />;
      case "ORDER_CONFIRMED":
        return <CheckCircle2 className="h-6 w-6 text-blue-500" />;
      case "ORDER_OUT_FOR_DELIVERY":
        return <Bike className="h-6 w-6 text-indigo-600" />;
      case "ORDER_DELIVERED":
        return <CheckCircle2 className="h-6 w-6 text-emerald-600" />;
      case "ORDER_CANCELLED":
        return <AlertTriangle className="h-6 w-6 text-red-500" />;
      default:
        return <BellRing className="h-6 w-6 text-primary" />;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[90] w-full max-w-md p-2 animate-in slide-in-from-bottom-5 duration-300">
      <div className={`relative rounded-3xl border bg-card p-5 shadow-2xl backdrop-blur ${isLoud ? "border-primary/40 ring-4 ring-primary/10" : "border-border"}`}>
        <button
          onClick={close}
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-4">
          <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${isLoud ? "bg-primary/15 animate-pulse" : "bg-secondary"}`}>
            {getIcon()}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                {notification.type?.replace(/_/g, " ")}
              </span>
            </div>

            <h4 className="font-display text-base font-bold leading-tight text-foreground">
              {notification.title}
            </h4>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {notification.message}
            </p>

            <div className="pt-2 flex items-center gap-2">
              {notification.action_url && (
                <Link
                  to={notification.action_url}
                  onClick={close}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
                >
                  <span>View Details</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={close} className="text-xs text-muted-foreground h-8">
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
