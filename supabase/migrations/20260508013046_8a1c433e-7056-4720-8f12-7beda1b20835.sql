
-- Add facilitator to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'facilitator';

-- facilitator_profiles
CREATE TABLE public.facilitator_profiles (
  user_id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending',
  credentials text,
  bio text,
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.facilitator_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facilitator_profiles_select_self_or_admin" ON public.facilitator_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "facilitator_profiles_insert_self" ON public.facilitator_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "facilitator_profiles_update_self_or_admin" ON public.facilitator_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_facilitator_profiles_updated
  BEFORE UPDATE ON public.facilitator_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- facilitator_sessions
CREATE TABLE public.facilitator_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'available',
  current_audio_room_id uuid,
  pods_visited integer NOT NULL DEFAULT 0,
  total_seconds integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.facilitator_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facilitator_sessions_select_self_or_admin" ON public.facilitator_sessions
  FOR SELECT TO authenticated
  USING (facilitator_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "facilitator_sessions_insert_self" ON public.facilitator_sessions
  FOR INSERT TO authenticated
  WITH CHECK (facilitator_user_id = auth.uid());

CREATE POLICY "facilitator_sessions_update_self" ON public.facilitator_sessions
  FOR UPDATE TO authenticated
  USING (facilitator_user_id = auth.uid());

CREATE INDEX idx_facilitator_sessions_user_status ON public.facilitator_sessions(facilitator_user_id, status);

CREATE TRIGGER trg_facilitator_sessions_updated
  BEFORE UPDATE ON public.facilitator_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- facilitator_visits
CREATE TABLE public.facilitator_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_session_id uuid NOT NULL REFERENCES public.facilitator_sessions(id) ON DELETE CASCADE,
  facilitator_user_id uuid NOT NULL,
  audio_room_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  planned_duration_seconds integer NOT NULL DEFAULT 300,
  outcome text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.facilitator_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facilitator_visits_select_self_or_admin" ON public.facilitator_visits
  FOR SELECT TO authenticated
  USING (facilitator_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "facilitator_visits_insert_self" ON public.facilitator_visits
  FOR INSERT TO authenticated
  WITH CHECK (facilitator_user_id = auth.uid());

CREATE POLICY "facilitator_visits_update_self" ON public.facilitator_visits
  FOR UPDATE TO authenticated
  USING (facilitator_user_id = auth.uid());

CREATE INDEX idx_facilitator_visits_session ON public.facilitator_visits(facilitator_session_id);
CREATE INDEX idx_facilitator_visits_room ON public.facilitator_visits(audio_room_id);
