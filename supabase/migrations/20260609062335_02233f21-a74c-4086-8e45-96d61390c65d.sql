-- saved_reads: per-user bookmarks of blog posts
CREATE TABLE public.saved_reads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_reads TO authenticated;
GRANT ALL ON public.saved_reads TO service_role;

ALTER TABLE public.saved_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own saved reads"
  ON public.saved_reads FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Featured flags for curation
ALTER TABLE public.podcast_episodes
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_rank integer;

ALTER TABLE public.ambient_tracks
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_rank integer;

ALTER TABLE public.guided_tracks
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_rank integer;

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_rank integer;
