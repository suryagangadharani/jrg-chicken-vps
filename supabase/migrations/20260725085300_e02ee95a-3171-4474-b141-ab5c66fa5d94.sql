ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS products_category_sort_idx ON public.products (category_id, sort_order);

UPDATE public.categories SET name = 'Broiler', slug = 'broiler' WHERE slug = 'boiler';

UPDATE public.products SET category_id = NULL WHERE category_id = '8aa9f02a-fb1f-469d-810d-42f148d7c8e1';
DELETE FROM public.categories WHERE id = '8aa9f02a-fb1f-469d-810d-42f148d7c8e1';