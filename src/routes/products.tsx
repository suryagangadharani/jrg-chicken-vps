import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { apiClient } from "@/lib/api-client";
import { inr } from "@/lib/format";
import { QtyControl } from "@/components/QtyControl";
import { useCart } from "@/lib/cart-context";

export const Route = createFileRoute("/products")({
  ssr: false,
  component: ProductsPage,
  validateSearch: (s: Record<string, unknown>) => ({
    category: typeof s.category === "string" ? s.category : undefined,
  }),
  head: () => {
    const title = "Shop Fresh Chicken Online – Broiler, Layer & Big Layer | JRG Chicken";
    const desc =
      "Browse JRG Chicken's fresh Broiler, Layer & Big Layer cuts. Hand-cut daily and delivered same-day in Jangareddigudem. Cash on Delivery.";
    const url = "https://jrgchicken.in/products";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { property: "og:image", content: "https://jrgchicken.in/jrg-logo.png" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: "https://jrgchicken.in/jrg-logo.png" },
      ],
      links: [
        { rel: "canonical", href: url },
        { rel: "alternate", hrefLang: "en-IN", href: url },
      ],
    };
  },
});

function ProductsPage() {
  const { category } = Route.useSearch();
  const [selected, setSelected] = useState<string | undefined>(category);
  const { add } = useCart();

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiClient.categories.getAll(),
  });

  const { data: allProducts = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiClient.products.getAll(),
  });

  const products = selected
    ? allProducts.filter(
        (p: any) =>
          p.category_slug === selected ||
          p.categories?.slug === selected ||
          categories.find((c: any) => c.slug === selected)?.id === p.category_id
      )
    : allProducts;

  return (
    <div className="min-h-screen bg-background pb-24">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <h1 className="font-display text-3xl font-bold md:text-4xl">Our Chicken</h1>
        <p className="mt-1 text-muted-foreground">Farm-fresh, cut fresh, delivered fresh.</p>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => setSelected(undefined)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              !selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50"
            }`}
          >
            All
          </button>
          {categories.map((c: any) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.slug)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                selected === c.slug
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="mt-12 text-center text-muted-foreground">Loading…</div>
        ) : products.length === 0 ? (
          <div className="mt-16 rounded-2xl border border-dashed p-12 text-center">
            <div className="text-6xl">🐔</div>
            <p className="mt-4 text-lg font-semibold">No products yet</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p: any) => (
              <div
                key={p.id}
                className="group flex flex-col overflow-hidden rounded-2xl bg-card shadow-card transition hover:-translate-y-1 hover:shadow-elegant"
              >
                <Link to="/products/$slug" params={{ slug: p.slug }} className="relative block aspect-square overflow-hidden bg-secondary">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                  ) : (
                    <div className="grid h-full place-items-center text-6xl">🍗</div>
                  )}
                  {p.badge && (
                    <span className="absolute left-2 top-2 rounded-full bg-success px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success-foreground shadow-md">
                      🔥 {p.badge}
                    </span>
                  )}
                </Link>
                <div className="flex flex-1 flex-col p-3">
                  <Link to="/products/$slug" params={{ slug: p.slug }} className="text-sm font-semibold line-clamp-1 hover:text-primary">
                    {p.name}
                  </Link>
                  {p.categories && <div className="text-xs text-muted-foreground">{p.categories.name}</div>}
                  <div className="mt-1 text-base font-bold text-primary">
                    {inr(p.price_per_kg)}
                    <span className="text-xs font-normal text-muted-foreground">/kg</span>
                  </div>
                  {(() => {
                    const ppk = Number(p.price_per_kg) || 0;
                    const presets: number[] = Array.isArray(p.price_presets)
                      ? p.price_presets.map(Number).filter((n: number) => n > 0)
                      : [];
                    if (!presets.length || ppk <= 0) return null;
                    return (
                      <div className="mt-2 grid grid-cols-2 gap-1">
                        {presets.map((amt) => {
                          const grams = Math.round((amt / ppk) * 1000);
                          const qtyKg = +(grams / 1000).toFixed(2);
                          return (
                            <button
                              key={amt}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                add(
                                  {
                                    product_id: p.id,
                                    name: p.name,
                                    slug: p.slug,
                                    price_per_kg: ppk,
                                    image: p.images?.[0] ?? null,
                                  },
                                  qtyKg
                                );
                                toast.success(`${grams}g ${p.name} added (₹${amt})`);
                              }}
                              className="rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[11px] font-semibold text-primary hover:border-primary hover:bg-primary/10"
                            >
                              ₹{amt}
                              <span className="ml-1 font-normal text-muted-foreground">
                                {grams >= 1000 ? `${(grams / 1000).toFixed(1)}kg` : `${grams}g`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <div className="mt-2">
                    <QtyControl product={p} fullWidth />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
