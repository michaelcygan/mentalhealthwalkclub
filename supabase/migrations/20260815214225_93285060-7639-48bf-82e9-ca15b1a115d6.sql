-- ============================================================
-- Public walk utility: portals + safe geographic board query
-- Additive only.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.portal_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  place_id uuid REFERENCES public.places(id) ON DELETE SET NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  radius_miles double precision NOT NULL DEFAULT 5,
  city text,
  region text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.portal_locations TO anon, authenticated;
GRANT ALL ON public.portal_locations TO service_role;

ALTER TABLE public.portal_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portals public read active" ON public.portal_locations
  FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "portals admin read" ON public.portal_locations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "portals admin write" ON public.portal_locations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER portal_locations_updated_at BEFORE UPDATE ON public.portal_locations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS portal_locations_slug_idx ON public.portal_locations (slug);

-- ---------- Haversine helper (miles) ----------
CREATE OR REPLACE FUNCTION public.miles_between(
  _lat1 double precision, _lng1 double precision,
  _lat2 double precision, _lng2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 3958.8 * 2 * asin(
    sqrt(
      power(sin(radians(_lat2 - _lat1) / 2), 2) +
      cos(radians(_lat1)) * cos(radians(_lat2)) *
      power(sin(radians(_lng2 - _lng1) / 2), 2)
    )
  );
$$;

-- ---------- Public board: filter, then sort, then limit ----------
CREATE OR REPLACE FUNCTION public.public_walk_board(
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL,
  _city text DEFAULT NULL,
  _radius_miles double precision DEFAULT 25,
  _horizon_hours integer DEFAULT 720,
  _limit integer DEFAULT 24,
  _cursor_starts_at timestamptz DEFAULT NULL,
  _cursor_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  venue_name text,
  city text,
  region text,
  meeting_point text,
  lat double precision,
  lng double precision,
  attendee_count integer,
  image_url text,
  cover_override_url text,
  pace text,
  dog_friendly boolean,
  kid_friendly boolean,
  vibe text,
  miles double precision
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      _lat AS qlat,
      _lng AS qlng,
      nullif(btrim(lower(coalesce(_city, ''))), '') AS qcity,
      coalesce(_radius_miles, 25) AS qradius,
      least(greatest(coalesce(_horizon_hours, 720), 1), 8760) AS qhours,
      least(greatest(coalesce(_limit, 24), 1), 48) AS qlimit
  ),
  filtered AS (
    SELECT
      e.id, e.slug, e.title, e.starts_at, e.ends_at, e.timezone,
      e.venue_name, e.city, e.region, e.meeting_point,
      e.lat, e.lng, e.attendee_count, e.image_url, e.cover_override_url,
      e.pace, e.dog_friendly, e.kid_friendly, e.vibe,
      CASE
        WHEN p.qlat IS NOT NULL AND p.qlng IS NOT NULL AND e.lat IS NOT NULL AND e.lng IS NOT NULL
          THEN public.miles_between(p.qlat, p.qlng, e.lat, e.lng)
        ELSE NULL
      END AS miles
    FROM public.events e
    CROSS JOIN params p
    WHERE e.event_type = 'community_walk'
      AND e.status = 'published'
      AND e.visibility = 'public'
      AND e.audience_mode = 'public'
      AND e.host_user_id IS NOT NULL
      AND e.is_seed = false
      AND e.starts_at > now()
      AND e.starts_at <= now() + make_interval(hours => p.qhours)
      AND (
        (p.qcity IS NULL AND (p.qlat IS NULL OR p.qlng IS NULL))
        OR (p.qcity IS NOT NULL AND btrim(lower(coalesce(e.city, ''))) = p.qcity)
        OR (
          p.qlat IS NOT NULL AND p.qlng IS NOT NULL
          AND e.lat IS NOT NULL AND e.lng IS NOT NULL
          AND public.miles_between(p.qlat, p.qlng, e.lat, e.lng) <= p.qradius
        )
      )
      AND (
        _cursor_starts_at IS NULL
        OR _cursor_id IS NULL
        OR (e.starts_at, e.id) > (_cursor_starts_at, _cursor_id)
      )
  )
  SELECT f.id, f.slug, f.title, f.starts_at, f.ends_at, f.timezone,
         f.venue_name, f.city, f.region, f.meeting_point,
         f.lat, f.lng, f.attendee_count, f.image_url, f.cover_override_url,
         f.pace, f.dog_friendly, f.kid_friendly, f.vibe, f.miles
  FROM filtered f
  ORDER BY f.starts_at ASC, coalesce(f.miles, 9999) ASC, f.id ASC
  LIMIT (SELECT qlimit FROM params);
$$;

GRANT EXECUTE ON FUNCTION public.public_walk_board(
  double precision, double precision, text, double precision, integer, integer, timestamptz, uuid
) TO anon, authenticated;

CREATE INDEX IF NOT EXISTS events_public_board_idx
  ON public.events (starts_at)
  WHERE event_type = 'community_walk'
    AND status = 'published'
    AND visibility = 'public'
    AND audience_mode = 'public'
    AND is_seed = false;