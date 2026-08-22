# JRG Chicken — Complete Project Documentation

**Brand:** JRG Chicken — *Exclusive cuts*
**Business:** Fresh chicken shop, Jangareddygudem, Andhra Pradesh, India
**Domain:** https://jrgchicken.in (deployed on VPS)
**Purpose:** Online ordering storefront + admin operations dashboard

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start v1 (React 19, SSR + server functions) |
| Routing | TanStack Router (file-based, `src/routes`) |
| Data fetching | TanStack Query v5 |
| Build tool | Vite 7 |
| Styling | Tailwind CSS v4 (`src/styles.css` `@theme` tokens) |
| UI kit | shadcn/ui on Radix UI primitives, lucide-react icons |
| Forms/validation | React Hook Form + Zod |
| Toasts | Sonner |
| Backend | Node.js Express server + PostgreSQL on VPS |
| Push | Firebase Cloud Messaging (web push + service worker) |
| Hosting | VPS (Ubuntu Server + Nginx Reverse Proxy + PM2) |
| Language | TypeScript (strict), SQL for database |

---

## 2. Directory Structure

```
src/
├── assets/                      # logo, FSSAI certificate assets
├── components/
│   ├── AdTicker.tsx             # scrolling promo strip (WhatsApp order, bulk discount)
│   ├── CallFab.tsx              # floating green "Call to order" button (tel:7659018774)
│   ├── CartBar.tsx              # sticky bottom cart summary
│   ├── ConfirmDialog.tsx        # styled AlertDialog for destructive actions
│   ├── CustomerOrderListener.tsx# realtime order-status alerts + sound for customers
│   ├── NewOrderListener.tsx     # realtime new-order popup + sound for admins
│   ├── FcmRegister.tsx          # requests notification permission, saves FCM token
│   ├── LaunchOverlay.tsx        # full-screen pre-launch countdown screen
│   ├── ProductReviews.tsx       # customer reviews per product
│   ├── QtyControl.tsx           # kg quantity stepper (min 1 kg, 1 kg steps)
│   ├── Navbar.tsx / Footer.tsx
│   └── ui/                      # shadcn components
├── config/launch.ts             # launchMode toggle, launch date, bypass paths
├── hooks/
│   ├── useAuth.tsx              # auth context + admin detection
│   ├── useCountdown.ts          # countdown timer hook
│   └── use-mobile.tsx
├── integrations/supabase/       # auto-generated clients, types, auth middleware
├── lib/
│   ├── admin-users.functions.ts # server fns: list/update/delete users, role changes
│   ├── phone-auth.functions.ts  # phone + password signup/login helpers
│   ├── fcm.functions.ts / fcm-sender.server.ts / firebase-*.ts
│   ├── cart-context.tsx         # cart state persisted to localStorage
│   ├── promo.ts, format.ts (INR + dates), utils.ts
│   └── server-supabase-auth.ts  # env-prefix tolerant server Supabase client
├── routes/                      # see routing table below
├── router.tsx, start.ts, server.ts, styles.css
public/                          # manifest.webmanifest, robots.txt, favicons, logo
supabase/migrations/             # all SQL migrations
```

---

## 3. Routes

### Public / customer
| Route | File | Purpose |
|---|---|---|
| `/` | `routes/index.tsx` | Hero, banner carousel, timing badge, ad ticker, categories |
| `/products` | `routes/products.tsx` | Product grid by category, ₹ preset chips, add to cart |
| `/products/$slug` | `routes/products.$slug.tsx` | Detail, weight presets, custom kg, reviews |
| `/cart` | `routes/cart.tsx` | Cart lines, promo code, totals (no delivery fee) |
| `/checkout` | `routes/checkout.tsx` | Address, cutting instructions, COD place order |
| `/auth` | `routes/auth.tsx` | Phone+password signup/login, Google OAuth, forgot password |
| `/reset-password` | `routes/reset-password.tsx` | PKCE reset flow |
| `/terms` | `routes/terms.tsx` | Terms + FSSAI verified statement |
| `/sitemap.xml` | `routes/sitemap[.]xml.ts` | Dynamic sitemap |
| `/firebase-messaging-sw.js` | route file | FCM service worker |
| `/api/public/fcm-diag` | `routes/api/public/fcm-diag.ts` | Push diagnostics endpoint |

