export interface StoreStatus {
  status: "open" | "closed" | "lunch_break";
  canOrder: boolean;
  message: string;
  badgeLabel: string;
  badgeColor: "emerald" | "amber" | "rose";
  nextTime?: string;
  isManualLunchOverride?: boolean;
  isManualStoreClosedOverride?: boolean;
}

export function getISTDateParts(): { hour: number; minute: number; timeInMinutes: number } {
  const now = new Date();
  // IST is UTC + 5 hours 30 minutes (330 minutes)
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istMs = utcMs + (330 * 60000);
  const istDate = new Date(istMs);

  const hour = istDate.getHours();
  const minute = istDate.getMinutes();
  const timeInMinutes = hour * 60 + minute;

  return { hour, minute, timeInMinutes };
}

export function computeStoreStatus(
  manualLunchBreakOverride?: boolean | null,
  manualStoreClosedOverride?: boolean | null
): StoreStatus {
  const { timeInMinutes } = getISTDateParts();

  const openTimeInMinutes = 6 * 60; // 6:00 AM (360)
  const closeTimeInMinutes = 20 * 60; // 8:00 PM (1200)

  const lunchStartMinutes = 14 * 60; // 2:00 PM (840)
  const lunchEndMinutes = 16 * 60; // 4:00 PM (960)

  const isOutsideHours = timeInMinutes < openTimeInMinutes || timeInMinutes >= closeTimeInMinutes;
  const isForceClosed = Boolean(manualStoreClosedOverride);

  // Priority 1: Force closed by admin OR outside business hours (6 AM - 8 PM IST)
  if (isForceClosed || isOutsideHours) {
    return {
      status: "closed",
      canOrder: false,
      message: isForceClosed
        ? "JRG Chicken is currently closed by store management."
        : "JRG Chicken accepts orders from 6:00 AM to 8:00 PM. Please return during business hours.",
      badgeLabel: isForceClosed ? "Closed (Admin Lock)" : "Closed · Opens at 6:00 AM",
      badgeColor: "rose",
      nextTime: "6:00 AM",
      isManualStoreClosedOverride: isForceClosed,
      isManualLunchOverride: Boolean(manualLunchBreakOverride),
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
      message: "We're currently on a lunch break (2:00 PM – 4:00 PM IST). Ordering will resume at 4:00 PM.",
      badgeLabel: "Lunch Break · Resumes 4:00 PM",
      badgeColor: "amber",
      nextTime: "4:00 PM",
      isManualLunchOverride: Boolean(manualLunchBreakOverride),
      isManualStoreClosedOverride: isForceClosed,
    };
  }

  // Priority 3: Store Open
  return {
    status: "open",
    canOrder: true,
    message: "We're open and accepting orders!",
    badgeLabel: "Open Now · 6:00 AM – 8:00 PM",
    badgeColor: "emerald",
    isManualLunchOverride: Boolean(manualLunchBreakOverride),
    isManualStoreClosedOverride: isForceClosed,
  };
}
