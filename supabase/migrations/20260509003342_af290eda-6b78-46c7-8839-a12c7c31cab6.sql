-- Ensure walk_routes has at most one row per walk session, so we can upsert
-- the in-progress points without duplicating rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'walk_routes_walk_session_id_key'
  ) THEN
    -- Collapse any historical duplicates first (keep the most recently updated).
    DELETE FROM public.walk_routes a
    USING public.walk_routes b
    WHERE a.walk_session_id = b.walk_session_id
      AND a.updated_at < b.updated_at;
    ALTER TABLE public.walk_routes
      ADD CONSTRAINT walk_routes_walk_session_id_key UNIQUE (walk_session_id);
  END IF;
END $$;