export const inr = (n: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n) || 0);

export const dateFmt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export const statusLabel: Record<string, string> = {
  placed: "Order Placed",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const statusColor: Record<string, string> = {
  placed: "bg-warning/20 text-warning-foreground border-warning/30",
  confirmed: "bg-accent text-accent-foreground",
  preparing: "bg-accent text-accent-foreground",
  out_for_delivery: "bg-primary/15 text-primary border-primary/30",
  delivered: "bg-success/20 text-success border-success/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};
