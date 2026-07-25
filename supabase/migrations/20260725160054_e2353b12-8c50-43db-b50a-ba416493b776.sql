
-- Ensure timestamp trigger helper exists
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================
-- RADIO STATIONS & TRACKS
-- =========================
CREATE TABLE IF NOT EXISTS public.radio_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  cover_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.radio_stations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radio_stations TO authenticated;
GRANT ALL ON public.radio_stations TO service_role;

ALTER TABLE public.radio_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active stations"
  ON public.radio_stations FOR SELECT
  USING (is_active OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage stations"
  ON public.radio_stations FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_radio_stations_updated_at
  BEFORE UPDATE ON public.radio_stations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.radio_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.radio_stations(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  title text NOT NULL,
  artist text,
  duration_s integer,
  sort integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_radio_tracks_station ON public.radio_tracks(station_id, sort);

GRANT SELECT ON public.radio_tracks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radio_tracks TO authenticated;
GRANT ALL ON public.radio_tracks TO service_role;

ALTER TABLE public.radio_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active tracks"
  ON public.radio_tracks FOR SELECT
  USING (is_active OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage tracks"
  ON public.radio_tracks FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_radio_tracks_updated_at
  BEFORE UPDATE ON public.radio_tracks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- BLOG_POSTS (extend for first-party CMS)
-- =========================
ALTER TABLE public.blog_posts
  ALTER COLUMN feed_id DROP NOT NULL,
  ALTER COLUMN guid DROP NOT NULL,
  ALTER COLUMN link DROP NOT NULL;

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  ADD COLUMN IF NOT EXISTS body_md text,
  ADD COLUMN IF NOT EXISTS body_html text,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_posts_slug_unique
  ON public.blog_posts(slug) WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published
  ON public.blog_posts(status, published_at DESC);

-- Backfill: mark existing rss-ingested rows as published so nothing disappears
UPDATE public.blog_posts SET status = 'published' WHERE status = 'draft' AND feed_id IS NOT NULL;

-- Replace read policies so anon/authenticated can see published first-party posts
DROP POLICY IF EXISTS "Anyone can view blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Public can view blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Blog posts are viewable" ON public.blog_posts;

CREATE POLICY "Anyone can view published posts"
  ON public.blog_posts FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage blog posts" ON public.blog_posts;
CREATE POLICY "Admins manage blog posts"
  ON public.blog_posts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;

DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
