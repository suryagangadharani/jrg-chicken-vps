import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface CartItem {
  product_id: string;
  name: string;
  slug: string;
  price_per_kg: number;
  image: string | null;
  qty_kg: number; // in 0.5 kg units
}

interface CartCtx {
  items: CartItem[];
  add: (i: Omit<CartItem, "qty_kg">, qty?: number) => void;
  update: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
}

const Ctx = createContext<CartCtx | null>(null);
const KEY = "rcc_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(items));
  }, [items, ready]);

  const add: CartCtx["add"] = (i, qty = 1) => {
    setItems((cur) => {
      const existing = cur.find((x) => x.product_id === i.product_id);
      if (existing) return cur.map((x) => x.product_id === i.product_id ? { ...x, qty_kg: +(x.qty_kg + qty).toFixed(2) } : x);
      return [...cur, { ...i, qty_kg: qty }];
    });
  };
  const update: CartCtx["update"] = (id, qty) =>
    setItems((cur) => cur.map((x) => x.product_id === id ? { ...x, qty_kg: qty } : x).filter((x) => x.qty_kg > 0));
  const remove: CartCtx["remove"] = (id) => setItems((cur) => cur.filter((x) => x.product_id !== id));
  const clear = () => setItems([]);

  const count = items.reduce((s, x) => s + 1, 0);
  const subtotal = items.reduce((s, x) => s + x.price_per_kg * x.qty_kg, 0);

  return <Ctx.Provider value={{ items, add, update, remove, clear, count, subtotal }}>{children}</Ctx.Provider>;
}

export const useCart = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be inside CartProvider");
  return c;
};
