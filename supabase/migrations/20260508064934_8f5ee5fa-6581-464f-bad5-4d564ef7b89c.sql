
-- Walk photos table
CREATE TABLE public.walk_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  walk_session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  storage_path TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  bytes INTEGER,
  taken_at_seconds INTEGER NOT NULL DEFAULT 0,
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.walk_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "walk_photos_own_select" ON public.walk_photos
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "walk_photos_own_insert" ON public.walk_photos
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "walk_photos_own_update" ON public.walk_photos
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "walk_photos_own_delete" ON public.walk_photos
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX walk_photos_walk_session_idx ON public.walk_photos (walk_session_id);
CREATE INDEX walk_photos_user_idx ON public.walk_photos (user_id);

-- Private storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('walk-photos', 'walk-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can read/write only inside their own /{auth.uid()}/ folder
CREATE POLICY "walk_photos_storage_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'walk-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "walk_photos_storage_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'walk-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "walk_photos_storage_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'walk-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "walk_photos_storage_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'walk-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
