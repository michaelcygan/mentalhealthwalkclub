
-- trails
CREATE TABLE public.trails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'osm',
  osm_id text,
  kind text,
  name text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  country text,
  region text,
  city text,
  tags jsonb NOT NULL DEFAULT '{}'::jsonb,
  length_m integer,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, osm_id)
);
GRANT SELECT ON public.trails TO authenticated;
GRANT ALL ON public.trails TO service_role;
ALTER TABLE public.trails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trails readable by authenticated" ON public.trails
  FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trails_set_updated_at BEFORE UPDATE ON public.trails
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX trails_lat_lng_idx ON public.trails (lat, lng);

-- user_saved_trails
CREATE TABLE public.user_saved_trails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trail_id uuid NOT NULL REFERENCES public.trails(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, trail_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_saved_trails TO authenticated;
GRANT ALL ON public.user_saved_trails TO service_role;
ALTER TABLE public.user_saved_trails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved trails: owner read" ON public.user_saved_trails
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "saved trails: owner insert" ON public.user_saved_trails
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "saved trails: owner update" ON public.user_saved_trails
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "saved trails: owner delete" ON public.user_saved_trails
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX user_saved_trails_user_pos_idx ON public.user_saved_trails (user_id, position);

-- trail_search_log
CREATE TABLE public.trail_search_log (
  cell_key text PRIMARY KEY,
  last_synced_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.trail_search_log TO service_role;
ALTER TABLE public.trail_search_log ENABLE ROW LEVEL SECURITY;
-- no policies for regular users; service_role bypasses RLS
