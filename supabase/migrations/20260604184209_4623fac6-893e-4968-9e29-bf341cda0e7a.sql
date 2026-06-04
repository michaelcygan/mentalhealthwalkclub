
-- =========================================================
-- CIRCLES
-- =========================================================
CREATE TABLE public.circles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, slug)
);
CREATE INDEX idx_circles_owner ON public.circles(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.circles TO authenticated;
GRANT ALL ON public.circles TO service_role;
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER circles_set_updated_at BEFORE UPDATE ON public.circles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- CIRCLE MEMBERS
-- =========================================================
CREATE TABLE public.circle_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','removed')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (circle_id, user_id)
);
CREATE INDEX idx_circle_members_user ON public.circle_members(user_id);
CREATE INDEX idx_circle_members_circle ON public.circle_members(circle_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_members TO authenticated;
GRANT ALL ON public.circle_members TO service_role;
ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- FRIENDSHIPS (mutual, sorted user pair)
-- =========================================================
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_low uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_high uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_low, user_high),
  CHECK (user_low < user_high)
);
CREATE INDEX idx_friendships_low ON public.friendships(user_low);
CREATE INDEX idx_friendships_high ON public.friendships(user_high);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER friendships_set_updated_at BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- EVENTS audience
-- =========================================================
ALTER TABLE public.events
  ADD COLUMN audience_mode text NOT NULL DEFAULT 'public'
  CHECK (audience_mode IN ('public','friends','circles_allowlist','friends_except_blocklist','group'));

CREATE TABLE public.event_circle_allowlist (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, circle_id)
);
GRANT SELECT, INSERT, DELETE ON public.event_circle_allowlist TO authenticated;
GRANT ALL ON public.event_circle_allowlist TO service_role;
ALTER TABLE public.event_circle_allowlist ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.event_blocklist (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.event_blocklist TO authenticated;
GRANT ALL ON public.event_blocklist TO service_role;
ALTER TABLE public.event_blocklist ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- Security-definer helpers
-- =========================================================
CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND user_low = LEAST(_a, _b)
      AND user_high = GREATEST(_a, _b)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_circle_member(_user uuid, _circle uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circle_members
    WHERE circle_id = _circle AND user_id = _user AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_in_event_allowlist(_user uuid, _event uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_circle_allowlist a
    JOIN public.circle_members m ON m.circle_id = a.circle_id
    WHERE a.event_id = _event
      AND m.user_id = _user
      AND m.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_in_event_blocklist(_user uuid, _event uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.event_blocklist WHERE event_id = _event AND user_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.is_circle_owner(_user uuid, _circle uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.circles WHERE id = _circle AND owner_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.is_event_host(_user uuid, _event uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.events WHERE id = _event AND host_user_id = _user);
$$;

-- =========================================================
-- POLICIES — circles
-- =========================================================
CREATE POLICY "circles_select_owner_or_member" ON public.circles
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_circle_member(auth.uid(), id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );
CREATE POLICY "circles_insert_owner" ON public.circles
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "circles_update_owner" ON public.circles
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "circles_delete_owner" ON public.circles
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- =========================================================
-- POLICIES — circle_members
-- =========================================================
CREATE POLICY "circle_members_select" ON public.circle_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_circle_owner(auth.uid(), circle_id)
    OR public.is_circle_member(auth.uid(), circle_id)
  );
CREATE POLICY "circle_members_insert_owner" ON public.circle_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_circle_owner(auth.uid(), circle_id));
CREATE POLICY "circle_members_update_owner" ON public.circle_members
  FOR UPDATE TO authenticated
  USING (public.is_circle_owner(auth.uid(), circle_id) OR user_id = auth.uid())
  WITH CHECK (public.is_circle_owner(auth.uid(), circle_id) OR user_id = auth.uid());
CREATE POLICY "circle_members_delete_owner" ON public.circle_members
  FOR DELETE TO authenticated
  USING (public.is_circle_owner(auth.uid(), circle_id) OR user_id = auth.uid());

-- =========================================================
-- POLICIES — friendships
-- =========================================================
CREATE POLICY "friendships_select_either" ON public.friendships
  FOR SELECT TO authenticated
  USING (user_low = auth.uid() OR user_high = auth.uid());
CREATE POLICY "friendships_insert_self_request" ON public.friendships
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND (user_low = auth.uid() OR user_high = auth.uid()));
CREATE POLICY "friendships_update_either" ON public.friendships
  FOR UPDATE TO authenticated
  USING (user_low = auth.uid() OR user_high = auth.uid())
  WITH CHECK (user_low = auth.uid() OR user_high = auth.uid());
CREATE POLICY "friendships_delete_either" ON public.friendships
  FOR DELETE TO authenticated
  USING (user_low = auth.uid() OR user_high = auth.uid());

-- =========================================================
-- POLICIES — event allowlist / blocklist
-- =========================================================
CREATE POLICY "event_allowlist_select_host_or_member" ON public.event_circle_allowlist
  FOR SELECT TO authenticated
  USING (
    public.is_event_host(auth.uid(), event_id)
    OR public.is_circle_member(auth.uid(), circle_id)
  );
CREATE POLICY "event_allowlist_insert_host" ON public.event_circle_allowlist
  FOR INSERT TO authenticated
  WITH CHECK (public.is_event_host(auth.uid(), event_id));
CREATE POLICY "event_allowlist_delete_host" ON public.event_circle_allowlist
  FOR DELETE TO authenticated
  USING (public.is_event_host(auth.uid(), event_id));

CREATE POLICY "event_blocklist_select_host" ON public.event_blocklist
  FOR SELECT TO authenticated
  USING (public.is_event_host(auth.uid(), event_id));
CREATE POLICY "event_blocklist_insert_host" ON public.event_blocklist
  FOR INSERT TO authenticated
  WITH CHECK (public.is_event_host(auth.uid(), event_id));
CREATE POLICY "event_blocklist_delete_host" ON public.event_blocklist
  FOR DELETE TO authenticated
  USING (public.is_event_host(auth.uid(), event_id));

-- =========================================================
-- Update events SELECT policy to filter by audience
-- =========================================================
DROP POLICY IF EXISTS "events_select_public" ON public.events;
CREATE POLICY "events_select_public" ON public.events
  FOR SELECT
  USING (
    host_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      visibility = 'public'
      AND (
        audience_mode = 'public'
        OR (audience_mode = 'friends' AND public.are_friends(auth.uid(), host_user_id))
        OR (audience_mode = 'circles_allowlist' AND public.user_in_event_allowlist(auth.uid(), id))
        OR (
          audience_mode = 'friends_except_blocklist'
          AND public.are_friends(auth.uid(), host_user_id)
          AND NOT public.user_in_event_blocklist(auth.uid(), id)
        )
      )
    )
  );
