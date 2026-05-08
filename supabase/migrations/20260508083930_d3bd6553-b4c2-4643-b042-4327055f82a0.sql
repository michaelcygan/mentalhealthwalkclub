
-- 1. Seed new badge definitions (idempotent)
INSERT INTO public.badge_definitions (key, name, description, category, icon) VALUES
  ('weather_warrior', 'Weather Warrior', 'Walked through rain five times. Showing up when it''s hard.', 'commitment', 'cloud-rain'),
  ('golden_hour', 'Golden Hour', 'Started a walk within an hour of sunset.', 'aesthetic', 'sun'),
  ('dawn_patrol', 'Dawn Patrol', 'Started a walk before 7am local time.', 'identity', 'sunrise'),
  ('four_seasons', 'Four Seasons', 'Walked in all four seasons.', 'long_arc', 'leaf'),
  ('loop_closer', 'Loop Closer', 'Finished a walk within 50m of where you started.', 'craft', 'circle-dashed'),
  ('companion', 'Companion', 'Ten walks alongside others in audio rooms.', 'social', 'users')
ON CONFLICT (key) DO NOTHING;

-- 2. Extend evaluate_badges with new branches
CREATE OR REPLACE FUNCTION public.evaluate_badges(_user_id uuid, _walk_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_walks INTEGER;
  ws RECORD;
  badge_rec RECORD;
  rainy_count INTEGER;
  audio_count INTEGER;
  season_count INTEGER;
  start_local TIMESTAMP;
  hour_local INTEGER;
  rain_codes INTEGER[] := ARRAY[51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99];
BEGIN
  SELECT COUNT(*) INTO total_walks FROM public.walk_sessions WHERE user_id = _user_id AND status = 'completed';
  SELECT * INTO ws FROM public.walk_sessions WHERE id = _walk_session_id;

  -- Existing badges
  IF total_walks >= 1 THEN
    FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'first_walk' LOOP
      INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  IF total_walks >= 10 THEN
    FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'ten_walks' LOOP
      INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  IF ws.mood_before_score IS NOT NULL AND ws.mood_after_score IS NOT NULL AND ws.mood_after_score > ws.mood_before_score THEN
    FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'walked_it_through' LOOP
      INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  IF ws.walk_type IN ('solo', 'guided_solo') AND ws.mood_before IN ('anxious','lonely','overwhelmed','sad','burned_out','grieving') THEN
    FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'quiet_courage' LOOP
      INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  IF ws.walk_type IN ('audio','irl_event') OR ws.audio_room_id IS NOT NULL OR ws.event_id IS NOT NULL THEN
    FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'walked_with_others' LOOP
      INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  IF EXTRACT(DOW FROM ws.started_at) = 0 THEN
    FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'sunday_reset' LOOP
      INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'still_here' LOOP
    INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
  END LOOP;

  -- NEW: weather_warrior (5 rainy walks)
  SELECT COUNT(*) INTO rainy_count
    FROM public.walk_sessions
    WHERE user_id = _user_id AND status = 'completed'
      AND (weather_at_end->>'code')::int = ANY(rain_codes);
  IF rainy_count >= 5 THEN
    FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'weather_warrior' LOOP
      INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- NEW: dawn_patrol (started before 7am UTC — close enough; client-local refinement could come later)
  hour_local := EXTRACT(HOUR FROM ws.started_at);
  IF hour_local < 7 THEN
    FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'dawn_patrol' LOOP
      INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- NEW: golden_hour (started 17:00–20:00 local-ish)
  IF hour_local BETWEEN 17 AND 20 THEN
    FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'golden_hour' LOOP
      INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- NEW: companion (10 audio-room walks)
  SELECT COUNT(*) INTO audio_count
    FROM public.walk_sessions
    WHERE user_id = _user_id AND status = 'completed' AND audio_room_id IS NOT NULL;
  IF audio_count >= 10 THEN
    FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'companion' LOOP
      INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- NEW: four_seasons — count distinct seasons of completed walks (north-hemi approximation)
  SELECT COUNT(DISTINCT season) INTO season_count FROM (
    SELECT CASE
      WHEN EXTRACT(MONTH FROM started_at) IN (12,1,2) THEN 'winter'
      WHEN EXTRACT(MONTH FROM started_at) IN (3,4,5) THEN 'spring'
      WHEN EXTRACT(MONTH FROM started_at) IN (6,7,8) THEN 'summer'
      ELSE 'fall'
    END AS season
    FROM public.walk_sessions WHERE user_id = _user_id AND status = 'completed'
  ) s;
  IF season_count >= 4 THEN
    FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'four_seasons' LOOP
      INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END;
$function$;

-- 3. Leaderboard function (top 100, per period, optional group scope)
CREATE OR REPLACE FUNCTION public.get_leaderboard(_period text DEFAULT 'week', _group_id uuid DEFAULT NULL)
RETURNS TABLE (
  rank bigint,
  user_id uuid,
  display_name text,
  avatar_url text,
  city text,
  total_minutes bigint,
  total_walks bigint,
  badge_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH bounds AS (
    SELECT CASE _period
      WHEN 'week' THEN date_trunc('week', now())
      WHEN 'month' THEN date_trunc('month', now())
      ELSE 'epoch'::timestamptz
    END AS since
  ),
  agg AS (
    SELECT
      ws.user_id,
      SUM(COALESCE(ws.duration_seconds, 0))::bigint / 60 AS total_minutes,
      COUNT(*)::bigint AS total_walks
    FROM public.walk_sessions ws, bounds b
    WHERE ws.status = 'completed'
      AND ws.started_at >= b.since
      AND (_group_id IS NULL OR ws.group_id = _group_id)
    GROUP BY ws.user_id
    HAVING SUM(COALESCE(ws.duration_seconds, 0)) > 0
  ),
  ranked AS (
    SELECT
      RANK() OVER (ORDER BY total_minutes DESC) AS rank,
      a.user_id,
      a.total_minutes,
      a.total_walks
    FROM agg a
    ORDER BY total_minutes DESC
    LIMIT 100
  )
  SELECT
    r.rank,
    r.user_id,
    p.display_name,
    p.avatar_url,
    p.city,
    r.total_minutes,
    r.total_walks,
    (SELECT COUNT(*) FROM public.user_badges ub WHERE ub.user_id = r.user_id)::bigint AS badge_count
  FROM ranked r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  ORDER BY r.rank;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, uuid) TO authenticated;

-- 4. User's own rank lookup (returns null if no walks in period)
CREATE OR REPLACE FUNCTION public.get_my_rank(_period text DEFAULT 'week', _group_id uuid DEFAULT NULL)
RETURNS TABLE (rank bigint, total_minutes bigint, next_rank_minutes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH bounds AS (
    SELECT CASE _period
      WHEN 'week' THEN date_trunc('week', now())
      WHEN 'month' THEN date_trunc('month', now())
      ELSE 'epoch'::timestamptz
    END AS since
  ),
  agg AS (
    SELECT
      ws.user_id,
      SUM(COALESCE(ws.duration_seconds, 0))::bigint / 60 AS total_minutes
    FROM public.walk_sessions ws, bounds b
    WHERE ws.status = 'completed'
      AND ws.started_at >= b.since
      AND (_group_id IS NULL OR ws.group_id = _group_id)
    GROUP BY ws.user_id
  ),
  ranked AS (
    SELECT user_id, total_minutes, RANK() OVER (ORDER BY total_minutes DESC) AS rank
    FROM agg
  ),
  me AS (
    SELECT rank, total_minutes FROM ranked WHERE user_id = auth.uid()
  )
  SELECT
    me.rank,
    me.total_minutes,
    (SELECT MIN(total_minutes) FROM ranked WHERE rank = me.rank - 1) AS next_rank_minutes
  FROM me;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_rank(text, uuid) TO authenticated;
