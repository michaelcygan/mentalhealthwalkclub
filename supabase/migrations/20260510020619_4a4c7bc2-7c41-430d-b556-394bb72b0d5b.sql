CREATE OR REPLACE FUNCTION public.group_pulse_week()
RETURNS TABLE(group_id uuid, walkers_week integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT group_id, COUNT(DISTINCT user_id)::int AS walkers_week
  FROM public.walk_sessions
  WHERE status = 'completed'
    AND group_id IS NOT NULL
    AND started_at >= (now() - interval '7 days')
  GROUP BY group_id
$$;

GRANT EXECUTE ON FUNCTION public.group_pulse_week() TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_walk_sessions_group_started_completed
  ON public.walk_sessions (group_id, started_at)
  WHERE status = 'completed' AND group_id IS NOT NULL;