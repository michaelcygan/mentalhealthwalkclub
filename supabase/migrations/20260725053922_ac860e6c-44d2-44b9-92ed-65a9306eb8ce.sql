
DROP VIEW IF EXISTS public.public_groups;
CREATE VIEW public.public_groups
  WITH (security_invoker = true)
AS
SELECT
  id,
  slug,
  name,
  description,
  cover_image_url,
  neighborhood,
  scope,
  member_count,
  created_at
FROM public.groups
WHERE visibility = 'public' AND status = 'active';

GRANT SELECT ON public.public_groups TO anon, authenticated;

-- Existing SELECT policy on groups already exposes public+active rows to any role.
-- Grant the base-table SELECT so anon can read via the view.
GRANT SELECT ON public.groups TO anon;
