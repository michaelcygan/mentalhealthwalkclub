-- =========================================
-- 1. Scope follows SELECT to the requesting user or their own relationships
-- =========================================
DROP POLICY IF EXISTS "follows_select_authenticated" ON public.follows;

CREATE POLICY "Users read their own follows"
  ON public.follows FOR SELECT
  TO authenticated
  USING (follower_id = auth.uid() OR followee_id = auth.uid());

-- Public profile counts continue to work via the security-definer follow_counts() function.

-- =========================================
-- 2. Scope realtime topics to legitimate channels
-- =========================================
DROP POLICY IF EXISTS "realtime_authenticated_only" ON realtime.messages;

-- Allow users to read/insert only on topics they have a right to:
--   notifications:<their-user-id>:%
--   subscriptions:<their-user-id>:%
--   membership:<their-user-id>:%
--   event-rsvps:%:%           (public event data)
--   event-broadcasts:%:%        (public event data)
CREATE POLICY "realtime_scoped_topics"
  ON realtime.messages
  FOR ALL
  TO authenticated
  USING (
    realtime.topic() LIKE 'notifications:' || (auth.uid())::text || ':%'
    OR realtime.topic() LIKE 'subscriptions:' || (auth.uid())::text || ':%'
    OR realtime.topic() LIKE 'membership:' || (auth.uid())::text || ':%'
    OR realtime.topic() LIKE 'event-rsvps:%'
    OR realtime.topic() LIKE 'event-broadcasts:%'
  )
  WITH CHECK (
    realtime.topic() LIKE 'notifications:' || (auth.uid())::text || ':%'
    OR realtime.topic() LIKE 'subscriptions:' || (auth.uid())::text || ':%'
    OR realtime.topic() LIKE 'membership:' || (auth.uid())::text || ':%'
    OR realtime.topic() LIKE 'event-rsvps:%'
    OR realtime.topic() LIKE 'event-broadcasts:%'
  );

-- =========================================
-- 3. Lock down SECURITY DEFINER function execution
-- =========================================
-- Revoke public/anon execute on all public SECURITY DEFINER helpers.
-- Grant execute only to the functions the app calls directly via RPC.
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM public, anon;', fn.proname, fn.args);
  END LOOP;
END $$;

-- Re-grant execute to authenticated for the functions the client calls directly.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.follow_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;

-- Functions used only in policies/triggers remain executable by the table owner
-- (postgres/supabase_admin) automatically; no extra grant needed.
