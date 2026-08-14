import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart-context";
import { inr } from "@/lib/format";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/cart")({
  ssr: false,
  component: CartPage,
  head: () => ({
    meta: [
      { title: "Your Cart — JRG Chicken" },
      { name: "description", content: "Review your JRG Chicken cart and proceed to checkout." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function CartPage() {
  const { items, update, remove, subtotal, clear } = useCart();
  const nav = useNavigate();
  const total = subtotal;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <h1 className="font-display text-3xl font-bold md:text-4xl">Your Cart</h1>
        {items.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed p-12 text-center">
            <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-semibold">Cart is empty</p>
            <p className="text-sm text-muted-foreground">Start adding fresh chicken to your order.</p>
            <Link to="/products"><Button className="mt-4">Browse products</Button></Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
            <aside className="order-1 h-fit rounded-2xl border border-border bg-card p-5 shadow-card lg:sticky lg:top-24 lg:order-none">
              <h2 className="text-lg font-bold">Order Summary</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-semibold">{inr(subtotal)}</dd></div>
                <div className="border-t pt-2 flex justify-between text-base"><dt className="font-bold">Total</dt><dd className="font-bold text-primary">{inr(total)}</dd></div>
              </dl>
              <Button className="mt-4 w-full bg-hero shadow-elegant" size="lg" onClick={() => nav({ to: "/checkout" })}>Proceed to Checkout</Button>
            </aside>

            <div className="order-2 space-y-3 lg:order-none">
              {items.map((i) => (
                <div key={i.product_id} className="flex gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-secondary">
                    {i.image ? <img src={i.image} alt={i.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-3xl">🍗</div>}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <Link to="/products/$slug" params={{ slug: i.slug }} className="font-semibold hover:text-primary line-clamp-1">{i.name}</Link>
                      <button onClick={() => remove(i.product_id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <div className="text-sm text-muted-foreground">{inr(i.price_per_kg)}/kg</div>
                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => {
                            const next = +(i.qty_kg - 0.5).toFixed(2);
                            if (next < 1) remove(i.product_id);
                            else update(i.product_id, next);
                          }}><Minus className="h-3 w-3" /></Button>
                          <span className="w-14 text-center text-sm font-semibold">{i.qty_kg} kg</span>
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => update(i.product_id, +(i.qty_kg + 0.5).toFixed(2))}><Plus className="h-3 w-3" /></Button>
                        </div>
                        <div className="font-bold text-primary">{inr(i.price_per_kg * i.qty_kg)}</div>
                      </div>
                  </div>
                </div>
              ))}
              <button onClick={clear} className="text-sm text-muted-foreground hover:text-destructive">Clear cart</button>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
