import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { realtime } from "@/lib/realtime";
import { dateFmt } from "@/lib/format";
import { Bell, CheckCheck, Trash2, ShoppingBag, Bike, CheckCircle2, AlertTriangle, ChefHat, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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

  const deleteSingleMutation = useMutation({
    mutationFn: (id: string) => apiClient.notifications.deleteSingle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications-count"] });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => apiClient.notifications.deleteAll(),
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
      case "ORDER_RECEIVED":
      case "ORDER_PLACED":
        return <ShoppingBag className="h-4 w-4 text-primary" />;
      case "ORDER_CONFIRMED":
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
      case "ORDER_PREPARING":
        return <ChefHat className="h-4 w-4 text-amber-500" />;
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
          className="relative grid h-9 w-9 place-items-center rounded-xl border border-border bg-card hover:bg-secondary transition shadow-sm"
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

      <PopoverContent className="w-80 sm:w-96 p-0 shadow-2xl rounded-2xl border-border bg-card" align="end">
        <div className="flex items-center justify-between border-b border-border/80 p-3.5 bg-secondary/30 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-bold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {unreadCount} unread
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                className="text-[11px] text-muted-foreground hover:text-primary h-7 px-2 gap-1"
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Mark all as read</span>
              </Button>
            )}

            {notifications.length > 0 && (
              <ConfirmDialog
                title="Delete all notifications?"
                description="This will permanently remove all stored notifications."
                confirmLabel="Delete"
                cancelLabel="Cancel"
                destructive
                onConfirm={() => deleteAllMutation.mutateAsync()}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[11px] text-muted-foreground hover:text-destructive h-7 px-2 gap-1"
                  title="Delete all notifications"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Delete all</span>
                </Button>
              </ConfirmDialog>
            )}
          </div>
        </div>

        <div className="max-h-[380px] overflow-y-auto divide-y divide-border/50">
          {notifications.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                <Bell className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-sm text-foreground">No notifications</h4>
              <p className="text-xs text-muted-foreground">You're all caught up.</p>
            </div>
          ) : (
            notifications.map((n: any) => (
              <div
                key={n.id}
                className={`group relative flex items-start gap-3 p-3.5 transition hover:bg-secondary/60 ${
                  !n.is_read ? "bg-primary/5 font-medium" : "opacity-85"
                }`}
              >
                <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-card border border-border/80 shadow-xs">
                  {getIcon(n.type)}
                </div>

                <Link
                  to={n.action_url || "/"}
                  onClick={() => handleNotificationClick(n)}
                  className="min-w-0 flex-1 space-y-0.5 pr-6"
                >
                  <div className="flex items-center justify-between gap-1 text-xs">
                    <span className="font-bold text-foreground truncate">{n.title}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{n.message}</p>
                  <div className="text-[10px] text-muted-foreground pt-1">{dateFmt(n.created_at)}</div>
                </Link>

                <div className="absolute right-3 top-3 flex items-center gap-1.5">
                  {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSingleMutation.mutate(n.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition rounded-md hover:bg-secondary"
                    title="Delete notification"
                    aria-label="Delete notification"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

