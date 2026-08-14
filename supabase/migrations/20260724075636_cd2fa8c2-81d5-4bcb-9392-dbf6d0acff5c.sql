
-- Replace old categories with 4 chicken type categories
INSERT INTO public.categories (slug, name, sort_order) VALUES
  ('boiler', 'Boiler', 1),
  ('layer', 'Layer', 2),
  ('big-layer', 'Big Layer', 3),
  ('natu-kodi', 'Natu Kodi', 4)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

-- Move any existing products from old skinless/with-skin categories to Boiler
UPDATE public.products
SET category_id = (SELECT id FROM public.categories WHERE slug = 'boiler')
WHERE category_id IN (
  SELECT id FROM public.categories WHERE slug IN ('skinless-chicken', 'with-skin')
);

-- Remove the old categories
DELETE FROM public.categories WHERE slug IN ('skinless-chicken', 'with-skin');
