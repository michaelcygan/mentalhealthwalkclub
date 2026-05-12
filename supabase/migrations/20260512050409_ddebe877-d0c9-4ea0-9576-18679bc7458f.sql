
-- Podcast feeds
CREATE TABLE public.podcast_feeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rss_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  publisher TEXT,
  description TEXT,
  image_url TEXT,
  category TEXT NOT NULL CHECK (category IN ('calm_down','think_clearly','feel_connected','walk_with_hope','body_brain','relationships')),
  credibility TEXT NOT NULL DEFAULT 'lifestyle' CHECK (credibility IN ('institutional','academic','public_media','science','lifestyle')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  last_synced_at TIMESTAMPTZ,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.podcast_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY podcast_feeds_select_active_or_admin ON public.podcast_feeds
  FOR SELECT TO authenticated
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY podcast_feeds_admin_manage ON public.podcast_feeds
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER podcast_feeds_set_updated_at
  BEFORE UPDATE ON public.podcast_feeds
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Podcast episodes
CREATE TABLE public.podcast_episodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feed_id UUID NOT NULL REFERENCES public.podcast_feeds(id) ON DELETE CASCADE,
  guid TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  audio_url TEXT NOT NULL,
  episode_url TEXT,
  image_url TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  mood_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  walk_fit_score INTEGER NOT NULL DEFAULT 3 CHECK (walk_fit_score BETWEEN 1 AND 5),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (feed_id, guid)
);

CREATE INDEX podcast_episodes_feed_pub_idx ON public.podcast_episodes (feed_id, published_at DESC);
CREATE INDEX podcast_episodes_active_score_idx ON public.podcast_episodes (is_active, walk_fit_score DESC, published_at DESC);

ALTER TABLE public.podcast_episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY podcast_episodes_select_active ON public.podcast_episodes
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      is_active = true AND EXISTS (
        SELECT 1 FROM public.podcast_feeds f
        WHERE f.id = podcast_episodes.feed_id AND f.is_active = true
      )
    )
  );

CREATE POLICY podcast_episodes_admin_manage ON public.podcast_episodes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY podcast_episodes_service_all ON public.podcast_episodes
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER podcast_episodes_set_updated_at
  BEFORE UPDATE ON public.podcast_episodes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Walk sessions: track podcast episode separately
ALTER TABLE public.walk_sessions ADD COLUMN podcast_episode_id UUID REFERENCES public.podcast_episodes(id) ON DELETE SET NULL;

-- Seed reputable feeds (inactive drafts)
INSERT INTO public.podcast_feeds (rss_url, title, publisher, category, credibility, is_active) VALUES
  ('https://feeds.megaphone.fm/AMERICANPSYCHOLOGICALASSOCIATION9933181801', 'Speaking of Psychology', 'American Psychological Association', 'think_clearly', 'institutional', false),
  ('https://feeds.npr.org/510338/podcast.xml', 'NPR Life Kit', 'NPR', 'think_clearly', 'public_media', false),
  ('https://feeds.npr.org/510340/podcast.xml', 'NPR Life Kit: Health', 'NPR', 'body_brain', 'public_media', false),
  ('https://feeds.feedburner.com/iTunesPodcastTTHealth', 'TED Health', 'TED', 'body_brain', 'academic', false),
  ('https://feeds.simplecast.com/kwWc0lhf', 'Hidden Brain', 'Hidden Brain Media', 'think_clearly', 'public_media', false),
  ('https://feeds.megaphone.fm/happinesslab', 'The Happiness Lab', 'Pushkin Industries', 'walk_with_hope', 'academic', false),
  ('https://feeds.libsyn.com/570160/rss', '10% Happier with Dan Harris', 'Ten Percent Happier', 'calm_down', 'lifestyle', false),
  ('https://feeds.megaphone.fm/hubermanlab', 'Huberman Lab', 'Scicomm Media', 'body_brain', 'science', false),
  ('https://feeds.simplecast.com/AuAxH_Bf', 'On Being with Krista Tippett', 'On Being Studios', 'feel_connected', 'public_media', false),
  ('https://feeds.megaphone.fm/goop-podcast', 'The goop Podcast', 'goop', 'relationships', 'lifestyle', false);
