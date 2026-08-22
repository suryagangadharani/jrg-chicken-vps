import { Link } from "@tanstack/react-router";
import { Phone, Clock, ShieldCheck, MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-secondary/40" itemScope itemType="https://schema.org/LocalBusiness">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-3 md:px-6">
        <div>
          <h3 className="font-display text-xl font-bold text-primary" itemProp="name">JRG Chicken</h3>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Exclusive Cuts</p>
          <p className="mt-2 text-sm text-muted-foreground">Fresh farm chicken, hand-cut daily. Broiler, Layer & Big Layer.</p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Shop</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/products" className="hover:text-primary">All Products</Link></li>
            <li><Link to="/cart" className="hover:text-primary">Cart</Link></li>
            <li><Link to="/orders" className="hover:text-primary">My Orders</Link></li>
            <li><Link to="/terms" className="hover:text-primary">Terms & Conditions</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Contact</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2" itemProp="telephone"><Phone className="mt-0.5 h-4 w-4 shrink-0" />+91 - 7032424774</li>
            <li className="flex gap-2" itemProp="address"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />Jangareddigudem, Andhra Pradesh</li>
            <li className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0" />6:00 AM – 8:00 PM daily</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/60 py-4">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:flex-row md:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 font-semibold text-success">
            <ShieldCheck className="h-3.5 w-3.5" /> Verified · Hygienically processed
          </span>
          <span>© {new Date().getFullYear()} JRG Chicken. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
