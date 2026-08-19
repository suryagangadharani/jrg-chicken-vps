import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { realtime } from "@/lib/realtime";
import { dateFmt } from "@/lib/format";
import { Bell, CheckCheck, ShoppingBag, Bike, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export function NotificationCenter() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["user-notifications"],
    queryFn: () => apiClient.notifications.getAll(),
    refetchInterval: 15000,
  });

  const { data: unreadData = { unreadCount: 0 } } = useQuery({
    queryKey: ["unread-notifications-count"],
    queryFn: () => apiClient.notifications.getUnreadCount(),
    refetchInterval: 10000,
  });

  useEffect(() => {
    const unsub = realtime.subscribe("NOTIFICATION_CREATED", () => {
      queryClient.invalidateQueries({ queryKey: ["user-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications-count"] });
    });
    return () => {
      unsub();
    };
  }, [queryClient]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiClient.notifications.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.notifications.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications-count"] });
    },
  });

  const unreadCount = unreadData.unreadCount || 0;

  const handleNotificationClick = (n: any) => {
    if (!n.is_read) {
      markReadMutation.mutate(n.id);
    }
    setOpen(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "NEW_ORDER":
        return <ShoppingBag className="h-4 w-4 text-primary" />;
      case "ORDER_CONFIRMED":
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
      case "ORDER_OUT_FOR_DELIVERY":
        return <Bike className="h-4 w-4 text-indigo-600" />;
      case "ORDER_DELIVERED":
        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      case "ORDER_CANCELLED":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative grid h-9 w-9 place-items-center rounded-lg border border-border bg-card hover:bg-secondary transition"
          aria-label="Notification Center"
        >
          <Bell className="h-4 w-4 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-sm animate-pulse">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80 sm:w-96 p-0 shadow-2xl rounded-2xl border-border" align="end">
        <div className="flex items-center justify-between border-b border-border p-3.5">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-bold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {unreadCount} unread
              </span>
            )}
          </div>

          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              className="text-[11px] text-muted-foreground hover:text-primary h-7 gap-1"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-[380px] overflow-y-auto divide-y divide-border/60">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No notification history yet.
            </div>
          ) : (
            notifications.map((n: any) => (
              <Link
                key={n.id}
                to={n.action_url || "/"}
                onClick={() => handleNotificationClick(n)}
                className={`flex items-start gap-3 p-3.5 transition hover:bg-secondary/60 ${
                  !n.is_read ? "bg-primary/5 font-medium" : "opacity-85"
                }`}
              >
                <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-background border border-border shadow-xs">
                  {getIcon(n.type)}
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-1 text-xs">
                    <span className="font-bold text-foreground truncate">{n.title}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{dateFmt(n.created_at)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{n.message}</p>
                </div>

                {!n.is_read && <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
