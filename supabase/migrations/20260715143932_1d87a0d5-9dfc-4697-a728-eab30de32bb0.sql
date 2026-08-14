
-- Reduce categories: keep only Skinless & With Skin
DELETE FROM public.products WHERE category_id NOT IN (
  SELECT id FROM public.categories WHERE slug IN ('skinless-chicken','with-skin')
);
DELETE FROM public.categories WHERE slug NOT IN ('skinless-chicken','with-skin');

UPDATE public.categories SET name = 'Skinless', sort_order = 1 WHERE slug = 'skinless-chicken';
UPDATE public.categories SET name = 'With Skin', sort_order = 2 WHERE slug = 'with-skin';

-- Allow admins to update / delete customer profiles and roles
DROP POLICY IF EXISTS "admin manage profiles" ON public.profiles;
CREATE POLICY "admin manage profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin manage roles" ON public.user_roles;
CREATE POLICY "admin manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
