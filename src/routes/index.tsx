import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, Truck, Shield, Award } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AdTicker } from "@/components/AdTicker";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";

import skinlessImg from "@/assets/chicken-skinless.jpg";
import withSkinImg from "@/assets/chicken-withskin.jpg";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Home,
  head: () => ({
    meta: [
      { title: "JRG Chicken – Fresh Chicken Delivery in Jangareddigudem" },
      {
        name: "description",
        content:
          "JRG Chicken delivers farm-fresh Broiler, Layer & Big Layer chicken with exclusive hand cuts across Jangareddigudem, Andhra Pradesh. Order online, Cash on Delivery.",
      },
      { property: "og:title", content: "JRG Chicken – Fresh Chicken Delivery in Jangareddigudem" },
      {
        property: "og:description",
        content: "Farm-fresh chicken, hand-cut daily. Broiler, Layer & Big Layer. Same-day delivery in Jangareddigudem.",
      },
      { property: "og:url", content: "https://jrgchicken.in/" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://jrgchicken.in/jrg-logo.png" },
      { name: "twitter:title", content: "JRG Chicken – Fresh Chicken Delivery" },
      { name: "twitter:description", content: "Order farm-fresh, hand-cut chicken online in Jangareddigudem." },
      { name: "twitter:image", content: "https://jrgchicken.in/jrg-logo.png" },
    ],
    links: [
      { rel: "canonical", href: "https://jrgchicken.in/" },
      { rel: "alternate", hrefLang: "en-IN", href: "https://jrgchicken.in/" },
      { rel: "alternate", hrefLang: "x-default", href: "https://jrgchicken.in/" },
    ],
  }),
});

function Home() {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role === "delivery_boy") {
      window.location.href = "/delivery";
    }
  }, [user]);
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiClient.categories.getAll(),
  });
  const { data: banners = [] } = useQuery({
    queryKey: ["banners"],
    queryFn: () => apiClient.banners.getAll(),
  });
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % banners.length), 2500);
    return () => clearInterval(t);
  }, [banners.length]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-warm" itemScope itemType="https://schema.org/LocalBusiness">
        <meta itemProp="name" content="JRG Chicken" />
        <meta itemProp="telephone" content="+91-7659018774" />
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 md:grid-cols-2 md:items-center md:px-6 md:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
              {user ? "✅ You are signed in" : "🐔 Farm Fresh · Hand Cut Daily"}
            </span>
            <div className="mt-4 flex items-start gap-3">
              <h1 className="font-display text-4xl font-bold leading-tight text-foreground md:text-6xl" itemProp="name">
                Exclusive Cuts,<br />
                <span className="text-primary">Delivered Fresh</span>
              </h1>
              <img
                src="/fssai-stamp.png"
                alt="FSSAI Approved JRG Chicken"
                width={112}
                height={112}
                className="-mt-2 -mr-2 h-20 w-20 shrink-0 rounded-full border-4 border-white object-cover shadow-xl md:h-28 md:w-28"
              />
            </div>
            <p className="mt-4 max-w-lg text-base text-muted-foreground md:text-lg">
              JRG Chicken brings farm-fresh, hygienically cut Broiler, Layer and Big Layer to your door. Order online, pay
              cash on delivery.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/products">
                <Button size="lg" className="bg-hero shadow-elegant">
                  Shop Now <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              {!user && (
                <Link to="/auth">
                  <Button size="lg" variant="outline">
                    Create Account
                  </Button>
                </Link>
              )}
            </div>
            <div className="mt-8 grid grid-cols-3 gap-4 text-sm">
              <div className="flex flex-col items-center text-center">
                <Truck className="mb-1 h-6 w-6 text-primary" aria-hidden="true" />
                <span className="font-semibold">Fast Delivery</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <Award className="mb-1 h-6 w-6 text-primary" aria-hidden="true" />
                <span className="font-semibold">Premium Quality</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <Shield className="mb-1 h-6 w-6 text-primary" aria-hidden="true" />
                <span className="font-semibold">Hygienic</span>
              </div>
            </div>
          </div>
          <div className="relative group">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-tr from-primary/30 via-primary/10 to-transparent blur-2xl opacity-70 animate-pulse" />
            <div className="relative aspect-square overflow-hidden rounded-3xl shadow-elegant ring-1 ring-black/5 animate-float">
              {banners.length > 0 ? (
                banners.map((b: any, i: number) => {
                  const img = (
                    <img
                      src={b.image_url}
                      alt="JRG Chicken promotional banner"
                      loading="lazy"
                      className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-out ${
                        i === slide ? "opacity-100 scale-100" : "opacity-0 scale-105"
                      }`}
                    />
                  );
                  return b.link_url ? (
                    <a key={i} href={b.link_url} target="_blank" rel="noopener noreferrer">
                      {img}
                    </a>
                  ) : (
                    <span key={i}>{img}</span>
                  );
                })
              ) : (
                <div className="grid h-full w-full place-items-center bg-secondary text-8xl">🐔</div>
              )}
              {banners.length > 1 && (
                <div className="absolute bottom-4 right-4 flex gap-1.5">
                  {banners.map((_: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => setSlide(i)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === slide ? "w-5 bg-white" : "w-1.5 bg-white/50"
                      }`}
                      aria-label={`Go to banner ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="mt-2 flex justify-center">
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 py-1.5 text-sm font-semibold text-foreground shadow-md">
                <span>6 AM – 8 PM</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AdTicker />

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold md:text-3xl">Shop by Category</h2>
            <p className="text-sm text-muted-foreground">Pick your cut, we&apos;ll deliver fresh.</p>
          </div>
          <Link to="/products" className="text-sm font-medium text-primary hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {categories.length === 0 && (
            <>
              <Link
                to="/products"
                search={{ category: "skinless" }}
                className="group relative aspect-square overflow-hidden rounded-2xl shadow-card"
              >
                <img src={skinlessImg} alt="Skinless chicken cuts" className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 to-transparent p-3">
                  <span className="font-display text-lg font-semibold text-white">Skinless</span>
                </div>
              </Link>
              <Link
                to="/products"
                search={{ category: "with-skin" }}
                className="group relative aspect-square overflow-hidden rounded-2xl shadow-card"
              >
                <img src={withSkinImg} alt="Chicken with skin cuts" className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 to-transparent p-3">
                  <span className="font-display text-lg font-semibold text-white">With Skin</span>
                </div>
              </Link>
            </>
          )}
          {categories.map((c: any) => (
            <Link
              key={c.id}
              to="/products"
              search={{ category: c.slug }}
              className="group relative aspect-square overflow-hidden rounded-2xl bg-secondary shadow-card"
            >
              {c.image_url ? (
                <img
                  src={c.image_url}
                  alt={`${c.name} chicken cuts`}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="grid h-full place-items-center text-6xl">🐔</div>
              )}
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 to-transparent p-3">
                <span className="font-display text-lg font-semibold text-white">{c.name}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
