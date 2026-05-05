-- Add structured location columns to profiles, events, groups
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS location_label text,
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS location_label text;

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS location_label text,
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric;

-- Backfill location_label from city where present
UPDATE public.profiles SET location_label = city WHERE location_label IS NULL AND city IS NOT NULL;
UPDATE public.events   SET location_label = city WHERE location_label IS NULL AND city IS NOT NULL;
UPDATE public.groups   SET location_label = city WHERE location_label IS NULL AND city IS NOT NULL;