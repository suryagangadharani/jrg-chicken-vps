import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — JRG Chicken" },
      { name: "description", content: "Terms & conditions for orders, delivery, payments and refunds at JRG Chicken." },
      { property: "og:title", content: "Terms & Conditions — JRG Chicken" },
      { property: "og:description", content: "Read our terms for orders, delivery and payments." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-10 md:px-6">
        <h1 className="font-display text-4xl font-bold">Terms & Conditions</h1>
        <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</p>

        <section className="mt-6 space-y-4 text-sm md:text-base">
          <div>
            <h2 className="font-display text-xl font-semibold">1. About Us</h2>
            <p className="text-muted-foreground">JRG Chicken — Exclusive Cuts is a chicken retail business. This website enables customers to place online orders for delivery.</p>
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">2. Orders & Delivery</h2>
            <p className="text-muted-foreground">Orders are accepted from 7 AM to 8 PM daily. Same-day free delivery. Estimated delivery time is 1–3 hours from confirmation.</p>
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">3. Payments</h2>
            <p className="text-muted-foreground">We currently accept <strong>Cash on Delivery (COD)</strong>. Online payment is coming soon. Please have exact change ready.</p>
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">4. Product Freshness</h2>
            <p className="text-muted-foreground">All chicken is cut fresh on the day of delivery. If you are not satisfied with the freshness or quality, please contact us within 2 hours of receiving your order.</p>
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">5. Cancellations & Refunds</h2>
            <p className="text-muted-foreground">Orders may be cancelled free of charge before status changes to "Preparing". After that, cancellation may not be possible. Refunds for quality issues are given at the store's discretion.</p>
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">6. Privacy</h2>
            <p className="text-muted-foreground">We collect only the information needed to fulfill your order — name, phone, delivery address, and email. Your data is never sold or shared with third parties.</p>
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">7. Contact</h2>
            <p className="text-muted-foreground">For any queries, reach us on the shop phone number during business hours.</p>
          </div>
        </section>

        <section className="mt-10 flex items-center gap-3 rounded-2xl border border-success/30 bg-success/5 p-5 shadow-card">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-success/20 text-success">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Verified & Hygienic</h2>
            <p className="text-xs text-muted-foreground">All chicken is processed hygienically and verified for freshness before delivery.</p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
