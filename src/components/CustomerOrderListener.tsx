import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export function CustomerOrderListener() {
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    if (!user || isAdmin) return;

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [user?.id, isAdmin]);

  return null;
}

