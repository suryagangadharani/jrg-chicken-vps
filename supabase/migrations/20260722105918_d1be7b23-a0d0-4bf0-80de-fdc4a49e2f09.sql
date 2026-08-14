WITH ranked AS (
  SELECT id,
         to_char((created_at AT TIME ZONE 'Asia/Kolkata')::date, 'YYYYMMDD') AS day_str,
         row_number() OVER (
           PARTITION BY (created_at AT TIME ZONE 'Asia/Kolkata')::date
           ORDER BY created_at
         ) AS seq
  FROM public.orders
)
UPDATE public.orders o
SET order_number = r.day_str || '-' || lpad(r.seq::text, 2, '0')
FROM ranked r
WHERE o.id = r.id;