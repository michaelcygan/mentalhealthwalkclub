
-- Keep the row per title that has the most episodes
DELETE FROM public.podcast_feeds a
USING public.podcast_feeds b
WHERE a.title = b.title
  AND a.id <> b.id
  AND (
    (SELECT count(*) FROM public.podcast_episodes WHERE feed_id = a.id) <
    (SELECT count(*) FROM public.podcast_episodes WHERE feed_id = b.id)
    OR (
      (SELECT count(*) FROM public.podcast_episodes WHERE feed_id = a.id) =
      (SELECT count(*) FROM public.podcast_episodes WHERE feed_id = b.id)
      AND a.id < b.id
    )
  );

-- Drop the two that 404'd on the corrected URLs too
DELETE FROM public.podcast_feeds WHERE last_sync_error IS NOT NULL;

-- Activate everything that survived
UPDATE public.podcast_feeds SET is_active = true;
