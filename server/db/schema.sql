-- JRG Chicken / Chicken Hub Online PostgreSQL Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum Types
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('admin', 'customer', 'delivery_boy');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('cod', 'online');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. User Roles Table
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'customer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, role)
);

-- 3. Addresses Table
CREATE TABLE IF NOT EXISTS addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    label TEXT,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    line1 TEXT NOT NULL,
    line2 TEXT,
    city TEXT NOT NULL DEFAULT 'Jangareddygudem',
    pincode TEXT NOT NULL,
    landmark TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    image_url TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    price_per_kg NUMERIC(10,2) NOT NULL CHECK (price_per_kg >= 0),
    price_presets NUMERIC[] DEFAULT '{250, 500, 1000}',
    badge TEXT,
    in_stock BOOLEAN NOT NULL DEFAULT TRUE,
    images TEXT[] NOT NULL DEFAULT '{}',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    delivery_boy_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT NOT NULL DEFAULT 'Jangareddygudem',
    pincode TEXT NOT NULL,
    landmark TEXT,
    items JSONB NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL,
    delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount NUMERIC(10,2) NOT NULL DEFAULT 0,
    total NUMERIC(10,2) NOT NULL,
    payment_method payment_method NOT NULL DEFAULT 'cod',
    status order_status NOT NULL DEFAULT 'placed',
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Order Assignments Table (Multi-Delivery-Boy Scalability)
CREATE TABLE IF NOT EXISTS order_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    delivery_boy_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'assigned',
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 8. Notification Tokens (FCM Push Tokens) Table
CREATE TABLE IF NOT EXISTS notification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    role app_role NOT NULL DEFAULT 'customer',
    device_info TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Notifications Table (Notification History & Structured Events)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'customer',
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    action_url TEXT NOT NULL DEFAULT '/',
    sound_type TEXT NOT NULL DEFAULT 'normal_alert',
    priority TEXT NOT NULL DEFAULT 'normal',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- 9. Banners Table
CREATE TABLE IF NOT EXISTS banners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT,
    image_url TEXT NOT NULL,
    link_url TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Promo Codes Table
CREATE TABLE IF NOT EXISTS promo_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
    discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
    min_subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    min_qty_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    uses INT NOT NULL DEFAULT 0,
    max_uses INT DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Site Visits (Analytics) Table
CREATE TABLE IF NOT EXISTS site_visits (
    id BIGSERIAL PRIMARY KEY,
    path TEXT,
    visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. App Settings Table
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Fast Query Performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_boy ON orders(delivery_boy_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_assignments_delivery ON order_assignments(delivery_boy_id);
CREATE INDEX IF NOT EXISTS idx_notification_tokens_user ON notification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);

-- Seed Categories Data
INSERT INTO categories (id, name, slug, sort_order, image_url) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Fresh Chicken', 'fresh-chicken', 1, 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=500&auto=format&fit=crop&q=60'),
  ('22222222-2222-2222-2222-222222222222', 'Special Cuts', 'special-cuts', 2, 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=500&auto=format&fit=crop&q=60'),
  ('33333333-3333-3333-3333-333333333333', 'Country Chicken', 'country-chicken', 3, 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=500&auto=format&fit=crop&q=60'),
  ('44444444-4444-4444-4444-444444444444', 'Skinless Chicken', 'skinless-chicken', 4, 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=500&auto=format&fit=crop&q=60'),
  ('55555555-5555-5555-5555-555555555555', 'With Skin', 'with-skin', 5, 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=500&auto=format&fit=crop&q=60'),
  ('66666666-6666-6666-6666-666666666666', 'Boneless', 'boneless', 6, 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=500&auto=format&fit=crop&q=60')
ON CONFLICT (slug) DO NOTHING;

-- Seed Products Data
INSERT INTO products (id, category_id, name, slug, price_per_kg, price_presets, badge, in_stock, images, sort_order, description) VALUES
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Broiler Skinless Chicken', 'broiler-skinless', 240.00, '{250, 500, 1000}', 'Bestseller', true, ARRAY['https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=600&auto=format&fit=crop&q=80'], 1, 'Tender, farm-fresh broiler chicken cut to your preference.'),
  ('a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Broiler With Skin', 'broiler-with-skin', 220.00, '{250, 500, 1000}', 'Popular', true, ARRAY['https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=600&auto=format&fit=crop&q=80'], 2, 'Juicy chicken with skin for rich flavor and traditional recipes.'),
  ('a3333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Boneless Chicken Breast', 'boneless-breast', 320.00, '{250, 500, 1000}', 'High Protein', true, ARRAY['https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=600&auto=format&fit=crop&q=80'], 3, 'Lean, tender boneless breast pieces ideal for fitness lovers and grills.'),
  ('a4444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Country Chicken (Natu Kodi)', 'country-chicken-natu-kodi', 450.00, '{500, 1000}', 'Organic', true, ARRAY['https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600&auto=format&fit=crop&q=80'], 4, '100% free-range country chicken with rich authentic taste.')
ON CONFLICT (slug) DO NOTHING;

-- Seed Banners
INSERT INTO banners (id, title, image_url, link_url, active, sort_order) VALUES
  ('b1111111-1111-1111-1111-111111111111', 'Fresh Farm Chicken Delivered to Your Doorstep', 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=1200&auto=format&fit=crop&q=80', '/products', true, 1)
ON CONFLICT (id) DO NOTHING;

-- Seed Promo Codes
INSERT INTO promo_codes (id, code, discount_type, discount_value, min_subtotal, min_qty_kg, active, description, max_uses) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'WELCOME10', 'percent', 10, 300, 0.5, true, '10% OFF on orders above ₹300', 100)
ON CONFLICT (code) DO NOTHING;

