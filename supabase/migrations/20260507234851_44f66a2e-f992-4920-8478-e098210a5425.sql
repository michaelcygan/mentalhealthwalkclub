
CREATE TABLE public.group_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  sender_user_id uuid NOT NULL,
  recipient_user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('welcome','kudos')),
  badge_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_day date GENERATED ALWAYS AS ((created_at AT TIME ZONE 'UTC')::date) STORED,
  read_at timestamptz,
  CONSTRAINT group_signals_no_self CHECK (sender_user_id <> recipient_user_id)
);

CREATE INDEX idx_group_signals_recipient ON public.group_signals (recipient_user_id, read_at, created_at DESC);
CREATE INDEX idx_group_signals_group ON public.group_signals (group_id, kind, created_at DESC);
CREATE UNIQUE INDEX idx_group_signals_dedupe ON public.group_signals (sender_user_id, recipient_user_id, kind, COALESCE(badge_id, '00000000-0000-0000-0000-000000000000'::uuid), created_day);

ALTER TABLE public.group_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_signals_insert_self ON public.group_signals
  FOR INSERT TO authenticated
  WITH CHECK (sender_user_id = auth.uid());

CREATE POLICY group_signals_select_own ON public.group_signals
  FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid() OR sender_user_id = auth.uid());

CREATE POLICY group_signals_update_recipient ON public.group_signals
  FOR UPDATE TO authenticated
  USING (recipient_user_id = auth.uid());

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS allow_group_signals boolean NOT NULL DEFAULT true;
