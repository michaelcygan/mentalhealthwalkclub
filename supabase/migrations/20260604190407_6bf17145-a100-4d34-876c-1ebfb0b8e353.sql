CREATE TABLE IF NOT EXISTS public.group_standing_walks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_local_time time NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  meetup_label text CHECK (meetup_label IS NULL OR char_length(meetup_label) <= 160),
  meetup_lat numeric,
  meetup_lng numeric,
  duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 10 AND 480),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_standing_walks TO authenticated;
GRANT ALL ON public.group_standing_walks TO service_role;
CREATE INDEX IF NOT EXISTS gsw_group_idx ON public.group_standing_walks(group_id, active);
CREATE TRIGGER gsw_updated_at BEFORE UPDATE ON public.group_standing_walks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
ALTER TABLE public.group_standing_walks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gsw: members + owner read"
  ON public.group_standing_walks FOR SELECT TO authenticated
  USING (
    public.is_group_owner(auth.uid(), group_id)
    OR public.is_group_member(auth.uid(), group_id)
  );
CREATE POLICY "gsw: owner writes"
  ON public.group_standing_walks FOR INSERT TO authenticated
  WITH CHECK (public.is_group_owner(auth.uid(), group_id));
CREATE POLICY "gsw: owner updates"
  ON public.group_standing_walks FOR UPDATE TO authenticated
  USING (public.is_group_owner(auth.uid(), group_id))
  WITH CHECK (public.is_group_owner(auth.uid(), group_id));
CREATE POLICY "gsw: owner deletes"
  ON public.group_standing_walks FOR DELETE TO authenticated
  USING (public.is_group_owner(auth.uid(), group_id));

-- Idempotent materialization key for group walks.
CREATE UNIQUE INDEX IF NOT EXISTS events_group_starts_at_uniq
  ON public.events(group_id, starts_at) WHERE group_id IS NOT NULL;

-- Allow group members to see group walks.
DROP POLICY IF EXISTS events_select_public ON public.events;
CREATE POLICY events_select_public ON public.events
  FOR SELECT TO authenticated
  USING (
    (host_user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (
      visibility = 'public' AND (
        audience_mode = 'public'
        OR (audience_mode = 'friends' AND are_friends(auth.uid(), host_user_id))
        OR (audience_mode = 'circles_allowlist' AND user_in_event_allowlist(auth.uid(), id))
        OR (audience_mode = 'friends_except_blocklist' AND are_friends(auth.uid(), host_user_id)
            AND NOT user_in_event_blocklist(auth.uid(), id))
      )
    )
    OR (
      audience_mode = 'group' AND group_id IS NOT NULL
      AND public.is_group_member(auth.uid(), group_id)
    )
  );