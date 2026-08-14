ALTER TABLE public.orders ALTER COLUMN order_number DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL OR btrim(NEW.order_number) = '' THEN
    NEW.order_number := public.generate_order_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_order_number_before_insert ON public.orders;
CREATE TRIGGER set_order_number_before_insert
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_order_number();

REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO service_role;

REVOKE EXECUTE ON FUNCTION public.set_order_number() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_order_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_order_number() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_order_number() TO service_role;