-- Ambient music library
CREATE TABLE public.ambient_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist text,
  audio_path text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ambient_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ambient_tracks_select_active_or_admin" ON public.ambient_tracks
  FOR SELECT TO authenticated
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ambient_tracks_admin_insert" ON public.ambient_tracks
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ambient_tracks_admin_update" ON public.ambient_tracks
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ambient_tracks_admin_delete" ON public.ambient_tracks
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER tg_ambient_tracks_updated_at
  BEFORE UPDATE ON public.ambient_tracks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Private storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('ambient-music', 'ambient-music', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "ambient_music_read_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ambient-music');

CREATE POLICY "ambient_music_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ambient-music' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ambient_music_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ambient-music' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ambient_music_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ambient-music' AND has_role(auth.uid(), 'admin'::app_role));