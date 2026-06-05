
-- 1. places
CREATE TABLE public.places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_place_id text UNIQUE,
  name text NOT NULL,
  address text,
  lat numeric,
  lng numeric,
  category text,
  hero_url text,
  hero_attribution text,
  hero_source text,
  blurb text,
  blurb_source text,
  osm_static_url text,
  cached_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX places_google_place_id_idx ON public.places(google_place_id);
GRANT SELECT ON public.places TO anon, authenticated;
GRANT ALL ON public.places TO service_role;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "places readable by everyone" ON public.places FOR SELECT USING (true);
CREATE TRIGGER tg_places_updated BEFORE UPDATE ON public.places
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. events extensions
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS place_id uuid REFERENCES public.places(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS circle_id uuid REFERENCES public.circles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cover_override_url text,
  ADD COLUMN IF NOT EXISTS pace text,
  ADD COLUMN IF NOT EXISTS distance_meters integer,
  ADD COLUMN IF NOT EXISTS dog_friendly boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kid_friendly boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_emails text[] NOT NULL DEFAULT '{}'::text[];

-- ensure visibility allows the new values (drop any old CHECK, add ours)
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid='public.events'::regclass
      AND contype='c'
      AND pg_get_constraintdef(oid) ILIKE '%visibility%'
  LOOP
    EXECUTE format('ALTER TABLE public.events DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE public.events
  ADD CONSTRAINT events_visibility_check
  CHECK (visibility IN ('public','group','link_only','private'));

-- 3. event_rsvp_guests
CREATE TABLE public.event_rsvp_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  email_hash text NOT NULL,
  email_encrypted text NOT NULL,
  status text NOT NULL DEFAULT 'going' CHECK (status IN ('going','maybe','declined')),
  referred_by_rsvp_id uuid,
  referred_by_guest_id uuid REFERENCES public.event_rsvp_guests(id) ON DELETE SET NULL,
  ip_hash text,
  user_agent text,
  claimed_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, email_hash)
);
CREATE INDEX event_rsvp_guests_event_idx ON public.event_rsvp_guests(event_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_rsvp_guests TO authenticated;
GRANT ALL ON public.event_rsvp_guests TO service_role;
ALTER TABLE public.event_rsvp_guests ENABLE ROW LEVEL SECURITY;
-- only the host can read raw guest rows from the client; everything else flows through server fns w/ service role
CREATE POLICY "Host can read guests" ON public.event_rsvp_guests FOR SELECT
  TO authenticated USING (public.is_event_host(auth.uid(), event_id));
CREATE POLICY "Host can delete guests" ON public.event_rsvp_guests FOR DELETE
  TO authenticated USING (public.is_event_host(auth.uid(), event_id));
CREATE TRIGGER tg_event_rsvp_guests_updated BEFORE UPDATE ON public.event_rsvp_guests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4. event_broadcasts
CREATE TABLE public.event_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_broadcasts_event_idx ON public.event_broadcasts(event_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_broadcasts TO authenticated;
GRANT SELECT ON public.event_broadcasts TO anon;
GRANT ALL ON public.event_broadcasts TO service_role;
ALTER TABLE public.event_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Broadcasts readable by everyone" ON public.event_broadcasts
  FOR SELECT USING (true);
CREATE POLICY "Host can post broadcasts" ON public.event_broadcasts
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.is_event_host(auth.uid(), event_id));
CREATE POLICY "Host can delete broadcasts" ON public.event_broadcasts
  FOR DELETE TO authenticated
  USING (public.is_event_host(auth.uid(), event_id));

-- 5. event_broadcast_reactions
CREATE TABLE public.event_broadcast_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.event_broadcasts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES public.event_rsvp_guests(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('👍','❤️','🌧️','☀️','🍃')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((user_id IS NOT NULL) OR (guest_id IS NOT NULL)),
  UNIQUE (broadcast_id, user_id, emoji),
  UNIQUE (broadcast_id, guest_id, emoji)
);
CREATE INDEX broadcast_reactions_broadcast_idx ON public.event_broadcast_reactions(broadcast_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_broadcast_reactions TO authenticated;
GRANT SELECT ON public.event_broadcast_reactions TO anon;
GRANT ALL ON public.event_broadcast_reactions TO service_role;
ALTER TABLE public.event_broadcast_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reactions readable by everyone" ON public.event_broadcast_reactions
  FOR SELECT USING (true);
CREATE POLICY "Auth users react as themselves" ON public.event_broadcast_reactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND guest_id IS NULL);
CREATE POLICY "Auth users remove own reactions" ON public.event_broadcast_reactions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 6. realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_rsvps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_broadcasts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_broadcast_reactions;
