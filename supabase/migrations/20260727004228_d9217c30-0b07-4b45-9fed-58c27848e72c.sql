-- =====================================================
-- Wave 1: walk_seed_schedules table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.walk_seed_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  host_user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,

  internal_name text NOT NULL,
  title text NOT NULL,
  description text NULL,
  vibe text NULL,

  place_id uuid NULL REFERENCES public.places(id) ON DELETE SET NULL,
  venue_name text NULL,
  address text NULL,
  city text NOT NULL,
  state text NULL,
  country text NULL,
  lat numeric NULL,
  lng numeric NULL,

  timezone text NOT NULL,
  first_local_date date NOT NULL,
  start_local_time time NOT NULL,
  frequency_weeks smallint NOT NULL DEFAULT 1,
  duration_minutes smallint NOT NULL DEFAULT 60,

  pace text NULL,
  dog_friendly boolean NOT NULL DEFAULT false,
  kid_friendly boolean NOT NULL DEFAULT false,
  accessibility_notes text NULL,

  active boolean NOT NULL DEFAULT true,
  horizon_occurrences smallint NOT NULL DEFAULT 6,

  last_materialized_at timestamptz NULL,
  next_occurrence_at timestamptz NULL,
  last_error text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT walk_seed_frequency_check CHECK (frequency_weeks IN (1, 2, 4)),
  CONSTRAINT walk_seed_duration_check CHECK (duration_minutes BETWEEN 10 AND 480),
  CONSTRAINT walk_seed_horizon_check CHECK (horizon_occurrences BETWEEN 1 AND 12),
  CONSTRAINT walk_seed_pace_check CHECK (pace IS NULL OR pace IN ('easy', 'moderate', 'brisk'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.walk_seed_schedules TO authenticated;
GRANT ALL ON public.walk_seed_schedules TO service_role;

ALTER TABLE public.walk_seed_schedules ENABLE ROW LEVEL SECURITY;

-- Admin-only reads
DROP POLICY IF EXISTS "Admins can view seed schedules" ON public.walk_seed_schedules;
CREATE POLICY "Admins can view seed schedules"
  ON public.walk_seed_schedules FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin-only writes
DROP POLICY IF EXISTS "Admins can insert seed schedules" ON public.walk_seed_schedules;
CREATE POLICY "Admins can insert seed schedules"
  ON public.walk_seed_schedules FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update seed schedules" ON public.walk_seed_schedules;
CREATE POLICY "Admins can update seed schedules"
  ON public.walk_seed_schedules FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete seed schedules" ON public.walk_seed_schedules;
CREATE POLICY "Admins can delete seed schedules"
  ON public.walk_seed_schedules FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
DROP TRIGGER IF EXISTS walk_seed_schedules_set_updated_at ON public.walk_seed_schedules;
CREATE TRIGGER walk_seed_schedules_set_updated_at
  BEFORE UPDATE ON public.walk_seed_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_walk_seed_schedules_active
  ON public.walk_seed_schedules (active, next_occurrence_at);
CREATE INDEX IF NOT EXISTS idx_walk_seed_schedules_city
  ON public.walk_seed_schedules (city);

-- =====================================================
-- Link events → schedule
-- =====================================================
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS seed_schedule_id uuid NULL
    REFERENCES public.walk_seed_schedules(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS events_seed_schedule_occurrence_unique
  ON public.events (seed_schedule_id, starts_at)
  WHERE seed_schedule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_seed_schedule
  ON public.events (seed_schedule_id)
  WHERE seed_schedule_id IS NOT NULL;

-- =====================================================
-- Wave 2: materializer
-- =====================================================
CREATE OR REPLACE FUNCTION public.materialize_seed_walks(_schedule_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  processed int := 0;
  inserted_total int := 0;
  existing_total int := 0;
  failed_total int := 0;
  k int;
  local_dt timestamp;
  utc_dt timestamptz;
  future_count int;
  inserted_this int;
  existing_this int;
  next_utc timestamptz;
  slug_base text;
  slug_final text;
  err_msg text;
  rand_suffix text;
BEGIN
  FOR s IN
    SELECT * FROM public.walk_seed_schedules
    WHERE active = true
      AND (_schedule_id IS NULL OR id = _schedule_id)
  LOOP
    processed := processed + 1;
    inserted_this := 0;
    existing_this := 0;
    next_utc := NULL;

    BEGIN
      -- Count future events already generated for this schedule
      SELECT count(*) INTO future_count
      FROM public.events
      WHERE seed_schedule_id = s.id
        AND starts_at > now()
        AND status <> 'cancelled';

      -- Walk forward occurrence-by-occurrence until we have horizon future events
      -- or we exceed a safety cap.
      k := 0;
      WHILE future_count < s.horizon_occurrences AND k < 520 LOOP
        local_dt := (s.first_local_date + (k * s.frequency_weeks) * INTERVAL '7 days')::date
                    + s.start_local_time;
        BEGIN
          utc_dt := local_dt AT TIME ZONE s.timezone;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'invalid timezone: %', s.timezone;
        END;

        k := k + 1;
        IF utc_dt <= now() THEN
          CONTINUE;
        END IF;

        -- Generate a readable slug with a random suffix for uniqueness
        rand_suffix := lower(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
        slug_base := regexp_replace(lower(s.title), '[^a-z0-9]+', '-', 'g');
        slug_base := regexp_replace(slug_base, '(^-+)|(-+$)', '', 'g');
        IF length(slug_base) > 60 THEN slug_base := substr(slug_base, 1, 60); END IF;
        IF slug_base = '' THEN slug_base := 'community-walk'; END IF;
        slug_final := slug_base || '-' || to_char(utc_dt AT TIME ZONE s.timezone, 'YYYY-MM-DD') || '-' || rand_suffix;

        BEGIN
          INSERT INTO public.events (
            title, slug, description, event_type, host_user_id, place_id,
            venue_name, address, city, state, country, lat, lng,
            starts_at, ends_at, timezone,
            visibility, audience_mode, status,
            price_cents, donation_percent, attendee_count,
            vibe, pace, dog_friendly, kid_friendly, accessibility_notes,
            is_seed, seed_schedule_id, age_realm
          ) VALUES (
            s.title, slug_final, s.description, 'seed_walk', s.host_user_id, s.place_id,
            s.venue_name, s.address, s.city, s.state, s.country, s.lat, s.lng,
            utc_dt, utc_dt + (s.duration_minutes * INTERVAL '1 minute'), s.timezone,
            'public', 'public', 'published',
            0, 0, 0,
            s.vibe, s.pace, s.dog_friendly, s.kid_friendly, s.accessibility_notes,
            true, s.id, 'adult'
          );
          inserted_this := inserted_this + 1;
          future_count := future_count + 1;
          IF next_utc IS NULL OR utc_dt < next_utc THEN next_utc := utc_dt; END IF;
        EXCEPTION
          WHEN unique_violation THEN
            -- Occurrence already exists (either idempotency index or slug collision).
            -- Retry slug collisions once; otherwise treat as existing.
            IF SQLERRM LIKE '%events_slug_key%' THEN
              slug_final := slug_base || '-' || to_char(utc_dt AT TIME ZONE s.timezone, 'YYYY-MM-DD') || '-'
                            || lower(substr(md5(random()::text || clock_timestamp()::text || 'r2'), 1, 6));
              BEGIN
                INSERT INTO public.events (
                  title, slug, description, event_type, host_user_id, place_id,
                  venue_name, address, city, state, country, lat, lng,
                  starts_at, ends_at, timezone,
                  visibility, audience_mode, status,
                  price_cents, donation_percent, attendee_count,
                  vibe, pace, dog_friendly, kid_friendly, accessibility_notes,
                  is_seed, seed_schedule_id, age_realm
                ) VALUES (
                  s.title, slug_final, s.description, 'seed_walk', s.host_user_id, s.place_id,
                  s.venue_name, s.address, s.city, s.state, s.country, s.lat, s.lng,
                  utc_dt, utc_dt + (s.duration_minutes * INTERVAL '1 minute'), s.timezone,
                  'public', 'public', 'published',
                  0, 0, 0,
                  s.vibe, s.pace, s.dog_friendly, s.kid_friendly, s.accessibility_notes,
                  true, s.id, 'adult'
                );
                inserted_this := inserted_this + 1;
                future_count := future_count + 1;
                IF next_utc IS NULL OR utc_dt < next_utc THEN next_utc := utc_dt; END IF;
              EXCEPTION WHEN OTHERS THEN
                existing_this := existing_this + 1;
              END;
            ELSE
              existing_this := existing_this + 1;
              IF next_utc IS NULL OR utc_dt < next_utc THEN next_utc := utc_dt; END IF;
            END IF;
        END;
      END LOOP;

      inserted_total := inserted_total + inserted_this;
      existing_total := existing_total + existing_this;

      -- refresh next_occurrence_at from the earliest future event
      SELECT min(starts_at) INTO next_utc
      FROM public.events
      WHERE seed_schedule_id = s.id
        AND starts_at > now()
        AND status <> 'cancelled';

      UPDATE public.walk_seed_schedules
        SET last_materialized_at = now(),
            next_occurrence_at = next_utc,
            last_error = NULL
        WHERE id = s.id;

    EXCEPTION WHEN OTHERS THEN
      failed_total := failed_total + 1;
      err_msg := SQLERRM;
      UPDATE public.walk_seed_schedules
        SET last_materialized_at = now(),
            last_error = err_msg
        WHERE id = s.id;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', processed,
    'inserted', inserted_total,
    'existing', existing_total,
    'failed', failed_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.materialize_seed_walks(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.materialize_seed_walks(uuid) TO service_role;

-- =====================================================
-- Wave 3: one daily cron
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'materialize-seed-walks-daily') THEN
    PERFORM cron.unschedule('materialize-seed-walks-daily');
  END IF;
  PERFORM cron.schedule(
    'materialize-seed-walks-daily',
    '15 5 * * *',
    $cron$ SELECT public.materialize_seed_walks(); $cron$
  );
END $$;