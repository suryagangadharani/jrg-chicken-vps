export interface StoreStatus {
  status: "open" | "closed" | "lunch_break";
  canOrder: boolean;
  message: string;
  badgeLabel: string;
  badgeColor: "emerald" | "amber" | "rose";
  storeOrderingEnabled: boolean;
  manualLunchOverride?: boolean;
}

export function getISTDateParts(): { hour: number; minute: number; timeInMinutes: number } {
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istMs = utcMs + (330 * 60000);
  const istDate = new Date(istMs);

  const hour = istDate.getHours();
  const minute = istDate.getMinutes();
  const timeInMinutes = hour * 60 + minute;

  return { hour, minute, timeInMinutes };
}

export function computeStoreStatus(
  storeOrderingEnabled?: boolean | null,
  manualLunchBreakOverride?: boolean | null
): StoreStatus {
  const isStoreOpen = storeOrderingEnabled !== false; // Default to true unless explicitly closed

  // 1. STORE CLOSED by Admin (storeOrderingEnabled === false)
  if (!isStoreOpen) {
    return {
      status: "closed",
      canOrder: false,
      message: "We're not accepting new orders right now. Normal business hours: 6:00 AM – 8:00 PM IST. Please check back soon.",
      badgeLabel: "Orders Closed",
      badgeColor: "rose",
      storeOrderingEnabled: false,
      manualLunchOverride: Boolean(manualLunchBreakOverride),
    };
  }

  // 2. LUNCH BREAK CHECK (Admin manual ON OR auto 2:00 PM – 4:00 PM IST)
  const { timeInMinutes } = getISTDateParts();
  const lunchStartMinutes = 14 * 60; // 2:00 PM (840)
  const lunchEndMinutes = 16 * 60; // 4:00 PM (960)

  const isAutoLunchBreak = timeInMinutes >= lunchStartMinutes && timeInMinutes < lunchEndMinutes;
  const isLunchActive = manualLunchBreakOverride !== undefined && manualLunchBreakOverride !== null
    ? Boolean(manualLunchBreakOverride)
    : isAutoLunchBreak;

  if (isLunchActive) {
    return {
      status: "lunch_break",
      canOrder: false,
      message: "Our team is currently taking a short lunch break. Ordering will resume when the break ends.",
      badgeLabel: "Lunch Break · Orders Paused",
      badgeColor: "amber",
      storeOrderingEnabled: true,
      manualLunchOverride: true,
    };
  }

  // 3. STORE OPEN
  return {
    status: "open",
    canOrder: true,
    message: "You can place your order now.",
    badgeLabel: "Orders Open · 6:00 AM – 8:00 PM",
    badgeColor: "emerald",
    storeOrderingEnabled: true,
    manualLunchOverride: false,
  };
}
