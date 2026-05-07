
CREATE TABLE public.guided_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  host text,
  host_role text,
  duration_seconds integer NOT NULL DEFAULT 600,
  audio_url text,
  cover_url text,
  mood_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  category text NOT NULL DEFAULT 'ambient',
  intro_seconds integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  generative_key text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.guided_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY guided_tracks_select_all ON public.guided_tracks
  FOR SELECT TO authenticated USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY guided_tracks_admin_manage ON public.guided_tracks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER guided_tracks_updated_at
  BEFORE UPDATE ON public.guided_tracks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.walk_sessions
  ADD COLUMN guided_track_id uuid REFERENCES public.guided_tracks(id) ON DELETE SET NULL;

-- Seed generative tracks (no hosted audio needed)
INSERT INTO public.guided_tracks (title, host, host_role, duration_seconds, category, mood_tags, generative_key, sort_order)
VALUES
  ('Morning Drift', 'Generative', 'Ambient pad', 1200, 'ambient', ARRAY['anxious','restless','overwhelmed','okay','hopeful'], 'morning', 1),
  ('Midday Open Sky', 'Generative', 'Ambient pad', 1200, 'ambient', ARRAY['burned out','restless','okay','hopeful'], 'midday', 2),
  ('Evening Settle', 'Generative', 'Ambient pad', 1500, 'ambient', ARRAY['anxious','sad','tender','grieving','lonely','okay'], 'evening', 3),
  ('Night Low Tide', 'Generative', 'Ambient pad', 1500, 'ambient', ARRAY['lonely','sad','grieving','tender','just need company'], 'night', 4);
