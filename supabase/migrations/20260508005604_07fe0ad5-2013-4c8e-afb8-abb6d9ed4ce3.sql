
ALTER TABLE public.audio_rooms ALTER COLUMN max_participants SET DEFAULT 5;
ALTER TABLE public.audio_rooms ADD COLUMN IF NOT EXISTS facilitator_seat_reserved boolean NOT NULL DEFAULT true;
ALTER TABLE public.audio_rooms ADD COLUMN IF NOT EXISTS facilitator_user_id uuid;

ALTER TABLE public.events ALTER COLUMN breakout_size SET DEFAULT 4;
UPDATE public.events SET breakout_size = 4 WHERE breakout_size = 0 OR breakout_size IS NULL;