### Authenticated (`src/routes/_authenticated/`, guarded by `route.tsx`)
`/profile` (Zomato-style compact profile), `/addresses`, `/orders` (history with category badges).

### Admin (`src/routes/admin/`, guarded by `route.tsx` + `has_role`)
| Route | Purpose |
|---|---|
| `/admin` | Dashboard: stats + today's per-kg price by category (radio selector) |
| `/admin/products` | CRUD, image upload, stock toggle, `price_presets`, `badge`, `sort_order` |
| `/admin/orders` | Status pipeline, per-item category badges |
| `/admin/users` | View/edit/delete users, promote to admin |
| `/admin/promos` | Promo codes, home banners, category images |

---

## 4. Database Schema (Supabase, schema `public`)

| Table | Purpose |
|---|---|
| `profiles` | name, phone (unique), email; auto-created on signup |
| `user_roles` | `app_role` enum (`admin` / `customer`); checked via `has_role()` |
| `addresses` | saved delivery addresses per user |
| `categories` | Broiler, Layer, Big Layer (+ image, price per kg) |
| `products` | name, slug, category, price, image, stock, `price_presets[]`, `badge`, `sort_order`, description |
| `orders` | order code `YYYYMMDD-NN`, customer info, items JSON, totals, promo, cutting instructions, status |
| `promo_codes` | code, discount type/value, min order, active window |
| `reviews` | per-product customer ratings/comments |
| `banners` | home carousel images, sort order, active flag |
| `fcm_tokens` | push tokens per user/device |
| `site_visits` | basic visit analytics |
| `app_settings` | key/value app flags |

**Conventions:** RLS enabled on every table with explicit `GRANT`s; admin checks go through the security-definer `has_role(uuid, app_role)`; a signup trigger creates `profiles` + default `customer` role; Realtime is enabled on `orders`; storage buckets hold product, banner and category images (public read, admin write).

---

## 5. Key Features

**Customer**
- Category-first browsing → product page → kg selection (min 1 kg, 1 kg increments) or ₹ presets that convert to grams from today's per-kg rate
- Sticky bottom cart bar; cart persisted in localStorage
- COD checkout with custom cutting instructions and promo codes
- Order history with item categories, product reviews
- Phone + password auth, Google sign-in, email-based password reset
- Realtime order-status notifications with sound + web push (works when tab is closed)
- Installable PWA with JRG branding; floating call-to-order button

**Admin**
- Dashboard with today's per-kg price per category — updating it recalculates dependent product prices
- Realtime new-order popup with sound and push notification
- Product/order/user/promo/banner management, all mobile-responsive
- Product display ordering (`sort_order`) and badges (e.g. green "Highly ordered")

**Pre-launch mode** — `src/config/launch.ts` (`launchMode`, `launchDate`, `launchBypassPaths`) drives a full-screen countdown overlay via `LaunchGate` in `__root.tsx`; `/admin`, `/auth`, `/reset-password`, `/products` bypass it.

---

## 6. SEO

Per-route `head()` metadata, single H1 per page, `robots.txt`, dynamic `sitemap.xml`, JSON-LD (Organization with `alternateName: "JRGChicken"`, LocalBusiness, Product, sitelinks search box), favicon/apple-touch-icon from the JRG logo, Open Graph and Twitter cards.

---

## 7. Configuration & Deployment

- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` (plus unprefixed equivalents on Vercel — see `VERCEL_DEPLOY.md`).
- Supabase Auth: Site URL must be the live domain so password-reset links don't point to localhost; Google provider configured with the Supabase callback URL.
- Firebase: web app config + VAPID key for FCM; service worker served from `/firebase-messaging-sw.js`.
- Server runtime is a Worker/edge environment — avoid Node-only packages (sharp, puppeteer, child_process).
- Do not edit `src/routeTree.gen.ts` or files under `src/integrations/supabase/` (auto-generated).

| Command | Purpose |
|---|---|
| `bun dev` | Dev server |
| `bun run build` | Production build |
| `bun run preview` | Preview build |
| `bun run lint` / `bun run format` | Lint / format |

---

## 8. Brand & Design

- Deep red primary (`#D6001C`) with warm cream backgrounds and gold accents
- Display font for headings, clean sans for body; tokens in `src/styles.css` `@theme`
- Mobile-first layouts with tablet/desktop refinements
- Contact: 7659018774 · Hours 6 AM – 8 PM · Jangareddygudem
