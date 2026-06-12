
CREATE TABLE IF NOT EXISTS public.error_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text NOT NULL,
  url text,
  user_agent text,
  app_version text,
  console_tail jsonb,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT error_reports_message_len CHECK (char_length(message) BETWEEN 1 AND 2000),
  CONSTRAINT error_reports_status_chk CHECK (status IN ('open','triaged','closed'))
);

GRANT SELECT, INSERT, UPDATE ON public.error_reports TO authenticated;
GRANT INSERT ON public.error_reports TO anon;
GRANT ALL ON public.error_reports TO service_role;

ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own error reports"
  ON public.error_reports FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "anon insert error reports"
  ON public.error_reports FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

CREATE POLICY "admins read error reports"
  ON public.error_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update error reports"
  ON public.error_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER error_reports_set_updated_at
  BEFORE UPDATE ON public.error_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS error_reports_created_idx ON public.error_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS error_reports_status_idx ON public.error_reports(status, created_at DESC);

-- Analytics support indexes
CREATE INDEX IF NOT EXISTS walk_sessions_user_status_started_idx ON public.walk_sessions(user_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS walk_sessions_started_idx ON public.walk_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS event_rsvps_event_status_idx ON public.event_rsvps(event_id, status);
CREATE INDEX IF NOT EXISTS event_rsvps_created_idx ON public.event_rsvps(created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_kind_created_idx ON public.notifications(user_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS profiles_created_idx ON public.profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS high_fives_created_idx ON public.high_fives(created_at DESC);
CREATE INDEX IF NOT EXISTS friendships_created_idx ON public.friendships(created_at DESC);
CREATE INDEX IF NOT EXISTS journal_entries_created_idx ON public.journal_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS events_created_idx ON public.events(created_at DESC);
CREATE INDEX IF NOT EXISTS subscriptions_status_env_idx ON public.subscriptions(environment, status);
