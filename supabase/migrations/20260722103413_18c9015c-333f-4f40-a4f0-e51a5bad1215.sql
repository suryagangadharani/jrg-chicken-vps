CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_str text := to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD');
  today_count integer;
BEGIN
  SELECT COUNT(*) + 1 INTO today_count
  FROM public.orders
  WHERE order_number LIKE today_str || '-%';
  RETURN today_str || '-' || lpad(today_count::text, 2, '0');
END;
$$;

ALTER TABLE public.orders ALTER COLUMN order_number SET DEFAULT public.generate_order_number();