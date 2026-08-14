
-- Storage policies for banners bucket (admins upload/manage, everyone reads)
DROP POLICY IF EXISTS "Banners public read" ON storage.objects;
DROP POLICY IF EXISTS "Banners admin insert" ON storage.objects;
DROP POLICY IF EXISTS "Banners admin update" ON storage.objects;
DROP POLICY IF EXISTS "Banners admin delete" ON storage.objects;

CREATE POLICY "Banners public read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'banners');

CREATE POLICY "Banners admin insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'banners' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Banners admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'banners' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Banners admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'banners' AND public.has_role(auth.uid(), 'admin'));
