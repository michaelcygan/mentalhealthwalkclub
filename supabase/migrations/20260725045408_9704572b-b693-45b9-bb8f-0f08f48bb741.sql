-- Directional follows
CREATE TABLE public.follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX follows_followee_idx ON public.follows (followee_id, created_at DESC);
CREATE INDEX follows_follower_idx ON public.follows (follower_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follows_select_authenticated" ON public.follows
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "follows_insert_own" ON public.follows
  FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());
CREATE POLICY "follows_delete_own" ON public.follows
  FOR DELETE TO authenticated USING (follower_id = auth.uid());

-- Helpers
CREATE OR REPLACE FUNCTION public.is_following(_follower uuid, _followee uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.follows WHERE follower_id = _follower AND followee_id = _followee);
$$;

CREATE OR REPLACE FUNCTION public.is_mutual(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.follows WHERE follower_id = _a AND followee_id = _b)
     AND EXISTS (SELECT 1 FROM public.follows WHERE follower_id = _b AND followee_id = _a);
$$;

-- Public counts for profile pages (readable without exposing the graph itself).
CREATE OR REPLACE FUNCTION public.follow_counts(_user uuid)
RETURNS TABLE (followers int, following int, mutuals int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*)::int FROM public.follows WHERE followee_id = _user) AS followers,
    (SELECT count(*)::int FROM public.follows WHERE follower_id = _user) AS following,
    (SELECT count(*)::int FROM public.follows a
      WHERE a.follower_id = _user
        AND EXISTS (SELECT 1 FROM public.follows b WHERE b.follower_id = a.followee_id AND b.followee_id = _user)
    ) AS mutuals;
$$;

REVOKE ALL ON FUNCTION public.follow_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.follow_counts(uuid) TO anon, authenticated;

-- Add notification kinds
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'follow';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'mutual';