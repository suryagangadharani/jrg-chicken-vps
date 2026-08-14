import { apiClient } from "@/lib/api-client";

export interface PromoResult {
  code: string;
  discount: number;
  description?: string | null;
}

export async function validatePromoCode(
  rawCode: string,
  subtotal: number,
  _totalKg: number
): Promise<{ ok: true; promo: PromoResult } | { ok: false; error: string }> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a promo code" };

  try {
    const res = await apiClient.promos.validate(code, subtotal);
    if (!res.valid) return { ok: false, error: "Invalid promo code" };
    return {
      ok: true,
      promo: {
        code: res.promo.code,
        discount: res.discount,
        description: res.promo.description,
      },
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Invalid promo code" };
  }
}

export async function incrementPromoUsage(_code: string) {
  // Handled automatically on backend order placement
}
