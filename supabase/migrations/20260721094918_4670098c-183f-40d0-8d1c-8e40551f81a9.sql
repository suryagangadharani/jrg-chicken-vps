
CREATE TABLE public.fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX fcm_tokens_user_id_idx ON public.fcm_tokens(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fcm_tokens TO authenticated;
GRANT ALL ON public.fcm_tokens TO service_role;

ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own fcm tokens" ON public.fcm_tokens
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER fcm_tokens_touch BEFORE UPDATE ON public.fcm_tokens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
