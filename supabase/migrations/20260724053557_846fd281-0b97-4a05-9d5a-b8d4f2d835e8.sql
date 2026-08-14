REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;

DROP POLICY IF EXISTS "Anyone can view active banners" ON public.banners;
CREATE POLICY "Anyone can view active banners"
ON public.banners
FOR SELECT
TO anon, authenticated
USING (active = true);