CREATE TABLE public.event_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  storage_path text NOT NULL,
  caption text,
  width integer,
  height integer,
  bytes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_photos_event_idx ON public.event_photos(event_id, created_at DESC);
CREATE INDEX event_photos_user_idx ON public.event_photos(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_photos TO authenticated;
GRANT SELECT ON public.event_photos TO anon;
GRANT ALL ON public.event_photos TO service_role;

ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_photos_public_select" ON public.event_photos
  FOR SELECT USING (true);

CREATE POLICY "event_photos_own_insert" ON public.event_photos
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "event_photos_own_update" ON public.event_photos
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "event_photos_own_delete" ON public.event_photos
  FOR DELETE TO authenticated USING (user_id = auth.uid());