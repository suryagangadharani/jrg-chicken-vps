import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { realtime } from "@/lib/realtime";

export function useRealtimeOrders() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubCreated = realtime.subscribe("ORDER_CREATED", () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-orders"] });
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
    });

    const unsubUpdated = realtime.subscribe("ORDER_UPDATED", () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-orders"] });
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order"] });
    });

    return () => {
      unsubCreated();
      unsubUpdated();
    };
  }, [queryClient]);
}
