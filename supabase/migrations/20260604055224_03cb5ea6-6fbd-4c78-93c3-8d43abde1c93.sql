
-- Phase 1: drop orphan tables and related functions

-- Update handle_new_user to remove groups auto-join
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'walker_' || substr(NEW.id::text, 1, 8)
  );
  INSERT INTO public.user_preferences (user_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  RETURN NEW;
END; $$;

-- Drop leaderboard/rank functions (no longer used)
DROP FUNCTION IF EXISTS public.get_leaderboard(text, uuid);
DROP FUNCTION IF EXISTS public.get_my_rank(text, uuid);
DROP FUNCTION IF EXISTS public.group_pulse_week();

-- Drop trigger functions for tables being removed
DROP FUNCTION IF EXISTS public.tg_group_member_count() CASCADE;
DROP FUNCTION IF EXISTS public.tg_audio_room_participant_count() CASCADE;

-- Drop orphan tables (CASCADE removes FK constraints from retained tables like walk_sessions)
DROP TABLE IF EXISTS public.audio_room_participants CASCADE;
DROP TABLE IF EXISTS public.room_audience_presence CASCADE;
DROP TABLE IF EXISTS public.room_reactions CASCADE;
DROP TABLE IF EXISTS public.audio_rooms CASCADE;
DROP TABLE IF EXISTS public.facilitator_visits CASCADE;
DROP TABLE IF EXISTS public.facilitator_sessions CASCADE;
DROP TABLE IF EXISTS public.facilitator_profiles CASCADE;
DROP TABLE IF EXISTS public.ghost_host_assignments CASCADE;
DROP TABLE IF EXISTS public.ghost_walk_config CASCADE;
DROP TABLE IF EXISTS public.practice_members CASCADE;
DROP TABLE IF EXISTS public.practices CASCADE;
DROP TABLE IF EXISTS public.walk_live_pings CASCADE;
DROP TABLE IF EXISTS public.walk_routes CASCADE;
DROP TABLE IF EXISTS public.walk_templates CASCADE;
DROP TABLE IF EXISTS public.group_signals CASCADE;
DROP TABLE IF EXISTS public.group_memberships CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;

-- Remove the 'facilitator' enum value usage isn't strictly necessary; keep enum as-is for now

-- Drop now-unused columns from walk_sessions
ALTER TABLE public.walk_sessions
  DROP COLUMN IF EXISTS audio_room_id,
  DROP COLUMN IF EXISTS facilitator_user_id,
  DROP COLUMN IF EXISTS facilitator_seat_reserved,
  DROP COLUMN IF EXISTS group_id;

-- Simplify badge evaluator (remove audio/companion/group references that no longer apply)
CREATE OR REPLACE FUNCTION public.evaluate_badges(_user_id uuid, _walk_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  total_walks INTEGER;
  ws RECORD;
  badge_rec RECORD;
  rainy_count INTEGER;
  season_count INTEGER;
  hour_local INTEGER;
  rain_codes INTEGER[] := ARRAY[51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99];
BEGIN
  SELECT COUNT(*) INTO total_walks FROM public.walk_sessions WHERE user_id = _user_id AND status = 'completed';
  SELECT * INTO ws FROM public.walk_sessions WHERE id = _walk_session_id;

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
  IF EXTRACT(DOW FROM ws.started_at) = 0 THEN
    FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'sunday_reset' LOOP
      INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'still_here' LOOP
    INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
  END LOOP;

  SELECT COUNT(*) INTO rainy_count
    FROM public.walk_sessions
    WHERE user_id = _user_id AND status = 'completed'
      AND (weather_at_end->>'code')::int = ANY(rain_codes);
  IF rainy_count >= 5 THEN
    FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'weather_warrior' LOOP
      INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  hour_local := EXTRACT(HOUR FROM ws.started_at);
  IF hour_local < 7 THEN
    FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'dawn_patrol' LOOP
      INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  IF hour_local BETWEEN 17 AND 20 THEN
    FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'golden_hour' LOOP
      INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

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
END; $$;
