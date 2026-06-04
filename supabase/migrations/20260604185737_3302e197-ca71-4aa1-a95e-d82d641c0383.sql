-- Profiles: queryable age band only
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age_band text
    CHECK (age_band IN ('18+', '21+', '25+', '40+', '65+'));

-- Private DOB store
CREATE TABLE IF NOT EXISTS public.user_dob (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dob date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_dob TO authenticated;
GRANT ALL ON public.user_dob TO service_role;
ALTER TABLE public.user_dob ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dob self read" ON public.user_dob FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "dob self write" ON public.user_dob FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "dob self update" ON public.user_dob FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "dob self delete" ON public.user_dob FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER user_dob_updated_at BEFORE UPDATE ON public.user_dob
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Age helpers
CREATE OR REPLACE FUNCTION public.age_band_for(_dob date)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _dob IS NULL THEN NULL
    WHEN (date_part('year', age(_dob)))::int >= 65 THEN '65+'
    WHEN (date_part('year', age(_dob)))::int >= 40 THEN '40+'
    WHEN (date_part('year', age(_dob)))::int >= 25 THEN '25+'
    WHEN (date_part('year', age(_dob)))::int >= 21 THEN '21+'
    WHEN (date_part('year', age(_dob)))::int >= 18 THEN '18+'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.age_band_meets(_user_band text, _min_band text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _user_band
    WHEN '65+' THEN 5 WHEN '40+' THEN 4 WHEN '25+' THEN 3 WHEN '21+' THEN 2 WHEN '18+' THEN 1 ELSE 0
  END >= CASE _min_band
    WHEN '65+' THEN 5 WHEN '40+' THEN 4 WHEN '25+' THEN 3 WHEN '21+' THEN 2 WHEN '18+' THEN 1 ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.set_my_dob(_dob date)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE band text; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  band := public.age_band_for(_dob);
  IF band IS NULL THEN RAISE EXCEPTION 'must be 18 or older'; END IF;
  INSERT INTO public.user_dob (user_id, dob) VALUES (uid, _dob)
    ON CONFLICT (user_id) DO UPDATE SET dob = EXCLUDED.dob, updated_at = now();
  UPDATE public.profiles SET age_band = band WHERE id = uid;
  RETURN band;
END; $$;

-- Groups
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{1,80}$'),
  description text CHECK (description IS NULL OR char_length(description) <= 600),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','private')),
  scope text NOT NULL DEFAULT 'local' CHECK (scope IN ('local','global')),
  age_band_min text NOT NULL DEFAULT '18+' CHECK (age_band_min IN ('18+','21+','25+','40+','65+')),
  radius_miles integer CHECK (radius_miles IS NULL OR radius_miles BETWEEN 1 AND 100),
  lat numeric,
  lng numeric,
  neighborhood text CHECK (neighborhood IS NULL OR char_length(neighborhood) <= 120),
  cover_image_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','pending_review','active','quarantined','hidden')),
  trust_locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
CREATE INDEX IF NOT EXISTS groups_owner_idx ON public.groups(owner_id);
CREATE INDEX IF NOT EXISTS groups_status_visibility_idx ON public.groups(visibility, status);
CREATE TRIGGER groups_updated_at BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Memberships
CREATE TABLE IF NOT EXISTS public.group_memberships (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','banned')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_memberships TO authenticated;
GRANT ALL ON public.group_memberships TO service_role;
CREATE INDEX IF NOT EXISTS group_memberships_user_idx ON public.group_memberships(user_id, status);
ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;

-- Helpers (defined before policies that reference them)
CREATE OR REPLACE FUNCTION public.is_group_member(_user uuid, _group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_memberships
    WHERE group_id = _group AND user_id = _user AND status = 'active');
$$;

CREATE OR REPLACE FUNCTION public.is_group_owner(_user uuid, _group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.groups WHERE id = _group AND owner_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.host_trust_ok(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = _user AND u.email_confirmed_at IS NOT NULL)
    AND (SELECT created_at FROM auth.users WHERE id = _user) < now() - interval '14 days'
    AND (SELECT count(*) FROM public.walk_sessions WHERE user_id = _user AND status = 'completed') >= 3
    AND NOT EXISTS (SELECT 1 FROM public.safety_reports WHERE reported_user_id = _user AND status = 'open');
$$;

-- groups RLS
CREATE POLICY "groups: public active visible" ON public.groups
  FOR SELECT TO authenticated
  USING (
    (visibility = 'public' AND status = 'active')
    OR owner_id = auth.uid()
    OR public.is_group_member(auth.uid(), id)
  );
CREATE POLICY "groups: owner inserts" ON public.groups
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "groups: owner updates" ON public.groups
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "groups: owner deletes" ON public.groups
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- memberships RLS
CREATE POLICY "memberships: visible to members" ON public.group_memberships
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_group_member(auth.uid(), group_id)
    OR public.is_group_owner(auth.uid(), group_id)
  );
CREATE POLICY "memberships: self join public active" ON public.group_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'member'
    AND status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id AND g.visibility = 'public' AND g.status = 'active'
    )
  );
CREATE POLICY "memberships: owner adds anyone" ON public.group_memberships
  FOR INSERT TO authenticated
  WITH CHECK (public.is_group_owner(auth.uid(), group_id));
CREATE POLICY "memberships: self leave" ON public.group_memberships
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_group_owner(auth.uid(), group_id));
CREATE POLICY "memberships: owner updates" ON public.group_memberships
  FOR UPDATE TO authenticated
  USING (public.is_group_owner(auth.uid(), group_id))
  WITH CHECK (public.is_group_owner(auth.uid(), group_id));