
-- 1) member_count column + backfill
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS member_count integer NOT NULL DEFAULT 0;

UPDATE public.groups g
SET member_count = COALESCE(sub.c, 0)
FROM (
  SELECT group_id, count(*)::int AS c
  FROM public.group_memberships
  WHERE status = 'active'
  GROUP BY group_id
) sub
WHERE g.id = sub.group_id;

-- 2) trigger to maintain member_count
CREATE OR REPLACE FUNCTION public.tg_group_member_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'active' THEN
      UPDATE public.groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'active' THEN
      UPDATE public.groups SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.group_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'active' AND NEW.status <> 'active' THEN
      UPDATE public.groups SET member_count = GREATEST(member_count - 1, 0) WHERE id = NEW.group_id;
    ELSIF OLD.status <> 'active' AND NEW.status = 'active' THEN
      UPDATE public.groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
    END IF;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS group_memberships_member_count ON public.group_memberships;
CREATE TRIGGER group_memberships_member_count
AFTER INSERT OR UPDATE OR DELETE ON public.group_memberships
FOR EACH ROW EXECUTE FUNCTION public.tg_group_member_count();

-- 3) case-insensitive slug uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS groups_slug_lower_key ON public.groups (lower(slug));

-- 4) has_group_role helper (owner > mod > member)
CREATE OR REPLACE FUNCTION public.has_group_role(_user uuid, _group uuid, _min_role text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH rank_map AS (
    SELECT * FROM (VALUES ('member', 1), ('mod', 2), ('owner', 3)) AS r(role_name, rank)
  ),
  effective AS (
    SELECT 3::int AS rank FROM public.groups WHERE id = _group AND owner_id = _user
    UNION ALL
    SELECT rm.rank
      FROM public.group_memberships gm
      JOIN rank_map rm ON rm.role_name = gm.role
      WHERE gm.group_id = _group AND gm.user_id = _user AND gm.status = 'active'
  )
  SELECT COALESCE(max(rank), 0) >= (SELECT rank FROM rank_map WHERE role_name = _min_role)
  FROM effective;
$$;

-- 5) allow mods to update the group (in addition to existing owner-updates)
DROP POLICY IF EXISTS "groups: mod updates" ON public.groups;
CREATE POLICY "groups: mod updates"
ON public.groups FOR UPDATE
TO authenticated
USING (public.has_group_role(auth.uid(), id, 'mod'))
WITH CHECK (public.has_group_role(auth.uid(), id, 'mod'));

-- 6) allow mods to add/remove members
DROP POLICY IF EXISTS "memberships: mod manages" ON public.group_memberships;
CREATE POLICY "memberships: mod manages"
ON public.group_memberships FOR ALL
TO authenticated
USING (public.has_group_role(auth.uid(), group_id, 'mod'))
WITH CHECK (public.has_group_role(auth.uid(), group_id, 'mod'));

-- 7) public_groups view (safe columns only) — security_invoker OFF (default) so
-- anon can read via the grant below without needing base-table access.
DROP VIEW IF EXISTS public.public_groups;
CREATE VIEW public.public_groups AS
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

-- 8) notification kinds
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'group_join';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'group_walk_posted';
