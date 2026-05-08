
ALTER TABLE public.audio_rooms
  ADD COLUMN IF NOT EXISTS audience_mode text NOT NULL DEFAULT 'closed',
  ADD COLUMN IF NOT EXISTS lobby_capacity integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS audience_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allow_guest_listeners boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reactions_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- Friend walks default to broadcast + guest listening
UPDATE public.audio_rooms
  SET audience_mode = 'broadcast', allow_guest_listeners = true
  WHERE room_type = 'friend';

-- Reactions
CREATE TABLE IF NOT EXISTS public.room_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audio_room_id uuid NOT NULL,
  user_id uuid,
  guest_id text,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS room_reactions_room_idx ON public.room_reactions(audio_room_id, created_at DESC);

ALTER TABLE public.room_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS room_reactions_select_open_friend ON public.room_reactions;
CREATE POLICY room_reactions_select_open_friend ON public.room_reactions
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.audio_rooms r
    WHERE r.id = room_reactions.audio_room_id
      AND r.room_type = 'friend'
      AND r.reactions_enabled = true
      AND r.status IN ('open','scheduled')
  ));

-- Inserts go through server fns (admin client); no insert policy exposed to clients.

-- Audience presence (ephemeral — pruned by cron)
CREATE TABLE IF NOT EXISTS public.room_audience_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audio_room_id uuid NOT NULL,
  user_id uuid,
  guest_id text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (audio_room_id, user_id),
  UNIQUE (audio_room_id, guest_id)
);
CREATE INDEX IF NOT EXISTS room_audience_presence_room_idx ON public.room_audience_presence(audio_room_id, last_seen_at DESC);

ALTER TABLE public.room_audience_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS room_audience_presence_select_open_friend ON public.room_audience_presence;
CREATE POLICY room_audience_presence_select_open_friend ON public.room_audience_presence
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.audio_rooms r
    WHERE r.id = room_audience_presence.audio_room_id
      AND r.room_type = 'friend'
      AND r.status IN ('open','scheduled')
  ));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_audience_presence;
