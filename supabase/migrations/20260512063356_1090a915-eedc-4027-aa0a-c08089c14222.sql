
-- Seed curated podcast feeds (idempotent on rss_url uniqueness)
INSERT INTO public.podcast_feeds (rss_url, title, publisher, category, credibility, is_active)
VALUES
  ('https://feeds.simplecast.com/27nO_Y2v', 'Speaking of Psychology', 'American Psychological Association', 'think_clearly', 'institutional', true),
  ('https://feeds.npr.org/510338/podcast.xml', 'Life Kit', 'NPR', 'calm_down', 'public_media', true),
  ('https://feeds.feedburner.com/TEDTalks_health', 'TED Health', 'TED', 'body_brain', 'institutional', true),
  ('https://feeds.npr.org/510308/podcast.xml', 'Hidden Brain', 'Hidden Brain Media', 'think_clearly', 'public_media', true),
  ('https://feeds.simplecast.com/dC36O3W_', 'The Happiness Lab with Dr. Laurie Santos', 'Pushkin Industries', 'walk_with_hope', 'academic', true),
  ('https://feeds.megaphone.fm/tenpercent', 'Ten Percent Happier with Dan Harris', 'Ten Percent Happier', 'calm_down', 'lifestyle', true),
  ('https://feeds.megaphone.fm/hubermanlab', 'Huberman Lab', 'Scicomm Media', 'body_brain', 'science', true),
  ('https://onbeing.org/series/podcast/feed/', 'On Being with Krista Tippett', 'On Being Studios', 'feel_connected', 'public_media', true),
  ('https://feeds.megaphone.fm/the-goop-podcast', 'The goop Podcast', 'Goop, Inc. and Cadence13', 'relationships', 'lifestyle', true)
ON CONFLICT (rss_url) DO NOTHING;
