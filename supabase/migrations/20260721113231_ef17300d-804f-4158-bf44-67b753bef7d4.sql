
-- 1. Order number as RCC-YYYYMMDD-### (daily sequential)
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  today_str text := to_char(now(), 'YYYYMMDD');
  today_count int;
BEGIN
  SELECT COUNT(*) + 1 INTO today_count
  FROM public.orders
  WHERE order_number LIKE 'RCC-' || today_str || '-%';
  RETURN 'RCC-' || today_str || '-' || lpad(today_count::text, 3, '0');
END;
$$;

ALTER TABLE public.orders ALTER COLUMN order_number SET DEFAULT public.generate_order_number();

-- 2. Add cutting instructions + promo tracking to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cutting_instructions text,
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS discount numeric(10,2) NOT NULL DEFAULT 0;

-- 3. Promo codes table
CREATE TYPE public.discount_type AS ENUM ('percent', 'flat');

CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type public.discount_type NOT NULL DEFAULT 'percent',
  discount_value numeric(10,2) NOT NULL,
  min_subtotal numeric(10,2) NOT NULL DEFAULT 0,
  min_qty_kg numeric(10,2) NOT NULL DEFAULT 0,
  max_uses integer,
  uses integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.promo_codes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read active promo codes" ON public.promo_codes
  FOR SELECT USING (active = true);
CREATE POLICY "admin manage promo codes" ON public.promo_codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_promo_codes BEFORE UPDATE ON public.promo_codes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Reviews table (verified purchases only)
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id)
);

GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "verified buyers write reviews" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.user_id = auth.uid()
        AND o.status = 'delivered'
        AND o.items @> jsonb_build_array(jsonb_build_object('product_id', product_id::text))
    )
  );
CREATE POLICY "users update own reviews" ON public.reviews
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own reviews or admin" ON public.reviews
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_reviews BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
