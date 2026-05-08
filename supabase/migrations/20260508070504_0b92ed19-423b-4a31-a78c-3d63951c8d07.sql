
ALTER TABLE public.walk_sessions
  ADD COLUMN IF NOT EXISTS share_map boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS route_snapshot_path text;

CREATE TABLE IF NOT EXISTS public.walk_live_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  walk_session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  group_id uuid,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  heading numeric,
  pinged_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS walk_live_pings_group_recent
  ON public.walk_live_pings (group_id, pinged_at DESC);
CREATE INDEX IF NOT EXISTS walk_live_pings_session
  ON public.walk_live_pings (walk_session_id, pinged_at DESC);

ALTER TABLE public.walk_live_pings ENABLE ROW LEVEL SECURITY;

CREATE POLICY walk_live_pings_insert_self
  ON public.walk_live_pings FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.walk_sessions ws
      WHERE ws.id = walk_session_id
        AND ws.user_id = auth.uid()
        AND ws.status = 'active'
        AND ws.share_map = true
        AND ws.privacy = 'public'
    )
  );

CREATE POLICY walk_live_pings_select_group
  ON public.walk_live_pings FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      EXISTS (
        SELECT 1 FROM public.walk_sessions ws
        WHERE ws.id = walk_session_id
          AND ws.status = 'active'
          AND ws.share_map = true
          AND ws.privacy = 'public'
      )
      AND group_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.group_memberships gm
        WHERE gm.group_id = walk_live_pings.group_id
          AND gm.user_id = auth.uid()
          AND gm.status = 'active'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE b.blocker_user_id = auth.uid()
          AND b.blocked_user_id = walk_live_pings.user_id
      )
    )
  );

CREATE POLICY walk_live_pings_delete_self
  ON public.walk_live_pings FOR DELETE TO authenticated
  USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.walk_live_pings;
ALTER TABLE public.walk_live_pings REPLICA IDENTITY FULL;

INSERT INTO storage.buckets (id, name, public)
VALUES ('walk-snapshots', 'walk-snapshots', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "walk_snapshots_own_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'walk-snapshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "walk_snapshots_own_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'walk-snapshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "walk_snapshots_own_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'walk-snapshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "walk_snapshots_own_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'walk-snapshots' AND auth.uid()::text = (storage.foldername(name))[1]);
