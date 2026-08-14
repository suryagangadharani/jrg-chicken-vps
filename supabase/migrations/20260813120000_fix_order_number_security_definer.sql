-- Fix generate_order_number function to use SECURITY DEFINER so it can count daily orders across all users under RLS
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_str text := to_char(now(), 'YYYYMMDD');
  today_count int;
BEGIN
  SELECT COUNT(*) + 1 INTO today_count
  FROM public.orders
  WHERE order_number LIKE 'JRG-' || today_str || '-%' OR order_number LIKE 'RCC-' || today_str || '-%';
  RETURN 'JRG-' || today_str || '-' || lpad(today_count::text, 3, '0') || '-' || upper(substr(gen_random_uuid()::text, 1, 4));
END;
$$;
