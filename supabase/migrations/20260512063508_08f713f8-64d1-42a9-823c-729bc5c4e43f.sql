
-- Remove feeds that failed initial fetch (bad URLs from research)
DELETE FROM public.podcast_feeds WHERE last_sync_error IS NOT NULL;

-- Remove duplicates: keep the most-recently-synced row per title
DELETE FROM public.podcast_feeds a
USING public.podcast_feeds b
WHERE a.title = b.title
  AND a.id <> b.id
  AND COALESCE(a.last_synced_at, 'epoch'::timestamptz) < COALESCE(b.last_synced_at, 'epoch'::timestamptz);

-- Add corrected URLs for the publishers we still want (idempotent)
INSERT INTO public.podcast_feeds (rss_url, title, publisher, category, credibility, is_active)
VALUES
  ('https://feeds.simplecast.com/iZGAydxw', 'On Being with Krista Tippett', 'On Being Studios', 'feel_connected', 'public_media', true),
  ('https://feeds.megaphone.fm/thehappinesslab', 'The Happiness Lab with Dr. Laurie Santos', 'Pushkin Industries', 'walk_with_hope', 'academic', true)
ON CONFLICT (rss_url) DO NOTHING;
