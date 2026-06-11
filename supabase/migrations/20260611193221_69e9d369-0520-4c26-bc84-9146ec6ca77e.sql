
-- 1) Fix walk-snapshots double INSERT policy: drop the weaker one
DROP POLICY IF EXISTS "walk_snapshots_insert_own" ON storage.objects;

-- 2) Restrict event_photos SELECT to authenticated users only
DROP POLICY IF EXISTS "event_photos_public_select" ON public.event_photos;
CREATE POLICY "event_photos_authenticated_select"
  ON public.event_photos
  FOR SELECT
  TO authenticated
  USING (true);

-- 3) Split precise location into private user_locations table
CREATE TABLE IF NOT EXISTS public.user_locations (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lat double precision,
  lng double precision,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_locations TO authenticated;
GRANT ALL ON public.user_locations TO service_role;

ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_locations_owner_select" ON public.user_locations;
CREATE POLICY "user_locations_owner_select"
  ON public.user_locations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_locations_owner_insert" ON public.user_locations;
CREATE POLICY "user_locations_owner_insert"
  ON public.user_locations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_locations_owner_update" ON public.user_locations;
CREATE POLICY "user_locations_owner_update"
  ON public.user_locations FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_locations_owner_delete" ON public.user_locations;
CREATE POLICY "user_locations_owner_delete"
  ON public.user_locations FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Migrate existing data from profiles.lat/lng if columns exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'lat'
  ) THEN
    INSERT INTO public.user_locations (user_id, lat, lng)
    SELECT id, lat, lng FROM public.profiles
    WHERE lat IS NOT NULL OR lng IS NOT NULL
    ON CONFLICT (user_id) DO NOTHING;

    ALTER TABLE public.profiles DROP COLUMN IF EXISTS lat;
    ALTER TABLE public.profiles DROP COLUMN IF EXISTS lng;
  END IF;
END $$;

-- 4) Realtime baseline: require authentication for channel subscriptions
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "realtime_authenticated_only" ON realtime.messages;
CREATE POLICY "realtime_authenticated_only"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 5) Revoke anon execute on internal/mutating SECURITY DEFINER functions.
--    Keep RLS helpers (has_role, is_event_host, are_friends, etc.) callable
--    because policies depend on them.
REVOKE EXECUTE ON FUNCTION public.recompute_walker_metrics(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.evaluate_badges(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_rsvp_recompute() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_event_host_recompute() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_event_attendee_count() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_walk_session_completed() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM anon, authenticated;
