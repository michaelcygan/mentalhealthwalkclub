-- Wave 6: tighten RLS for launch
-- 1) Respect profiles.is_private in SELECT policy.
-- 2) Scope event_photos SELECT to the photo owner, event host, or public events.

DROP POLICY IF EXISTS profiles_select_all_authenticated ON public.profiles;
CREATE POLICY profiles_select_public_or_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR COALESCE(is_private, false) = false
  );

DROP POLICY IF EXISTS event_photos_authenticated_select ON public.event_photos;
CREATE POLICY event_photos_select_scoped
  ON public.event_photos
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_event_host(auth.uid(), event_id)
    OR EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_photos.event_id
        AND e.status = 'published'
        AND e.visibility = 'public'
        AND e.audience_mode = 'public'
    )
  );
