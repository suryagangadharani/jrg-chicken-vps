CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_settings public read" ON public.app_settings;
CREATE POLICY "app_settings public read" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "app_settings admin write" ON public.app_settings;
CREATE POLICY "app_settings admin write" ON public.app_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.app_settings (key, value) VALUES ('launch', '{"enabled": true}'::jsonb) ON CONFLICT (key) DO NOTHING;