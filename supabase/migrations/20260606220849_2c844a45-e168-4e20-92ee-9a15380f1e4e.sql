
-- 1. Profile metrics columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS walks_hosted int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS walks_attended int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_streak_weeks int NOT NULL DEFAULT 0;

-- 2. Recompute metrics for a user
CREATE OR REPLACE FUNCTION public.recompute_walker_metrics(_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hosted_count int;
  attended_count int;
  streak int := 0;
  cur_week date;
  has_walk boolean;
BEGIN
  SELECT count(*) INTO hosted_count
  FROM public.events
  WHERE host_user_id = _uid
    AND status = 'published'
    AND starts_at < now();

  SELECT count(*) INTO attended_count
  FROM public.event_rsvps r
  JOIN public.events e ON e.id = r.event_id
  WHERE r.user_id = _uid
    AND r.status = 'going'
    AND e.starts_at < now();

  -- streak: consecutive ISO-weeks (current week first) with any going RSVP or hosted event
  cur_week := date_trunc('week', now())::date;
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.event_rsvps r
        JOIN public.events e ON e.id = r.event_id
        WHERE r.user_id = _uid AND r.status = 'going'
          AND date_trunc('week', e.starts_at)::date = cur_week
      UNION ALL
      SELECT 1 FROM public.events e
        WHERE e.host_user_id = _uid
          AND date_trunc('week', e.starts_at)::date = cur_week
    ) INTO has_walk;

    EXIT WHEN NOT has_walk;
    streak := streak + 1;
    cur_week := cur_week - INTERVAL '7 days';
    EXIT WHEN streak > 520; -- safety: cap at 10y
  END LOOP;

  UPDATE public.profiles
    SET walks_hosted = hosted_count,
        walks_attended = attended_count,
        current_streak_weeks = streak,
        updated_at = now()
    WHERE id = _uid;
END;
$$;

-- 3. Trigger to recompute on RSVP changes
CREATE OR REPLACE FUNCTION public.tg_rsvp_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_walker_metrics(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_walker_metrics(NEW.user_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_rsvp_recompute ON public.event_rsvps;
CREATE TRIGGER trg_rsvp_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.event_rsvps
FOR EACH ROW EXECUTE FUNCTION public.tg_rsvp_recompute();

-- 4. Trigger to recompute when an event is created/updated for host
CREATE OR REPLACE FUNCTION public.tg_event_host_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.host_user_id IS NOT NULL THEN
    PERFORM public.recompute_walker_metrics(NEW.host_user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_host_recompute ON public.events;
CREATE TRIGGER trg_event_host_recompute
AFTER INSERT OR UPDATE OF host_user_id, starts_at, status ON public.events
FOR EACH ROW EXECUTE FUNCTION public.tg_event_host_recompute();

-- 5. New badge definitions
INSERT INTO public.badge_definitions (key, name, description, category, icon, criteria, is_active) VALUES
  ('first_host', 'First Host', 'You planned your first walk.', 'host', '🌱', '{}'::jsonb, true),
  ('five_friends_walked', 'Five Together', 'Five people RSVP''d going to one of your walks.', 'host', '🤝', '{}'::jsonb, true),
  ('rainy_rsvp', 'Rain or Shine', 'You RSVP''d to a walk forecasted to rain.', 'walk', '🌧️', '{}'::jsonb, true),
  ('four_seasons_host', 'Four Seasons Host', 'You''ve hosted walks in all four seasons.', 'host', '🍂', '{}'::jsonb, true),
  ('viral_invite', 'Walk Caller', 'Three or more guests joined via your invite link.', 'social', '📣', '{}'::jsonb, true)
ON CONFLICT (key) DO NOTHING;
