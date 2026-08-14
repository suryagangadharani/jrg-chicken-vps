
-- Roles
create type public.app_role as enum ('admin', 'customer');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null default 'customer',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "read own roles" on public.user_roles for select
  to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "admins manage roles" on public.user_roles for all
  to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create policy "read own profile" on public.profiles for select
  to authenticated using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));
create policy "update own profile" on public.profiles for update
  to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "insert own profile" on public.profiles for insert
  to authenticated with check (auth.uid() = id);

-- Addresses
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  full_name text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  city text not null default 'Jangareddygudem',
  pincode text not null,
  landmark text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.addresses to authenticated;
grant all on public.addresses to service_role;
alter table public.addresses enable row level security;

create policy "own addresses" on public.addresses for all
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admin read addresses" on public.addresses for select
  to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  slug text unique not null,
  image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.categories to anon, authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;

create policy "public read categories" on public.categories for select using (true);
create policy "admin manage categories" on public.categories for all
  to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text unique not null,
  description text,
  price_per_kg numeric(10,2) not null check (price_per_kg >= 0),
  in_stock boolean not null default true,
  images text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.products to anon, authenticated;
grant all on public.products to service_role;
grant insert, update, delete on public.products to authenticated;
alter table public.products enable row level security;

create policy "public read products" on public.products for select using (true);
create policy "admin manage products" on public.products for all
  to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Orders
create type public.order_status as enum ('placed','confirmed','preparing','out_for_delivery','delivered','cancelled');
create type public.payment_method as enum ('cod','online');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null default ('RCC-' || to_char(now(),'YYMMDD') || '-' || upper(substr(gen_random_uuid()::text,1,6))),
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  pincode text not null,
  landmark text,
  items jsonb not null,
  subtotal numeric(10,2) not null,
  delivery_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  payment_method payment_method not null default 'cod',
  status order_status not null default 'placed',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert on public.orders to authenticated;
grant update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;

create policy "own orders read" on public.orders for select
  to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "create own orders" on public.orders for insert
  to authenticated with check (auth.uid() = user_id);
create policy "admin update orders" on public.orders for update
  to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Site visits (analytics)
create table public.site_visits (
  id bigserial primary key,
  path text,
  visited_at timestamptz not null default now()
);
grant insert on public.site_visits to anon, authenticated;
grant select on public.site_visits to authenticated;
grant all on public.site_visits to service_role;
alter table public.site_visits enable row level security;

create policy "anyone insert visit" on public.site_visits for insert to anon, authenticated with check (true);
create policy "admin read visits" on public.site_visits for select
  to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Auto profile + role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, full_name, phone)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone');

  insert into public.user_roles(user_id, role) values (new.id, 'customer')
  on conflict do nothing;

  if new.email = 'suryagangadharani4@gmail.com' then
    insert into public.user_roles(user_id, role) values (new.id, 'admin')
    on conflict do nothing;
  end if;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- updated_at helper
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

create trigger touch_products before update on public.products for each row execute function public.touch_updated_at();
create trigger touch_orders before update on public.orders for each row execute function public.touch_updated_at();
create trigger touch_profiles before update on public.profiles for each row execute function public.touch_updated_at();

-- Realtime
alter table public.orders replica identity full;
alter publication supabase_realtime add table public.orders;

-- Seed categories
insert into public.categories(name, slug, sort_order) values
  ('Skinless Chicken', 'skinless-chicken', 1),
  ('With Skin', 'with-skin', 2),
  ('Curry Cut', 'curry-cut', 3),
  ('Boneless', 'boneless', 4),
  ('Country Chicken (Natu Kodi)', 'country-chicken', 5),
  ('Chicken Wings', 'chicken-wings', 6),
  ('Chicken Legs', 'chicken-legs', 7),
  ('Chicken Liver', 'chicken-liver', 8),
  ('Whole Chicken', 'whole-chicken', 9);
