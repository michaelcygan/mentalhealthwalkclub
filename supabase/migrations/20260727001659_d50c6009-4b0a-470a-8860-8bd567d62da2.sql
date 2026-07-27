
-- Rename column
ALTER TABLE public.places RENAME COLUMN google_place_id TO provider_place_id;

-- Drop old unique constraint (auto-created by UNIQUE on column) and old index
ALTER TABLE public.places DROP CONSTRAINT IF EXISTS places_google_place_id_key;
DROP INDEX IF EXISTS public.places_google_place_id_idx;

-- Add provider column with default 'google' so existing rows keep working
ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'google';

ALTER TABLE public.places
  DROP CONSTRAINT IF EXISTS places_provider_check;
ALTER TABLE public.places
  ADD CONSTRAINT places_provider_check CHECK (provider IN ('google','osm'));

-- New unique index on (provider, provider_place_id)
CREATE UNIQUE INDEX IF NOT EXISTS places_provider_external_id_unique
  ON public.places (provider, provider_place_id);

-- Non-unique lookup index for provider_place_id alone (kept for compatibility)
CREATE INDEX IF NOT EXISTS places_provider_place_id_idx
  ON public.places (provider_place_id);

-- Null out Google Photos hero references (URLs depend on the connector)
UPDATE public.places
  SET hero_url = NULL,
      hero_attribution = NULL,
      hero_source = NULL
  WHERE hero_source = 'google';
