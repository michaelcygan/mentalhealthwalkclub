
-- 1. Add metadata columns to ambient_tracks
ALTER TABLE public.ambient_tracks
  ADD COLUMN IF NOT EXISTS genre text,
  ADD COLUMN IF NOT EXISTS mood_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cover_path text,
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bpm int;

-- 2. Update ambient-music bucket: 250 MB cap, MP3/M4A only
UPDATE storage.buckets
   SET file_size_limit = 262144000,
       allowed_mime_types = ARRAY['audio/mpeg','audio/mp4','audio/m4a','audio/x-m4a','audio/aac']
 WHERE id = 'ambient-music';

-- 3. Create ambient-covers public bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ambient-covers', 'ambient-covers', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 4. Storage RLS policies for ambient-covers
DROP POLICY IF EXISTS "ambient_covers_public_read" ON storage.objects;
CREATE POLICY "ambient_covers_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ambient-covers');

DROP POLICY IF EXISTS "ambient_covers_admin_insert" ON storage.objects;
CREATE POLICY "ambient_covers_admin_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ambient-covers' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ambient_covers_admin_update" ON storage.objects;
CREATE POLICY "ambient_covers_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ambient-covers' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'ambient-covers' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ambient_covers_admin_delete" ON storage.objects;
CREATE POLICY "ambient_covers_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ambient-covers' AND public.has_role(auth.uid(), 'admin'));

-- 5. Storage RLS policies for ambient-music (admin write, signed read via service)
DROP POLICY IF EXISTS "ambient_music_admin_insert" ON storage.objects;
CREATE POLICY "ambient_music_admin_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ambient-music' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ambient_music_admin_update" ON storage.objects;
CREATE POLICY "ambient_music_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ambient-music' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'ambient-music' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ambient_music_admin_delete" ON storage.objects;
CREATE POLICY "ambient_music_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ambient-music' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ambient_music_authenticated_read" ON storage.objects;
CREATE POLICY "ambient_music_authenticated_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ambient-music');
