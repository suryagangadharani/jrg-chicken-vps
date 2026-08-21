import { useEffect, useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { realtime } from "@/lib/realtime";
import { notificationSounds, type SoundType } from "@/lib/notification-sounds";
import { BellRing, X, ArrowRight, ShoppingBag, Bike, CheckCircle2, AlertTriangle, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function NotificationToast() {
  const [notification, setNotification] = useState<any | null>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const { user, isAdmin, isDeliveryBoy } = useAuth();

  useEffect(() => {
    const unsubscribe = realtime.subscribe("NOTIFICATION_CREATED", (data) => {
      if (!data || !data.id) return;
      if (seenIds.current.has(data.id)) return;

      // Strict role & user_id recipient verification
      if (data.user_id && user && data.user_id !== user.id) return;
      if (data.role === "admin" && !isAdmin) return;
      if (data.role === "delivery_boy" && !isDeliveryBoy) return;
      if (data.role === "customer" && (isAdmin || isDeliveryBoy) && !data.user_id) return;

      seenIds.current.add(data.id);

      setNotification(data);

      // Play audio chime
      const soundType: SoundType = (data.sound_type as SoundType) || "normal_alert";
      notificationSounds.play(soundType);

      // Auto dismiss after 10 seconds
      setTimeout(() => {
        setNotification((prev: any) => (prev?.id === data.id ? null : prev));
      }, 10000);
    });

    return () => {
      unsubscribe();
    };
  }, [user?.id, isAdmin, isDeliveryBoy]);

  const close = () => {
    notificationSounds.stop();
    setNotification(null);
  };

  if (!notification) return null;

  const isLoud = notification.sound_type === "loud_alert";

  const getBadgeLabel = () => {
    switch (notification.type) {
      case "NEW_ORDER":
        return "NEW ORDER";
      case "ORDER_RECEIVED":
      case "ORDER_PLACED":
        return "ORDER PLACED";
      case "ORDER_CONFIRMED":
        return "ORDER CONFIRMED";
      case "ORDER_PREPARING":
        return "ORDER BEING PREPARED";
      case "ORDER_OUT_FOR_DELIVERY":
        return "OUT FOR DELIVERY";
      case "ORDER_DELIVERED":
        return "ORDER DELIVERED";
      case "ORDER_CANCELLED":
        return "ORDER CANCELLED";
      default:
        return "NOTIFICATION";
    }
  };

  const getIcon = () => {
    switch (notification.type) {
      case "NEW_ORDER":
      case "ORDER_RECEIVED":
      case "ORDER_PLACED":
        return <ShoppingBag className="h-5 w-5 text-primary" />;
      case "ORDER_CONFIRMED":
        return <CheckCircle2 className="h-5 w-5 text-blue-500" />;
      case "ORDER_PREPARING":
        return <ChefHat className="h-5 w-5 text-amber-500" />;
      case "ORDER_OUT_FOR_DELIVERY":
        return <Bike className="h-5 w-5 text-indigo-600" />;
      case "ORDER_DELIVERED":
        return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
      case "ORDER_CANCELLED":
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <BellRing className="h-5 w-5 text-primary" />;
    }
  };

  return (
    <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-[90] w-[calc(100%-2rem)] max-w-md animate-in slide-in-from-bottom-5 duration-300">
      <div className="relative rounded-3xl border border-primary/20 bg-card/95 p-4 shadow-2xl backdrop-blur-md ring-1 ring-black/5">
        <button
          onClick={close}
          className="absolute right-3.5 top-3.5 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3.5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 border border-primary/15">
            {getIcon()}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary uppercase">
                {getBadgeLabel()}
              </span>
            </div>

            <h4 className="font-display text-sm font-bold leading-snug text-foreground">
              {notification.title}
            </h4>

            <p className="text-xs text-muted-foreground leading-normal">
              {notification.message}
            </p>

            <div className="pt-2 flex items-center gap-2">
              {notification.action_url && (
                <Link
                  to={notification.action_url}
                  onClick={close}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
                >
                  <span>View Details</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={close} className="text-xs text-muted-foreground h-7 px-2.5">
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

