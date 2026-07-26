
-- =========================
-- WAVE 1: Mixed-source radio_tracks
-- =========================

-- Allow upload rows to migrate; new sources may leave storage_key null.
ALTER TABLE public.radio_tracks ALTER COLUMN storage_key DROP NOT NULL;

ALTER TABLE public.radio_tracks
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS podcast_episode_id uuid REFERENCES public.podcast_episodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS repeat_count integer NOT NULL DEFAULT 1;

-- Backfill (defensive: covers pre-existing rows created before defaults)
UPDATE public.radio_tracks SET source_type = 'upload' WHERE source_type IS NULL;
UPDATE public.radio_tracks SET repeat_count = 1 WHERE repeat_count IS NULL OR repeat_count < 1;

ALTER TABLE public.radio_tracks
  DROP CONSTRAINT IF EXISTS radio_tracks_source_type_check;
ALTER TABLE public.radio_tracks
  ADD CONSTRAINT radio_tracks_source_type_check
  CHECK (source_type IN ('upload','external_url','podcast_episode'));

ALTER TABLE public.radio_tracks
  DROP CONSTRAINT IF EXISTS radio_tracks_repeat_count_check;
ALTER TABLE public.radio_tracks
  ADD CONSTRAINT radio_tracks_repeat_count_check
  CHECK (repeat_count BETWEEN 1 AND 20);

-- Exactly-one-valid-source
ALTER TABLE public.radio_tracks
  DROP CONSTRAINT IF EXISTS radio_tracks_source_shape_check;
ALTER TABLE public.radio_tracks
  ADD CONSTRAINT radio_tracks_source_shape_check
  CHECK (
    (source_type = 'upload'
      AND storage_key IS NOT NULL
      AND external_url IS NULL
      AND podcast_episode_id IS NULL)
    OR
    (source_type = 'external_url'
      AND external_url IS NOT NULL
      AND storage_key IS NULL
      AND podcast_episode_id IS NULL)
    OR
    (source_type = 'podcast_episode'
      AND podcast_episode_id IS NOT NULL
      AND storage_key IS NULL
      AND external_url IS NULL)
  );

-- Prevent unintentional duplicate podcast episodes in the same station.
-- Admin can still intentionally increase repeat_count to repeat within a cycle.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_radio_tracks_station_podcast
  ON public.radio_tracks(station_id, podcast_episode_id)
  WHERE podcast_episode_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_radio_tracks_podcast_episode
  ON public.radio_tracks(podcast_episode_id)
  WHERE podcast_episode_id IS NOT NULL;

-- =========================
-- WAVE 1: radio_stations playback controls
-- =========================
ALTER TABLE public.radio_stations
  ADD COLUMN IF NOT EXISTS playback_mode text NOT NULL DEFAULT 'shuffle',
  ADD COLUMN IF NOT EXISTS loop_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

ALTER TABLE public.radio_stations
  DROP CONSTRAINT IF EXISTS radio_stations_playback_mode_check;
ALTER TABLE public.radio_stations
  ADD CONSTRAINT radio_stations_playback_mode_check
  CHECK (playback_mode IN ('ordered','shuffle'));

-- At most one active default station
CREATE UNIQUE INDEX IF NOT EXISTS uniq_radio_stations_default_active
  ON public.radio_stations((true))
  WHERE is_default = true AND is_active = true;

-- =========================
-- WAVE 2: podcast_feeds — decouple Radio source enablement from public visibility
-- =========================
ALTER TABLE public.podcast_feeds
  ADD COLUMN IF NOT EXISTS radio_enabled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_podcast_feeds_radio_enabled
  ON public.podcast_feeds(radio_enabled) WHERE radio_enabled = true;
