
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'member');

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  bio TEXT,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USER ROLES (separate, with has_role security definer)
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============================================================
-- USER PREFERENCES
-- ============================================================
CREATE TABLE public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  preferred_walk_modes TEXT[] DEFAULT ARRAY[]::TEXT[],
  preferred_themes TEXT[] DEFAULT ARRAY[]::TEXT[],
  audio_comfort_level TEXT DEFAULT 'listener',
  allow_location_features BOOLEAN NOT NULL DEFAULT true,
  allow_step_import BOOLEAN NOT NULL DEFAULT false,
  allow_mood_insights BOOLEAN NOT NULL DEFAULT true,
  stride_meters NUMERIC DEFAULT 0.78,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- GROUPS (renamed from clubs)
-- ============================================================
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  group_type TEXT,
  theme TEXT,
  city TEXT,
  state TEXT,
  owner_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  practice_id UUID,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  member_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);
ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_group_memberships_group ON public.group_memberships(group_id);
CREATE INDEX idx_group_memberships_user ON public.group_memberships(user_id);

-- ============================================================
-- PRACTICES
-- ============================================================
CREATE TABLE public.practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  website TEXT,
  city TEXT,
  state TEXT,
  visibility TEXT NOT NULL DEFAULT 'private',
  subscription_status TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.practices ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.practice_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(practice_id, user_id)
);
ALTER TABLE public.practice_members ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.groups ADD CONSTRAINT groups_practice_fk
  FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE SET NULL;

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'community_walk',
  host_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  practice_id UUID REFERENCES public.practices(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  timezone TEXT,
  venue_name TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  lat NUMERIC,
  lng NUMERIC,
  capacity INTEGER,
  vibe TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  price_cents INTEGER NOT NULL DEFAULT 0,
  donation_percent NUMERIC NOT NULL DEFAULT 0,
  donation_note TEXT,
  accessibility_notes TEXT,
  meeting_point TEXT,
  status TEXT NOT NULL DEFAULT 'published',
  attendee_count INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_events_city_starts ON public.events(city, starts_at);
CREATE INDEX idx_events_starts ON public.events(starts_at);

CREATE TABLE public.event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'going',
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_event_rsvps_event ON public.event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_user ON public.event_rsvps(user_id);

-- ============================================================
-- AUDIO ROOMS
-- ============================================================
CREATE TABLE public.audio_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  theme TEXT,
  room_type TEXT NOT NULL DEFAULT 'open',
  status TEXT NOT NULL DEFAULT 'open',
  host_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  max_participants INTEGER NOT NULL DEFAULT 8,
  current_participant_count INTEGER NOT NULL DEFAULT 0,
  external_room_name TEXT,
  external_room_url TEXT,
  requires_active_walk BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audio_rooms ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audio_rooms_status_theme ON public.audio_rooms(status, theme);

-- ============================================================
-- WALK SESSIONS (core object)
-- ============================================================
CREATE TABLE public.walk_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  walk_type TEXT NOT NULL DEFAULT 'solo',
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  distance_meters NUMERIC DEFAULT 0,
  steps INTEGER DEFAULT 0,
  mood_before TEXT,
  mood_before_score INTEGER,
  mood_after TEXT,
  mood_after_score INTEGER,
  intention TEXT,
  reflection_note TEXT,
  privacy TEXT NOT NULL DEFAULT 'private',
  audio_room_id UUID REFERENCES public.audio_rooms(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.walk_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_walk_sessions_user_started ON public.walk_sessions(user_id, started_at DESC);

CREATE TABLE public.walk_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  walk_session_id UUID NOT NULL REFERENCES public.walk_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.walk_routes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_walk_routes_session ON public.walk_routes(walk_session_id);

CREATE TABLE public.audio_room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audio_room_id UUID NOT NULL REFERENCES public.audio_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  walk_session_id UUID NOT NULL REFERENCES public.walk_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'participant',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  is_muted BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE public.audio_room_participants ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- GOALS
-- ============================================================
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  period TEXT NOT NULL DEFAULT 'weekly',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- BADGES
-- ============================================================
CREATE TABLE public.badge_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  icon TEXT,
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badge_definitions(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  walk_session_id UUID REFERENCES public.walk_sessions(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  UNIQUE(user_id, badge_id)
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SAFETY
-- ============================================================
CREATE TABLE public.safety_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  audio_room_id UUID REFERENCES public.audio_rooms(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  walk_session_id UUID REFERENCES public.walk_sessions(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.safety_reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_safety_reports_status ON public.safety_reports(status);

CREATE TABLE public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(blocker_user_id, blocked_user_id)
);
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- IMPACT DONATIONS
-- ============================================================
CREATE TABLE public.impact_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_revenue_cents BIGINT NOT NULL DEFAULT 0,
  net_profit_cents BIGINT NOT NULL DEFAULT 0,
  donation_percent NUMERIC NOT NULL DEFAULT 0,
  donation_amount_cents BIGINT NOT NULL DEFAULT 0,
  organization_name TEXT,
  organization_url TEXT,
  notes TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.impact_donations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_user_preferences_updated BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_groups_updated BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_practices_updated BEFORE UPDATE ON public.practices FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_audio_rooms_updated BEFORE UPDATE ON public.audio_rooms FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_walk_sessions_updated BEFORE UPDATE ON public.walk_sessions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_walk_routes_updated BEFORE UPDATE ON public.walk_routes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_goals_updated BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_safety_reports_updated BEFORE UPDATE ON public.safety_reports FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- AGGREGATE COUNTERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_group_member_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.groups SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.group_id;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_group_member_count
  AFTER INSERT OR DELETE ON public.group_memberships
  FOR EACH ROW EXECUTE FUNCTION public.tg_group_member_count();

CREATE OR REPLACE FUNCTION public.tg_event_attendee_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'going' THEN
    UPDATE public.events SET attendee_count = attendee_count + 1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'going' THEN
    UPDATE public.events SET attendee_count = GREATEST(attendee_count - 1, 0) WHERE id = OLD.event_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'going' AND NEW.status <> 'going' THEN
      UPDATE public.events SET attendee_count = GREATEST(attendee_count - 1, 0) WHERE id = NEW.event_id;
    ELSIF OLD.status <> 'going' AND NEW.status = 'going' THEN
      UPDATE public.events SET attendee_count = attendee_count + 1 WHERE id = NEW.event_id;
    END IF;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_event_attendee_count
  AFTER INSERT OR UPDATE OR DELETE ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.tg_event_attendee_count();

CREATE OR REPLACE FUNCTION public.tg_audio_room_participant_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    UPDATE public.audio_rooms SET current_participant_count = current_participant_count + 1 WHERE id = NEW.audio_room_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status <> 'active' THEN
    UPDATE public.audio_rooms SET current_participant_count = GREATEST(current_participant_count - 1, 0) WHERE id = NEW.audio_room_id;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_audio_room_participant_count
  AFTER INSERT OR UPDATE ON public.audio_room_participants
  FOR EACH ROW EXECUTE FUNCTION public.tg_audio_room_participant_count();

-- ============================================================
-- BADGE ENGINE
-- ============================================================
CREATE OR REPLACE FUNCTION public.evaluate_badges(_user_id UUID, _walk_session_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  total_walks INTEGER;
  ws RECORD;
  badge_rec RECORD;
  has_audio BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO total_walks FROM public.walk_sessions WHERE user_id = _user_id AND status = 'completed';
  SELECT * INTO ws FROM public.walk_sessions WHERE id = _walk_session_id;

  -- First Walk
  IF total_walks >= 1 THEN
    FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'first_walk' LOOP
      INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Ten Walks Taken
  IF total_walks >= 10 THEN
    FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'ten_walks' LOOP
      INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Walked It Through (mood improved)
  IF ws.mood_before_score IS NOT NULL AND ws.mood_after_score IS NOT NULL AND ws.mood_after_score > ws.mood_before_score THEN
    FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'walked_it_through' LOOP
      INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Quiet Courage (solo walk while feeling anxious/lonely/overwhelmed/sad)
  IF ws.walk_type IN ('solo', 'guided_solo') AND ws.mood_before IN ('anxious','lonely','overwhelmed','sad','burned_out','grieving') THEN
    FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'quiet_courage' LOOP
      INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Walked With Others (audio or IRL)
  IF ws.walk_type IN ('audio','irl_event') OR ws.audio_room_id IS NOT NULL OR ws.event_id IS NOT NULL THEN
    FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'walked_with_others' LOOP
      INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Sunday Reset
  IF EXTRACT(DOW FROM ws.started_at) = 0 THEN
    FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'sunday_reset' LOOP
      INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Still Here (any completed walk)
  FOR badge_rec IN SELECT id FROM public.badge_definitions WHERE key = 'still_here' LOOP
    INSERT INTO public.user_badges (user_id, badge_id, walk_session_id) VALUES (_user_id, badge_rec.id, _walk_session_id) ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- profiles
CREATE POLICY "profiles_select_all_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- user_roles
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_preferences
CREATE POLICY "user_preferences_own" ON public.user_preferences FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- groups
CREATE POLICY "groups_select_all" ON public.groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "groups_insert_admin" ON public.groups FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR owner_user_id = auth.uid());
CREATE POLICY "groups_update_owner_admin" ON public.groups FOR UPDATE TO authenticated USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "groups_delete_admin" ON public.groups FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- group_memberships
CREATE POLICY "group_memberships_select_all" ON public.group_memberships FOR SELECT TO authenticated USING (true);
CREATE POLICY "group_memberships_insert_self" ON public.group_memberships FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "group_memberships_delete_self" ON public.group_memberships FOR DELETE TO authenticated USING (user_id = auth.uid());

-- events
CREATE POLICY "events_select_public" ON public.events FOR SELECT TO authenticated USING (visibility = 'public' OR host_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "events_insert_own" ON public.events FOR INSERT TO authenticated WITH CHECK (host_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "events_update_owner_admin" ON public.events FOR UPDATE TO authenticated USING (host_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "events_delete_owner_admin" ON public.events FOR DELETE TO authenticated USING (host_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- event_rsvps
CREATE POLICY "event_rsvps_select_own_or_host" ON public.event_rsvps FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "event_rsvps_insert_self" ON public.event_rsvps FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "event_rsvps_update_self" ON public.event_rsvps FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "event_rsvps_delete_self" ON public.event_rsvps FOR DELETE TO authenticated USING (user_id = auth.uid());

-- audio_rooms
CREATE POLICY "audio_rooms_select_all" ON public.audio_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "audio_rooms_insert_owner" ON public.audio_rooms FOR INSERT TO authenticated WITH CHECK (host_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "audio_rooms_update_owner_admin" ON public.audio_rooms FOR UPDATE TO authenticated USING (host_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- audio_room_participants
CREATE POLICY "audio_room_participants_select_room" ON public.audio_room_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "audio_room_participants_insert_self" ON public.audio_room_participants FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "audio_room_participants_update_self" ON public.audio_room_participants FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- walk_sessions (private)
CREATE POLICY "walk_sessions_own" ON public.walk_sessions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- walk_routes (private)
CREATE POLICY "walk_routes_own" ON public.walk_routes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- goals
CREATE POLICY "goals_own" ON public.goals FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- badge_definitions
CREATE POLICY "badge_definitions_select_all" ON public.badge_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "badge_definitions_admin_manage" ON public.badge_definitions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_badges (own)
CREATE POLICY "user_badges_select_own" ON public.user_badges FOR SELECT TO authenticated USING (user_id = auth.uid());

-- safety_reports
CREATE POLICY "safety_reports_insert_self" ON public.safety_reports FOR INSERT TO authenticated WITH CHECK (reporter_user_id = auth.uid());
CREATE POLICY "safety_reports_select_admin" ON public.safety_reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "safety_reports_update_admin" ON public.safety_reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- blocks
CREATE POLICY "blocks_own" ON public.blocks FOR ALL TO authenticated USING (blocker_user_id = auth.uid()) WITH CHECK (blocker_user_id = auth.uid());

-- practices
CREATE POLICY "practices_select_member_or_owner" ON public.practices FOR SELECT TO authenticated USING (
  owner_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.practice_members pm WHERE pm.practice_id = id AND pm.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "practices_manage_owner" ON public.practices FOR ALL TO authenticated USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "practice_members_select_member" ON public.practice_members FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.practices p WHERE p.id = practice_id AND p.owner_user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "practice_members_manage_owner" ON public.practice_members FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.practices p WHERE p.id = practice_id AND p.owner_user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.practices p WHERE p.id = practice_id AND p.owner_user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- impact_donations
CREATE POLICY "impact_donations_select_published" ON public.impact_donations FOR SELECT TO authenticated USING (published = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "impact_donations_admin_manage" ON public.impact_donations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
