
ALTER TABLE public.audio_rooms ADD COLUMN IF NOT EXISTS share_code text;
CREATE UNIQUE INDEX IF NOT EXISTS audio_rooms_share_code_key ON public.audio_rooms(share_code) WHERE share_code IS NOT NULL;

ALTER TABLE public.audio_room_participants
  ADD COLUMN IF NOT EXISTS participant_role text NOT NULL DEFAULT 'speaker';

-- Allow public select of rooms by share_code is already covered (audio_rooms_select_all = true for authenticated).
-- Allow listeners to update their own row to raise/lower hand (already covered by audio_room_participants_update_self).
