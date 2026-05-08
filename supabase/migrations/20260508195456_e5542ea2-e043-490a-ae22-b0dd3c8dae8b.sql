
-- 1. profiles flag
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_host_account boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_profiles_host ON public.profiles(is_host_account) WHERE is_host_account = true;

-- 2. groups flags
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS auto_join boolean NOT NULL DEFAULT false;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS ghost_cadence_override integer;
CREATE INDEX IF NOT EXISTS idx_groups_auto_join ON public.groups(auto_join) WHERE auto_join = true;
CREATE INDEX IF NOT EXISTS idx_groups_eligibility ON public.groups(is_active, member_count);

-- 3. events flag
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_events_seed_starts ON public.events(is_seed, starts_at) WHERE is_seed = true;

-- 4. walk_templates
CREATE TABLE IF NOT EXISTS public.walk_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme text NOT NULL,
  title_pattern text NOT NULL,
  description text,
  length_minutes integer NOT NULL DEFAULT 45,
  vibe text,
  weight integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_walk_templates_theme ON public.walk_templates(theme) WHERE is_active = true;
ALTER TABLE public.walk_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY walk_templates_select_all ON public.walk_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY walk_templates_admin_manage ON public.walk_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5. ghost_host_assignments
CREATE TABLE IF NOT EXISTS public.ghost_host_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  weight integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(host_user_id, group_id)
);
CREATE INDEX IF NOT EXISTS idx_gha_group ON public.ghost_host_assignments(group_id);
ALTER TABLE public.ghost_host_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY gha_select_all ON public.ghost_host_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY gha_admin_manage ON public.ghost_host_assignments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 6. ghost_walk_config (single tunable config row, key/value)
CREATE TABLE IF NOT EXISTS public.ghost_walk_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ghost_walk_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY gwc_admin_select ON public.ghost_walk_config FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY gwc_admin_manage ON public.ghost_walk_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed default config
INSERT INTO public.ghost_walk_config (key, value) VALUES
  ('cadence_tiers', '[
    {"min":25,"max":99,"per_week":1},
    {"min":100,"max":499,"per_week":3},
    {"min":500,"max":1999,"per_week":5},
    {"min":2000,"max":999999,"per_week":7}
  ]'::jsonb),
  ('prime_slots', '{
    "default":  {"weekday":["07:00","12:15","18:15"],"weekend":["08:30","16:00"]},
    "reset":    {"weekday":["07:00","21:00"],"weekend":["09:00"]},
    "quiet":    {"weekday":["07:00","21:00"],"weekend":["07:30"]},
    "burnout":  {"weekday":["18:30"],"weekend":["10:00"]},
    "chapter":  {"weekday":["06:30","12:15","18:15"],"weekend":["08:00","09:30"]}
  }'::jsonb),
  ('commons_cohort_cap', '1000'::jsonb),
  ('lookahead_hours', '72'::jsonb),
  ('min_gap_minutes', '120'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 7. Updated handle_new_user — auto-join flagged groups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'walker_' || substr(NEW.id::text, 1, 8)
  );
  INSERT INTO public.user_preferences (user_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');

  -- Auto-join all groups flagged auto_join (Commons cohort etc.)
  INSERT INTO public.group_memberships (group_id, user_id, role, status)
  SELECT g.id, NEW.id, 'member', 'active'
  FROM public.groups g
  WHERE g.auto_join = true AND g.is_active = true
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- 8. Leaderboard functions — exclude host accounts
CREATE OR REPLACE FUNCTION public.get_leaderboard(_period text DEFAULT 'week'::text, _group_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(rank bigint, user_id uuid, display_name text, avatar_url text, city text, total_minutes bigint, total_walks bigint, badge_count bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH bounds AS (
    SELECT CASE _period
      WHEN 'week' THEN date_trunc('week', now())
      WHEN 'month' THEN date_trunc('month', now())
      ELSE 'epoch'::timestamptz
    END AS since
  ),
  agg AS (
    SELECT ws.user_id,
      SUM(COALESCE(ws.duration_seconds, 0))::bigint / 60 AS total_minutes,
      COUNT(*)::bigint AS total_walks
    FROM public.walk_sessions ws, bounds b
    WHERE ws.status = 'completed'
      AND ws.started_at >= b.since
      AND (_group_id IS NULL OR ws.group_id = _group_id)
      AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = ws.user_id AND p.is_host_account = true)
    GROUP BY ws.user_id
    HAVING SUM(COALESCE(ws.duration_seconds, 0)) > 0
  ),
  ranked AS (
    SELECT RANK() OVER (ORDER BY total_minutes DESC) AS rank, a.user_id, a.total_minutes, a.total_walks
    FROM agg a ORDER BY total_minutes DESC LIMIT 100
  )
  SELECT r.rank, r.user_id, p.display_name, p.avatar_url, p.city, r.total_minutes, r.total_walks,
    (SELECT COUNT(*) FROM public.user_badges ub WHERE ub.user_id = r.user_id)::bigint AS badge_count
  FROM ranked r LEFT JOIN public.profiles p ON p.id = r.user_id
  ORDER BY r.rank;
$$;

CREATE OR REPLACE FUNCTION public.get_my_rank(_period text DEFAULT 'week'::text, _group_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(rank bigint, total_minutes bigint, next_rank_minutes bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH bounds AS (
    SELECT CASE _period
      WHEN 'week' THEN date_trunc('week', now())
      WHEN 'month' THEN date_trunc('month', now())
      ELSE 'epoch'::timestamptz
    END AS since
  ),
  agg AS (
    SELECT ws.user_id, SUM(COALESCE(ws.duration_seconds, 0))::bigint / 60 AS total_minutes
    FROM public.walk_sessions ws, bounds b
    WHERE ws.status = 'completed'
      AND ws.started_at >= b.since
      AND (_group_id IS NULL OR ws.group_id = _group_id)
      AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = ws.user_id AND p.is_host_account = true)
    GROUP BY ws.user_id
  ),
  ranked AS (SELECT user_id, total_minutes, RANK() OVER (ORDER BY total_minutes DESC) AS rank FROM agg),
  me AS (SELECT rank, total_minutes FROM ranked WHERE user_id = auth.uid())
  SELECT me.rank, me.total_minutes,
    (SELECT MIN(total_minutes) FROM ranked WHERE rank = me.rank - 1) AS next_rank_minutes
  FROM me;
$$;
