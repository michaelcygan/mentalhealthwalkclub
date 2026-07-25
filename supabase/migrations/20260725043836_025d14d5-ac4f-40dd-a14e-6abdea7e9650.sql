-- Public-safe projection of profiles. SECURITY INVOKER (default) so RLS on the
-- underlying profiles table still applies to the caller.
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT
  id,
  username,
  display_name,
  avatar_url,
  bio,
  location_label,
  is_host_account,
  walks_hosted,
  walks_attended,
  current_streak_weeks,
  created_at
FROM public.profiles
WHERE COALESCE(is_private, false) = false;

GRANT SELECT ON public.public_profiles TO anon, authenticated;