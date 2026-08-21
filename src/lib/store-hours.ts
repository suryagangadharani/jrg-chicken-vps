export interface StoreStatus {
  status: "open" | "closed" | "lunch_break";
  canOrder: boolean;
  message: string;
  badgeLabel: string;
  badgeColor: "emerald" | "amber" | "rose";
  nextTime?: string;
  isManualLunchOverride?: boolean;
}

export function computeStoreStatus(manualLunchBreakOverride?: boolean | null): StoreStatus {
  // Calculate current IST time (Asia/Kolkata timezone: UTC + 5:30)
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Kolkata",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  };
  const parts = new Intl.DateTimeFormat("en-US", options).formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);

  const timeInMinutes = hour * 60 + minute;
  const openTimeInMinutes = 6 * 60; // 6:00 AM (360)
  const closeTimeInMinutes = 20 * 60; // 8:00 PM (1200)

  const lunchStartMinutes = 14 * 60; // 2:00 PM (840)
  const lunchEndMinutes = 16 * 60; // 4:00 PM (960)

  // Priority 1: Outside business hours (outside 6 AM - 8 PM IST)
  if (timeInMinutes < openTimeInMinutes || timeInMinutes >= closeTimeInMinutes) {
    return {
      status: "closed",
      canOrder: false,
      message: "JRG Chicken is currently closed. Our ordering hours are 6:00 AM to 8:00 PM.",
      badgeLabel: "Closed · Opens at 6:00 AM",
      badgeColor: "rose",
      nextTime: "6:00 AM",
    };
  }

  // Priority 2: Lunch break active (2:00 PM - 4:00 PM IST OR Admin manual toggle ON)
  const isAutoLunchBreak = timeInMinutes >= lunchStartMinutes && timeInMinutes < lunchEndMinutes;
  const isLunchActive = manualLunchBreakOverride !== undefined && manualLunchBreakOverride !== null
    ? Boolean(manualLunchBreakOverride)
    : isAutoLunchBreak;

  if (isLunchActive) {
    return {
      status: "lunch_break",
      canOrder: false,
      message: "We're currently on a lunch break. Ordering will resume at 4:00 PM.",
      badgeLabel: "Lunch Break · Resumes 4:00 PM",
      badgeColor: "amber",
      nextTime: "4:00 PM",
      isManualLunchOverride: Boolean(manualLunchBreakOverride),
    };
  }

  // Priority 3: Open
  return {
    status: "open",
    canOrder: true,
    message: "We're open and accepting orders!",
    badgeLabel: "Open Now · 6:00 AM – 8:00 PM",
    badgeColor: "emerald",
  };
}
