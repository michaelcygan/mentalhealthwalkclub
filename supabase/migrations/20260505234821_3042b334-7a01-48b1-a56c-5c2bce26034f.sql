UPDATE public.audio_rooms SET max_participants = 8 WHERE max_participants <> 8;
ALTER TABLE public.audio_rooms ALTER COLUMN max_participants SET DEFAULT 8;