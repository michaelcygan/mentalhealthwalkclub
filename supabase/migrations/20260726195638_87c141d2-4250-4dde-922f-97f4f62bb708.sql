
-- =========================================================================
-- WAVE 1 + 4 + 5 + 7 + 8: Age gate, safety realm, adult enforcement, migration
-- =========================================================================

-- ---------- account_safety ----------
CREATE TABLE public.account_safety (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  safety_realm text NOT NULL DEFAULT 'unknown'
    CHECK (safety_realm IN ('unknown','adult','future_youth','blocked')),
  eligibility_status text NOT NULL DEFAULT 'pending_age'
    CHECK (eligibility_status IN ('pending_age','adult_active','underage_blocked','age_review','safety_suspended')),
  age_method text NOT NULL DEFAULT 'self_attested'
    CHECK (age_method IN ('self_attested','admin_corrected','migrated')),
  age_attested_at timestamptz,
  terms_version text,
  privacy_version text,
  suspended_reason text,
  suspended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.account_safety TO authenticated;
GRANT ALL ON public.account_safety TO service_role;

ALTER TABLE public.account_safety ENABLE ROW LEVEL SECURITY;

CREATE POLICY "safety self read" ON public.account_safety
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "safety admin read" ON public.account_safety
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER account_safety_updated_at BEFORE UPDATE ON public.account_safety
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- account_safety_audit ----------
CREATE TABLE public.account_safety_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_status text,
  new_status text,
  previous_realm text,
  new_realm text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.account_safety_audit TO authenticated;
GRANT ALL ON public.account_safety_audit TO service_role;

ALTER TABLE public.account_safety_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "safety audit admin read" ON public.account_safety_audit
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ---------- helpers ----------
CREATE OR REPLACE FUNCTION public.is_adult_dob(_dob date)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _dob IS NOT NULL
     AND _dob <= (current_date - interval '18 years')::date
     AND _dob >= (current_date - interval '120 years')::date;
$$;

CREATE OR REPLACE FUNCTION public.is_adult_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_safety
    WHERE user_id = _user_id
      AND eligibility_status = 'adult_active'
      AND safety_realm = 'adult'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_account_eligibility()
RETURNS TABLE(eligibility_status text, safety_realm text, age_band text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(s.eligibility_status, 'pending_age'),
    COALESCE(s.safety_realm, 'unknown'),
    p.age_band
  FROM public.profiles p
  LEFT JOIN public.account_safety s ON s.user_id = p.id
  WHERE p.id = auth.uid();
$$;

-- ---------- confirm_my_date_of_birth ----------
CREATE OR REPLACE FUNCTION public.confirm_my_date_of_birth(
  _dob date,
  _terms_version text DEFAULT 'v2026-07-26-18plus',
  _privacy_version text DEFAULT 'v2026-07-26-18plus'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  existing_dob date;
  new_band text;
  new_status text;
  new_realm text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  IF _dob IS NULL OR _dob > current_date OR _dob < (current_date - interval '120 years')::date THEN
    RAISE EXCEPTION 'invalid date of birth' USING ERRCODE = '22023';
  END IF;

  SELECT dob INTO existing_dob FROM public.user_dob WHERE user_id = uid;
  IF existing_dob IS NOT NULL AND existing_dob <> _dob THEN
    -- Second user-initiated change is refused.
    RAISE EXCEPTION 'date of birth already confirmed' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_dob (user_id, dob)
  VALUES (uid, _dob)
  ON CONFLICT (user_id) DO UPDATE SET dob = EXCLUDED.dob, updated_at = now();

  new_band := public.age_band_for(_dob);

  IF public.is_adult_dob(_dob) THEN
    new_status := 'adult_active';
    new_realm := 'adult';
  ELSE
    new_status := 'underage_blocked';
    new_realm := 'blocked';
  END IF;

  INSERT INTO public.account_safety (
    user_id, safety_realm, eligibility_status, age_method,
    age_attested_at, terms_version, privacy_version
  ) VALUES (
    uid, new_realm, new_status, 'self_attested',
    now(), _terms_version, _privacy_version
  )
  ON CONFLICT (user_id) DO UPDATE SET
    safety_realm = EXCLUDED.safety_realm,
    eligibility_status = EXCLUDED.eligibility_status,
    age_method = 'self_attested',
    age_attested_at = now(),
    terms_version = EXCLUDED.terms_version,
    privacy_version = EXCLUDED.privacy_version,
    updated_at = now();

  UPDATE public.profiles SET age_band = new_band WHERE id = uid;

  RETURN jsonb_build_object(
    'eligibilityStatus', new_status,
    'safetyRealm', new_realm,
    'ageBand', new_band
  );
END;
$$;

-- Keep set_my_dob working as a compatibility shim, but route through the new function.
CREATE OR REPLACE FUNCTION public.set_my_dob(_dob date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  result := public.confirm_my_date_of_birth(_dob);
  IF result->>'eligibilityStatus' = 'underage_blocked' THEN
    RAISE EXCEPTION 'must be 18 or older';
  END IF;
  RETURN (result->>'ageBand');
END;
$$;

-- ---------- admin correction ----------
CREATE OR REPLACE FUNCTION public.admin_correct_user_dob(
  _user_id uuid,
  _dob date,
  _reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  prev_status text;
  prev_realm text;
  new_band text;
  new_status text;
  new_realm text;
BEGIN
  IF actor IS NULL OR NOT public.has_role(actor, 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF _dob IS NULL OR _dob > current_date OR _dob < (current_date - interval '120 years')::date THEN
    RAISE EXCEPTION 'invalid date of birth';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN
    RAISE EXCEPTION 'reason required';
  END IF;

  SELECT eligibility_status, safety_realm INTO prev_status, prev_realm
    FROM public.account_safety WHERE user_id = _user_id;

  INSERT INTO public.user_dob (user_id, dob) VALUES (_user_id, _dob)
    ON CONFLICT (user_id) DO UPDATE SET dob = EXCLUDED.dob, updated_at = now();

  new_band := public.age_band_for(_dob);
  IF public.is_adult_dob(_dob) THEN
    new_status := 'adult_active'; new_realm := 'adult';
  ELSE
    new_status := 'underage_blocked'; new_realm := 'blocked';
  END IF;

  INSERT INTO public.account_safety (user_id, safety_realm, eligibility_status, age_method, age_attested_at)
  VALUES (_user_id, new_realm, new_status, 'admin_corrected', now())
  ON CONFLICT (user_id) DO UPDATE SET
    safety_realm = EXCLUDED.safety_realm,
    eligibility_status = EXCLUDED.eligibility_status,
    age_method = 'admin_corrected',
    age_attested_at = now(),
    updated_at = now();

  UPDATE public.profiles SET age_band = new_band WHERE id = _user_id;

  INSERT INTO public.account_safety_audit (
    user_id, changed_by, previous_status, new_status, previous_realm, new_realm, reason
  ) VALUES (_user_id, actor, prev_status, new_status, prev_realm, new_realm, _reason);

  RETURN jsonb_build_object(
    'eligibilityStatus', new_status,
    'safetyRealm', new_realm,
    'ageBand', new_band
  );
END;
$$;

-- ---------- admin set eligibility (age_review / restore / suspend) ----------
CREATE OR REPLACE FUNCTION public.admin_set_account_eligibility(
  _user_id uuid,
  _status text,
  _reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  prev_status text;
  prev_realm text;
  new_realm text;
BEGIN
  IF actor IS NULL OR NOT public.has_role(actor, 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF _status NOT IN ('pending_age','adult_active','underage_blocked','age_review','safety_suspended') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  SELECT eligibility_status, safety_realm INTO prev_status, prev_realm
    FROM public.account_safety WHERE user_id = _user_id;

  new_realm := CASE _status
    WHEN 'adult_active' THEN 'adult'
    WHEN 'underage_blocked' THEN 'blocked'
    WHEN 'safety_suspended' THEN 'blocked'
    WHEN 'age_review' THEN 'unknown'
    ELSE 'unknown'
  END;

  INSERT INTO public.account_safety (user_id, safety_realm, eligibility_status, age_method)
  VALUES (_user_id, new_realm, _status, 'admin_corrected')
  ON CONFLICT (user_id) DO UPDATE SET
    safety_realm = EXCLUDED.safety_realm,
    eligibility_status = EXCLUDED.eligibility_status,
    suspended_reason = CASE WHEN _status IN ('safety_suspended','age_review') THEN _reason ELSE NULL END,
    suspended_at = CASE WHEN _status IN ('safety_suspended','age_review') THEN now() ELSE NULL END,
    updated_at = now();

  INSERT INTO public.account_safety_audit (
    user_id, changed_by, previous_status, new_status, previous_realm, new_realm, reason
  ) VALUES (_user_id, actor, prev_status, _status, prev_realm, new_realm, _reason);
END;
$$;

-- ---------- age_realm columns ----------
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS age_realm text NOT NULL DEFAULT 'adult'
  CHECK (age_realm IN ('adult','future_youth'));
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS age_realm text NOT NULL DEFAULT 'adult'
  CHECK (age_realm IN ('adult','future_youth'));
ALTER TABLE public.circles ADD COLUMN IF NOT EXISTS age_realm text NOT NULL DEFAULT 'adult'
  CHECK (age_realm IN ('adult','future_youth'));

-- ---------- enforcement triggers ----------

-- RSVPs: participant + event must both be adult-active/adult-realm
CREATE OR REPLACE FUNCTION public.tg_rsvp_adult_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev_realm text;
BEGIN
  IF NOT public.is_adult_active(NEW.user_id) THEN
    RAISE EXCEPTION 'account not eligible' USING ERRCODE = '42501';
  END IF;
  SELECT age_realm INTO ev_realm FROM public.events WHERE id = NEW.event_id;
  IF ev_realm IS DISTINCT FROM 'adult' THEN
    RAISE EXCEPTION 'event not eligible' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rsvp_adult_gate ON public.event_rsvps;
CREATE TRIGGER rsvp_adult_gate
  BEFORE INSERT OR UPDATE ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.tg_rsvp_adult_gate();

-- Guest RSVPs: event must be adult realm
CREATE OR REPLACE FUNCTION public.tg_guest_rsvp_adult_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev_realm text;
BEGIN
  SELECT age_realm INTO ev_realm FROM public.events WHERE id = NEW.event_id;
  IF ev_realm IS DISTINCT FROM 'adult' THEN
    RAISE EXCEPTION 'event not eligible' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guest_rsvp_adult_gate ON public.event_rsvp_guests;
CREATE TRIGGER guest_rsvp_adult_gate
  BEFORE INSERT OR UPDATE ON public.event_rsvp_guests
  FOR EACH ROW EXECUTE FUNCTION public.tg_guest_rsvp_adult_gate();

-- Follows: both sides adult-active
CREATE OR REPLACE FUNCTION public.tg_follows_adult_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_adult_active(NEW.follower_id) OR NOT public.is_adult_active(NEW.followee_id) THEN
    RAISE EXCEPTION 'follow not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS follows_adult_gate ON public.follows;
CREATE TRIGGER follows_adult_gate
  BEFORE INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.tg_follows_adult_gate();

-- Event creation/publication: host must be adult-active when status = 'published'
CREATE OR REPLACE FUNCTION public.tg_events_adult_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Force adult realm; clients cannot pick another value.
  NEW.age_realm := 'adult';
  IF NEW.status = 'published' AND NEW.host_user_id IS NOT NULL AND NOT public.is_adult_active(NEW.host_user_id) THEN
    RAISE EXCEPTION 'host not eligible to publish' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_adult_gate ON public.events;
CREATE TRIGGER events_adult_gate
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.tg_events_adult_gate();

-- ---------- public views (recreated with adult filter) ----------
DROP VIEW IF EXISTS public.public_events;
CREATE VIEW public.public_events
WITH (security_invoker = true)
AS
SELECT
  e.id, e.slug, e.title, e.starts_at, e.timezone,
  e.venue_name, e.city, e.meeting_point AS neighborhood,
  e.lat, e.lng, e.attendee_count, e.image_url, e.cover_override_url,
  e.host_user_id, e.group_id, e.audience_mode, e.visibility
FROM public.events e
JOIN public.account_safety s ON s.user_id = e.host_user_id
WHERE e.status = 'published'
  AND e.visibility = 'public'
  AND e.audience_mode = 'public'
  AND e.starts_at >= (now() - interval '1 day')
  AND e.age_realm = 'adult'
  AND s.eligibility_status = 'adult_active'
  AND s.safety_realm = 'adult';

GRANT SELECT ON public.public_events TO anon, authenticated;

DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = true)
AS
SELECT
  p.id, p.username, p.display_name, p.avatar_url, p.bio,
  p.location_label, p.is_host_account,
  p.walks_hosted, p.walks_attended, p.current_streak_weeks, p.created_at
FROM public.profiles p
JOIN public.account_safety s ON s.user_id = p.id
WHERE COALESCE(p.is_private, false) = false
  AND s.eligibility_status = 'adult_active'
  AND s.safety_realm = 'adult';

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ---------- WAVE 8: existing-user migration ----------

-- Seed account_safety for every existing profile using user_dob when present.
INSERT INTO public.account_safety (user_id, safety_realm, eligibility_status, age_method, age_attested_at)
SELECT
  p.id,
  CASE
    WHEN d.dob IS NULL THEN 'unknown'
    WHEN public.is_adult_dob(d.dob) THEN 'adult'
    ELSE 'blocked'
  END,
  CASE
    WHEN d.dob IS NULL THEN 'pending_age'
    WHEN public.is_adult_dob(d.dob) THEN 'adult_active'
    ELSE 'underage_blocked'
  END,
  CASE WHEN d.dob IS NULL THEN 'migrated' ELSE 'migrated' END,
  CASE WHEN d.dob IS NULL THEN NULL ELSE now() END
FROM public.profiles p
LEFT JOIN public.user_dob d ON d.user_id = p.id
ON CONFLICT (user_id) DO NOTHING;

-- Unpublish any published events whose host is not adult-active.
UPDATE public.events
SET status = 'draft'
WHERE status = 'published'
  AND (host_user_id IS NULL OR NOT public.is_adult_active(host_user_id));

-- Force adult realm on existing rows (safety net; column default is already adult).
UPDATE public.events SET age_realm = 'adult' WHERE age_realm IS NULL OR age_realm <> 'adult';
UPDATE public.groups SET age_realm = 'adult' WHERE age_realm IS NULL OR age_realm <> 'adult';
UPDATE public.circles SET age_realm = 'adult' WHERE age_realm IS NULL OR age_realm <> 'adult';
