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
import { CheckCircle2, Tag, X, Scissors, Lock, UtensilsCrossed, Moon } from "lucide-react";
import { computeStoreStatus, StoreStatus } from "@/lib/store-hours";

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
    pincode: "534447",
    landmark: "",
    payment_method: "cod" as "cod" | "online",
    cutting_notes: "",
  });

  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressMode, setAddressMode] = useState<"selected" | "change" | "new" | "manual">("manual");

  const [newAddr, setNewAddr] = useState({
    label: "Home",
    full_name: "",
    phone: "",
    line1: "",
    line2: "",
    city: "Jangareddygudem",
    pincode: "534447",
    landmark: "",
  });

  const loadUserDataAndAddresses = async () => {
    if (!user?.id) return;
    try {
      const prof = await apiClient.user.getProfile();
      if (prof) {
        setForm((f) => ({
          ...f,
          customer_name: prof.full_name || f.customer_name,
          customer_phone: prof.phone || f.customer_phone,
        }));
        setNewAddr((a) => ({
          ...a,
          full_name: prof.full_name || a.full_name,
          phone: prof.phone || a.phone,
        }));
      }

      const addresses = await apiClient.user.getAddresses();
      if (addresses && addresses.length > 0) {
        setSavedAddresses(addresses);
        const def = addresses.find((a: any) => a.is_default) || addresses[0];
        setSelectedAddressId(def.id);
        setForm((f) => ({
          ...f,
          line1: def.line1,
          line2: def.line2 || "",
          city: def.city,
          pincode: def.pincode,
          landmark: def.landmark || "",
          customer_name: def.full_name || f.customer_name,
          customer_phone: def.phone || f.customer_phone,
        }));
        setAddressMode("selected");
      } else {
        setAddressMode("manual");
      }
    } catch {}
  };

  useEffect(() => {
    loadUserDataAndAddresses();
  }, [user?.id]);

  const selectAddress = (addr: any) => {
    setSelectedAddressId(addr.id);
    setForm((f) => ({
      ...f,
      line1: addr.line1,
      line2: addr.line2 || "",
      city: addr.city,
      pincode: addr.pincode,
      landmark: addr.landmark || "",
      customer_name: addr.full_name || f.customer_name,
      customer_phone: addr.phone || f.customer_phone,
    }));
    setAddressMode("selected");
  };

  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await apiClient.user.addAddress(newAddr);
      toast.success("New address saved!");
      await loadUserDataAndAddresses();
      if (created?.id) {
        selectAddress(created);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to save new address");
    }
  };

  const selectedAddress = useMemo(() => {
    return savedAddresses.find((a) => a.id === selectedAddressId) || savedAddresses[0];
  }, [savedAddresses, selectedAddressId]);

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

  const [storeStatus, setStoreStatus] = useState<StoreStatus>(() => computeStoreStatus());

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const remoteObj = await apiClient.storeStatus.get();
        if (remoteObj && isMounted) {
          setStoreStatus(remoteObj);
        }
      } catch {
        if (isMounted) setStoreStatus(computeStoreStatus());
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Please sign in or create an account to place an order.");
      nav({ to: "/auth", search: { redirect: "/checkout" } as any });
      return;
    }

    if (!storeStatus.canOrder) {
      toast.error(storeStatus.message);
      return;
    }

    if (form.payment_method === "online") return toast.error("Online payment coming soon — please choose COD");
    setLoading(true);

    try {
      const orderPayload = {
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_email: user?.email || null,
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
            <section className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-base flex items-center gap-2">
                  📍 Delivery Address
                </h2>
                {addressMode === "selected" && (
                  <button
                    type="button"
                    onClick={() => setAddressMode("change")}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Change Address
                  </button>
                )}
              </div>

              {/* 1. SELECTED ADDRESS CARD MODE (Matching Sections 2 & 3) */}
              {addressMode === "selected" && selectedAddress && (
                <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 space-y-2.5 transition">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
                      ✓ Selected ({selectedAddress.label || "Home"})
                    </span>
                    <button
                      type="button"
                      onClick={() => setAddressMode("change")}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Change
                    </button>
                  </div>

                  <div className="space-y-1 text-xs text-foreground">
                    <p className="font-bold text-sm text-foreground">
                      👤 {form.customer_name || selectedAddress.full_name} · 📞 {form.customer_phone || selectedAddress.phone}
                    </p>
                    <p className="font-semibold text-xs leading-snug text-foreground">
                      🏠 {selectedAddress.line1}
                      {selectedAddress.line2 ? `, ${selectedAddress.line2}` : ""}
                    </p>
                    <p className="font-medium text-muted-foreground">
                      📍 {selectedAddress.city} - <span className="font-bold text-foreground">{selectedAddress.pincode}</span>
                    </p>
                    {selectedAddress.landmark && (
                      <div className="mt-1 font-semibold text-amber-700 dark:text-amber-400 text-[11px]">
                        📍 Landmark: {selectedAddress.landmark}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-primary/10 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAddressMode("change")}
                      className="text-xs font-semibold rounded-xl"
                    >
                      Change Address
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewAddr({
                          label: "Home",
                          full_name: form.customer_name || user?.full_name || "",
                          phone: form.customer_phone || user?.phone || "",
                          line1: "",
                          line2: "",
                          city: "Jangareddygudem",
                          pincode: "",
                          landmark: "",
                        });
                        setAddressMode("new");
                      }}
                      className="text-xs font-semibold rounded-xl text-primary border-primary/30"
                    >
                      + Add New Address
                    </Button>
                  </div>
                </div>
              )}

              {/* 2. CHANGE ADDRESS LIST MODE */}
              {addressMode === "change" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground font-medium">Select one of your saved delivery addresses:</p>
                  <div className="grid gap-2.5">
                    {savedAddresses.map((addr) => {
                      const isSel = addr.id === selectedAddressId;
                      return (
                        <div
                          key={addr.id}
                          onClick={() => selectAddress(addr)}
                          className={`cursor-pointer rounded-2xl border p-3.5 transition flex items-start gap-3 ${
                            isSel
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border bg-card hover:border-primary/40"
                          }`}
                        >
                          <div className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${isSel ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}>
                            {isSel && <div className="h-2 w-2 rounded-full bg-white" />}
                          </div>
                          <div className="min-w-0 flex-1 text-xs space-y-0.5">
                            <div className="font-bold text-foreground flex items-center gap-2">
                              {addr.label || "Home"}
                              {isSel && <span className="text-[10px] font-bold text-primary">✓ Selected</span>}
                            </div>
                            <div className="font-medium text-foreground">{addr.full_name} · {addr.phone}</div>
                            <div className="text-muted-foreground">{addr.line1}, {addr.city} - {addr.pincode}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      type="button"
                      onClick={() => {
                        setNewAddr({
                          label: "Home",
                          full_name: form.customer_name || user?.full_name || "",
                          phone: form.customer_phone || user?.phone || "",
                          line1: "",
                          line2: "",
                          city: "Jangareddygudem",
                          pincode: "",
                          landmark: "",
                        });
                        setAddressMode("new");
                      }}
                      className="bg-primary text-xs font-bold rounded-xl text-primary-foreground"
                    >
                      + Add New Address
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAddressMode("selected")}
                      className="text-xs rounded-xl"
                    >
                      Back
                    </Button>
                  </div>
                </div>
              )}

              {/* 3. ADD NEW ADDRESS FORM MODE */}
              {addressMode === "new" && (
                <div className="rounded-2xl border border-primary/20 bg-card p-4 space-y-3 animate-in fade-in duration-200">
                  <h3 className="text-xs font-bold text-foreground">Add New Address</h3>
                  <div>
                    <Label className="text-xs text-muted-foreground">Address Label</Label>
                    <div className="mt-1 flex gap-2">
                      {["Home", "Work", "Other"].map((lbl) => (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() => setNewAddr({ ...newAddr, label: lbl })}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${
                            newAddr.label === lbl
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-secondary/40 border-border text-foreground hover:bg-secondary"
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Full Name</Label>
                      <Input
                        required
                        value={newAddr.full_name}
                        onChange={(e) => setNewAddr({ ...newAddr, full_name: e.target.value })}
                        className="mt-0.5 h-9 text-xs rounded-lg"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Phone Number</Label>
                      <Input
                        required
                        type="tel"
                        value={newAddr.phone}
                        onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })}
                        className="mt-0.5 h-9 text-xs rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Address Line 1</Label>
                    <Input
                      required
                      value={newAddr.line1}
                      onChange={(e) => setNewAddr({ ...newAddr, line1: e.target.value })}
                      placeholder="Door No / Street / Flat"
                      className="mt-0.5 h-9 text-xs rounded-lg"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Address Line 2 (Optional)</Label>
                    <Input
                      value={newAddr.line2}
                      onChange={(e) => setNewAddr({ ...newAddr, line2: e.target.value })}
                      placeholder="Area / Colony"
                      className="mt-0.5 h-9 text-xs rounded-lg"
                    />
                  </div>
                  <div className="grid gap-2 grid-cols-2">
                    <div>
                      <Label className="text-xs">City</Label>
                      <Input
                        required
                        readOnly
                        value="Jangareddygudem"
                        className="mt-0.5 h-9 text-xs rounded-lg bg-muted text-muted-foreground cursor-not-allowed select-none font-semibold"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Pincode</Label>
                      <Input
                        required
                        readOnly
                        value="534447"
                        className="mt-0.5 h-9 text-xs rounded-lg bg-muted text-muted-foreground cursor-not-allowed select-none font-semibold"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Landmark (Optional)</Label>
                    <Input
                      value={newAddr.landmark}
                      onChange={(e) => setNewAddr({ ...newAddr, landmark: e.target.value })}
                      placeholder="e.g. Near Bus Stand"
                      className="mt-0.5 h-9 text-xs rounded-lg"
                    />
                  </div>
                  <div className="pt-1 flex gap-2">
                    <Button
                      type="button"
                      onClick={handleSaveNewAddress}
                      className="flex-1 bg-primary text-xs font-bold text-primary-foreground rounded-xl h-9"
                    >
                      Save & Use This Address
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAddressMode(savedAddresses.length > 0 ? "selected" : "manual")}
                      className="text-xs rounded-xl h-9"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* 4. MANUAL ADDRESS INPUT MODE (When no saved address exists) */}
              {addressMode === "manual" && (
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
                      <Input
                        required
                        readOnly
                        value="Jangareddygudem"
                        className="bg-muted text-muted-foreground cursor-not-allowed select-none font-semibold"
                      />
                    </div>
                    <div>
                      <Label>Pincode</Label>
                      <Input
                        required
                        readOnly
                        value="534447"
                        className="bg-muted text-muted-foreground cursor-not-allowed select-none font-semibold"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Landmark (optional)</Label>
                    <Input value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
                  </div>
                </div>
              )}
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

            {/* CHECKOUT ACTION AREA (AUTH LOCK & STORE HOURS LOCKS) */}
            {!user ? (
              <div className="rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 p-4 text-center space-y-3">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  <Lock className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-foreground">🔒 Sign in required</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Please sign in or create an account to continue placing your order.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => nav({ to: "/auth", search: { redirect: "/checkout" } as any })}
                  className="w-full bg-primary text-xs font-bold text-primary-foreground shadow-sm rounded-xl py-3"
                >
                  Sign In / Sign Up
                </Button>
              </div>
            ) : storeStatus.status === "closed" ? (
              <div className="rounded-2xl border-2 border-rose-500/40 bg-rose-500/10 p-4 text-center space-y-3">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300">
                  <Moon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-foreground">🔴 Orders Are Currently Closed</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We're not accepting new orders right now.
                  </p>
                  <p className="text-[11px] text-muted-foreground/80 font-medium">
                    Normal business hours: <strong>6:00 AM – 8:00 PM IST</strong>. Please check back soon.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => nav({ to: "/products" })}
                  className="w-full bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold shadow-xs rounded-xl py-2.5"
                >
                  Continue Shopping
                </Button>
              </div>
            ) : storeStatus.status === "lunch_break" ? (
              <div className="rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 p-4 text-center space-y-3">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  <UtensilsCrossed className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-foreground">🍽️ Lunch Break</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Our team is currently taking a short lunch break. Ordering will resume when the break ends.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => nav({ to: "/products" })}
                  className="w-full bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold shadow-xs rounded-xl py-2.5"
                >
                  Continue Shopping
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>🟢 Orders Are Open — You can place your order now.</span>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  size="lg"
                  className="w-full bg-hero shadow-elegant text-xs font-bold py-3.5 rounded-xl"
                >
                  {loading ? "Placing…" : `Place Order · ${inr(total)}`}
                </Button>
              </div>
            )}
          </aside>
        </form>
      </main>
      <Footer />
    </div>
  );
}
