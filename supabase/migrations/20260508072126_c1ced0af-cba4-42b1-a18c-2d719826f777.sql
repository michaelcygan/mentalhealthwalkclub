-- Allow group members to see each other's completed public walks (with snapshot + stats)
-- so we can render group route mosaics. Original `walk_sessions_own` ALL policy stays in
-- place; this is an additional SELECT policy that ORs in.

CREATE POLICY "walk_sessions_select_group_public"
ON public.walk_sessions
FOR SELECT
TO authenticated
USING (
  status = 'completed'
  AND privacy = 'public'
  AND share_map = true
  AND group_id IS NOT NULL
  AND route_snapshot_path IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.group_memberships gm
    WHERE gm.group_id = walk_sessions.group_id
      AND gm.user_id = auth.uid()
      AND gm.status = 'active'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE b.blocker_user_id = auth.uid()
      AND b.blocked_user_id = walk_sessions.user_id
  )
);

-- Allow signed URL creation on shared snapshots: storage policy on walk-snapshots bucket
-- so group members can read other members' shared snapshot files.
CREATE POLICY "walk_snapshots_read_group_public"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'walk-snapshots'
  AND EXISTS (
    SELECT 1 FROM public.walk_sessions ws
    JOIN public.group_memberships gm ON gm.group_id = ws.group_id
    WHERE ws.route_snapshot_path = storage.objects.name
      AND ws.privacy = 'public'
      AND ws.share_map = true
      AND gm.user_id = auth.uid()
      AND gm.status = 'active'
  )
);

-- Owners can always read their own snapshot files (uploads already work via own policy elsewhere,
-- but be explicit for SELECT).
CREATE POLICY "walk_snapshots_read_own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'walk-snapshots'
  AND EXISTS (
    SELECT 1 FROM public.walk_sessions ws
    WHERE ws.route_snapshot_path = storage.objects.name
      AND ws.user_id = auth.uid()
  )
);

CREATE POLICY "walk_snapshots_insert_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'walk-snapshots'
);
