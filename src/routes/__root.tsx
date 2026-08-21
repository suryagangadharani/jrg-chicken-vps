import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/lib/cart-context";
import { NewOrderListener } from "@/components/NewOrderListener";
import { CustomerOrderListener } from "@/components/CustomerOrderListener";
import { FcmRegister } from "@/components/FcmRegister";
import { NotificationToast } from "@/components/NotificationToast";
import { CartBar } from "@/components/CartBar";
import { CallFab } from "@/components/CallFab";
import { BottomNav } from "@/components/BottomNav";
import { LaunchOverlay } from "@/components/LaunchOverlay";
import { launchBypassPaths, launchMode } from "@/config/launch";
import { apiClient } from "@/lib/api-client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error("Application error:", error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error?.message || "An unexpected error occurred. Try refreshing or head back home."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "JRG Chicken – Fresh Chicken Delivery in Jangareddigudem" },
      {
        name: "description",
        content:
          "Order fresh, hand-cut chicken online from JRG Chicken in Jangareddigudem. Broiler, Layer & Big Layer — exclusive cuts, same-day delivery. Cash on Delivery.",
      },
      {
        name: "keywords",
        content:
          "JRG Chicken, JRGChicken, chicken shop Jangareddigudem, fresh chicken delivery, online chicken Andhra Pradesh, broiler chicken, layer chicken, exclusive cuts",
      },
      { name: "author", content: "JRG Chicken" },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
      { name: "googlebot", content: "index, follow" },
      { name: "theme-color", content: "#c53030" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "JRG Chicken" },
      { name: "format-detection", content: "telephone=yes" },
      { name: "geo.region", content: "IN-AP" },
      { name: "geo.placename", content: "Jangareddigudem" },
      { property: "og:site_name", content: "JRG Chicken" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "en_IN" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/favicon.png", type: "image/png", sizes: "96x96" },
      { rel: "shortcut icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", href: "/jrg-logo.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "dns-prefetch", href: "https://fonts.googleapis.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function LaunchGate() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!launchMode) return null;
  if (launchBypassPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;
  return <LaunchOverlay />;
}

function VisitTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    apiClient.visits.record(pathname);
  }, [pathname]);

  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <VisitTracker />
          <Outlet />
          <NewOrderListener />
          <CustomerOrderListener />
          <FcmRegister />
          <NotificationToast />
          <CartBar />
          <CallFab />
          <BottomNav />
          <LaunchGate />
          <Toaster position="top-right" richColors closeButton />
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
