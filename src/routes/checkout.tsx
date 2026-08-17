import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";
import { inr } from "@/lib/format";
import { CheckCircle2, Tag, X, Scissors } from "lucide-react";

export const Route = createFileRoute("/checkout")({
  ssr: false,
  component: CheckoutPage,
});

function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const { user, fullName } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [placedNumber, setPlacedNumber] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<any | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    line1: "",
    line2: "",
    city: "Jangareddygudem",
    pincode: "",
    landmark: "",
    payment_method: "cod" as "cod" | "online",
    cutting_notes: "",
  });

  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;
    (async () => {
      try {
        const prof = await apiClient.user.getProfile();
        if (!isMounted) return;
        if (prof) {
          setForm((f) => ({
            ...f,
            customer_name: prof.full_name || f.customer_name,
            customer_phone: prof.phone || f.customer_phone,
          }));
        }
        const addresses = await apiClient.user.getAddresses();
        if (!isMounted) return;
        if (addresses && addresses.length > 0) {
          const a = addresses[0];
          setForm((f) => ({
            ...f,
            line1: a.line1,
            line2: a.line2 || "",
            city: a.city,
            pincode: a.pincode,
            landmark: a.landmark || "",
            customer_name: f.customer_name || a.full_name,
            customer_phone: f.customer_phone || a.phone,
          }));
        }
      } catch {}
    })();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const deliveryFee = 0;
  const discount = promo?.discount ?? 0;
  const total = Math.max(0, subtotal - discount);

  const applyPromo = async () => {
    setPromoBusy(true);
    try {
      const res = await apiClient.promos.validate(promoInput, subtotal);
      setPromoBusy(false);
      if (!res.valid) {
        setPromo(null);
        return toast.error("Invalid promo code");
      }
      setPromo({ code: promoInput, discount: res.discount });
      toast.success(`${promoInput} applied — you saved ${inr(res.discount)}!`);
    } catch (err: any) {
      setPromoBusy(false);
      setPromo(null);
      toast.error(err?.message || "Failed to validate promo code");
    }
  };

  const removePromo = () => {
    setPromo(null);
    setPromoInput("");
  };

  if (items.length === 0 && !placedNumber) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <p>Your cart is empty.</p>
          <Button className="mt-4" onClick={() => nav({ to: "/products" })}>
            Browse products
          </Button>
        </div>
      </div>
    );
  }

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return nav({ to: "/auth" });
    if (form.payment_method === "online") return toast.error("Online payment coming soon — please choose COD");
    setLoading(true);

    try {
      const orderPayload = {
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_email: user.email,
        address_line1: form.line1,
        address_line2: form.line2 || null,
        city: form.city,
        pincode: form.pincode,
        landmark: form.landmark || null,
        items: items.map((i) => ({
          product_id: i.product_id,
          name: i.name,
          qty_kg: i.qty_kg,
          price: i.price_per_kg,
        })),
        subtotal,
        delivery_fee: deliveryFee,
        discount,
        total,
        payment_method: form.payment_method,
      };

      const createdOrder = await apiClient.orders.createOrder(orderPayload);
      const assignedNumber = createdOrder.order_number || createdOrder.id;

      // Auto save address to user's saved addresses
      try {
        await apiClient.user.addAddress({
          full_name: form.customer_name,
          phone: form.customer_phone,
          line1: form.line1,
          line2: form.line2 || "",
          city: form.city,
          pincode: form.pincode,
          landmark: form.landmark || "",
        });
      } catch {}

      setPlacedNumber(assignedNumber);
      clear();
      toast.success("Order placed successfully! 🎉");
    } catch (err: any) {
      console.error("Unexpected error in placeOrder:", err);
      toast.error(err?.message || "An error occurred while processing your order.");
    } finally {
      setLoading(false);
    }
  };

  if (placedNumber) {
    return (
      <div className="min-h-screen bg-warm">
        <Navbar />
        <div className="mx-auto max-w-lg px-4 py-16">
          <div className="rounded-3xl bg-card p-8 text-center shadow-elegant">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/20">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <h1 className="mt-4 font-display text-3xl font-bold">Order Placed!</h1>
            <p className="mt-2 text-muted-foreground">
              Thanks {fullName?.split(" ")[0] || ""} — we've received your order and will call you shortly to confirm.
            </p>
            <div className="mt-4 rounded-xl bg-secondary p-3 text-lg font-bold text-primary">{placedNumber}</div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" onClick={() => nav({ to: "/orders" })}>
                View my orders
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => nav({ to: "/products" })}>
                Shop more
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <h1 className="font-display text-3xl font-bold md:text-4xl">Checkout</h1>
        {fullName && (
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back, <span className="font-semibold text-foreground">{fullName.split(" ")[0]}</span> 👋
          </p>
        )}
        <form onSubmit={placeOrder} className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h2 className="font-semibold">Contact</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Full Name</Label>
                  <Input
                    required
                    value={form.customer_name}
                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    required
                    type="tel"
                    value={form.customer_phone}
                    onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                  />
                </div>
              </div>
            </section>
            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h2 className="font-semibold">Delivery Address</h2>
              <div className="mt-3 grid gap-3">
                <div>
                  <Label>Address Line 1</Label>
                  <Input
                    required
                    value={form.line1}
                    onChange={(e) => setForm({ ...form, line1: e.target.value })}
                    placeholder="House / Flat / Street"
                  />
                </div>
                <div>
                  <Label>Address Line 2 (optional)</Label>
                  <Input
                    value={form.line2}
                    onChange={(e) => setForm({ ...form, line2: e.target.value })}
                    placeholder="Area / Colony"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>City</Label>
                    <Input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </div>
                  <div>
                    <Label>Pincode</Label>
                    <Input required value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Landmark (optional)</Label>
                  <Input value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
                  <Scissors className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-semibold">
                    Meat cutting instructions <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </h2>
                  <p className="text-xs text-muted-foreground">Add any notes for how you'd like your chicken cut.</p>
                </div>
              </div>
              <Textarea
                className="mt-3"
                placeholder="e.g. small curry cut, boneless, remove skin, biryani cut…"
                value={form.cutting_notes}
                onChange={(e) => setForm({ ...form, cutting_notes: e.target.value })}
                maxLength={200}
              />
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h2 className="font-semibold">Payment Method</h2>
              <RadioGroup
                value={form.payment_method}
                onValueChange={(v) => setForm({ ...form, payment_method: v as any })}
                className="mt-3 space-y-2"
              >
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                  <RadioGroupItem value="cod" id="cod" />
                  <div className="flex-1">
                    <div className="font-semibold">Cash on Delivery</div>
                    <div className="text-xs text-muted-foreground">Pay when your order arrives</div>
                  </div>
                  <span className="text-xs font-semibold text-success">Recommended</span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 opacity-60">
                  <RadioGroupItem value="online" id="online" disabled />
                  <div className="flex-1">
                    <div className="font-semibold">Pay Online</div>
                    <div className="text-xs text-muted-foreground">Coming soon — UPI / Cards</div>
                  </div>
                </label>
              </RadioGroup>
            </section>
          </div>

          <aside className="h-fit space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card lg:sticky lg:top-24">
            <h2 className="text-lg font-bold">Order Summary</h2>
            <ul className="max-h-56 space-y-2 overflow-auto text-sm">
              {items.map((i) => (
                <li key={i.product_id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {i.name} × {i.qty_kg} kg
                  </span>
                  <span className="font-semibold shrink-0">{inr(i.price_per_kg * i.qty_kg)}</span>
                </li>
              ))}
            </ul>

            <div className="border-t pt-3">
              {promo ? (
                <div className="flex items-center justify-between rounded-lg bg-success/10 p-2 text-sm">
                  <span className="flex items-center gap-1.5 font-semibold text-success">
                    <Tag className="h-4 w-4" />
                    {promo.code} · −{inr(promo.discount)}
                  </span>
                  <button
                    type="button"
                    onClick={removePromo}
                    aria-label="Remove promo"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      placeholder="Promo code"
                      className="pl-8 uppercase"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyPromo}
                    disabled={promoBusy || !promoInput.trim()}
                  >
                    {promoBusy ? "…" : "Apply"}
                  </Button>
                </div>
              )}
            </div>

            <dl className="space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{inr(subtotal)}</dd>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-success">
                  <dt>Promo discount</dt>
                  <dd>− {inr(discount)}</dd>
                </div>
              )}

              <div className="flex justify-between border-t pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd className="text-primary">{inr(total)}</dd>
              </div>
            </dl>
            <Button
              type="submit"
              disabled={loading}
              size="lg"
              className="w-full bg-hero shadow-elegant"
            >
              {loading ? "Placing…" : `Place Order · ${inr(total)}`}
            </Button>
          </aside>
        </form>
      </main>
      <Footer />
    </div>
  );
}
