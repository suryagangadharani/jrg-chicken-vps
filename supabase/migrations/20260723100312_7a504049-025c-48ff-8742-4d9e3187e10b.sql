
CREATE TABLE public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  link_url text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.banners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active banners" ON public.banners
  FOR SELECT USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage banners" ON public.banners
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER banners_touch BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Admins upload banners bucket" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'banners' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update banners bucket" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'banners' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete banners bucket" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'banners' AND public.has_role(auth.uid(), 'admin'));
