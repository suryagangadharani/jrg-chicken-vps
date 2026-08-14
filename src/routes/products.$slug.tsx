import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { apiClient } from "@/lib/api-client";
import { inr } from "@/lib/format";
import { ChevronLeft } from "lucide-react";
import { ProductReviews } from "@/components/ProductReviews";
import { QtyControl } from "@/components/QtyControl";
import { useCart } from "@/lib/cart-context";
import { toast } from "sonner";

export const Route = createFileRoute("/products/$slug")({
  ssr: false,
  component: ProductDetail,
  loader: async ({ params }) => {
    try {
      const data = await apiClient.products.getBySlug(params.slug);
      return { product: data };
    } catch {
      return { product: null };
    }
  },
  head: ({ params, loaderData }) => {
    const p: any = (loaderData as any)?.product;
    const url = `https://jrgchicken.in/products/${params.slug}`;
    if (!p) {
      return {
        meta: [
          { title: "Product — JRG Chicken" },
          { name: "description", content: "Fresh hand-cut chicken from JRG Chicken, delivered in Jangareddigudem." },
        ],
        links: [{ rel: "canonical", href: url }],
      };
    }
    const title = `${p.name} – Fresh ${p.categories?.name ?? "Chicken"} | JRG Chicken`;
    const desc = (
      p.description ||
      `Order ${p.name} online from JRG Chicken. Fresh hand-cut ${p.categories?.name ?? "chicken"} delivered same-day in Jangareddigudem. Cash on Delivery.`
    ).slice(0, 160);
    const image = p.images?.[0] || "https://jrgchicken.in/jrg-logo.png";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { property: "og:type", content: "product" },
        { property: "og:image", content: image },
        { property: "product:price:amount", content: String(p.price_per_kg) },
        { property: "product:price:currency", content: "INR" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});

function ProductDetail() {
  const { slug } = Route.useParams();
  const { data: p, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => apiClient.products.getBySlug(slug),
  });
  const [active, setActive] = useState(0);
  const { add } = useCart();

  if (isLoading)
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="p-12 text-center text-muted-foreground">Loading…</div>
      </div>
    );
  if (!p)
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="p-12 text-center text-muted-foreground">Product not found.</div>
      </div>
    );

  const images: string[] = p.images?.length ? p.images : [];
  const presets: number[] = Array.isArray((p as any).price_presets)
    ? (p as any).price_presets.filter((n: any) => Number(n) > 0)
    : [];
  const pricePerKg = Number(p.price_per_kg) || 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <Link to="/products" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ChevronLeft className="h-4 w-4" />
          Back to shop
        </Link>
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <div className="aspect-square overflow-hidden rounded-2xl bg-secondary shadow-card">
              {images[active] ? (
                <img src={images[active]} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-9xl">🍗</div>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {images.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                      i === active ? "border-primary" : "border-transparent opacity-70"
                    }`}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            {(p as any).categories && (
              <div className="text-sm font-medium uppercase tracking-wider text-primary">{(p as any).categories.name}</div>
            )}
            <h1 className="mt-1 font-display text-3xl font-bold md:text-4xl">{p.name}</h1>
            <div className="mt-3 text-3xl font-bold text-primary">
              {inr(p.price_per_kg)}
              <span className="text-base font-normal text-muted-foreground">/kg</span>
            </div>
            {p.description && <p className="mt-4 text-muted-foreground">{p.description}</p>}

            {presets.length > 0 && pricePerKg > 0 && (
              <div className="mt-6">
                <div className="mb-2 text-sm font-semibold">Quick pick</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {presets.map((amt) => {
                    const grams = Math.round((amt / pricePerKg) * 1000);
                    const qtyKg = +(grams / 1000).toFixed(2);
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          add(
                            {
                              product_id: p.id,
                              name: p.name,
                              slug: p.slug,
                              price_per_kg: pricePerKg,
                              image: p.images?.[0] ?? null,
                            },
                            qtyKg
                          );
                          toast.success(`${grams}g ${p.name} added (₹${amt})`);
                        }}
                        className="rounded-full border-2 border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary transition hover:border-primary hover:bg-primary/10"
                      >
                        ₹{amt}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          · {grams >= 1000 ? `${(grams / 1000).toFixed(2)} kg` : `${grams} g`}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Grams update automatically with today's price.</p>
              </div>
            )}

            <div className="mt-6">
              <div className="mb-2 text-sm font-semibold">Quantity</div>
              <QtyControl product={p as any} size="lg" fullWidth />
              <p className="mt-2 text-xs text-muted-foreground">
                Tap + / − to increase or decrease by 0.5 kg. Starts from 1 kg.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
              <div className="rounded-xl bg-secondary/50 p-3">
                <div className="font-semibold text-foreground">Fresh Cut</div>
                Same day
              </div>
              <div className="rounded-xl bg-secondary/50 p-3">
                <div className="font-semibold text-foreground">COD</div>
                Available
              </div>
              <div className="rounded-xl bg-secondary/50 p-3">
                <div className="font-semibold text-foreground">Delivery</div>
                Same day
              </div>
            </div>
          </div>
        </div>

        <ProductReviews productId={p.id} />
      </main>
      <Footer />
    </div>
  );
}
