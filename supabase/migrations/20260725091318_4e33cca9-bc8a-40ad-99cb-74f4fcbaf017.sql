ALTER TABLE public.products ADD COLUMN IF NOT EXISTS badge text;
UPDATE public.products SET badge = 'Highly ordered' WHERE lower(name) LIKE '%regular cut%';