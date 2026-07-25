-- Narrow anon SELECT policy on events: only public, open-to-all, currently upcoming.
CREATE POLICY "events_select_anon_public"
  ON public.events
  FOR SELECT
  TO anon
  USING (
    status = 'published'
    AND visibility = 'public'
    AND audience_mode = 'public'
    AND starts_at >= (now() - interval '1 day')
  );

-- Display-safe projection for the public homepage grid.
CREATE OR REPLACE VIEW public.public_events
WITH (security_invoker = true) AS
SELECT
  id,
  slug,
  title,
  starts_at,
  timezone,
  venue_name,
  city,
  meeting_point AS neighborhood,
  lat,
  lng,
  attendee_count,
  image_url,
  cover_override_url,
  host_user_id,
  group_id,
  audience_mode,
  visibility
FROM public.events
WHERE status = 'published'
  AND visibility = 'public'
  AND audience_mode = 'public'
  AND starts_at >= (now() - interval '1 day');

GRANT SELECT ON public.public_events TO anon, authenticated;