
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS audio_room_id uuid NULL,
  ADD COLUMN IF NOT EXISTS breakout_size integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS breakout_rotate_minutes integer NULL,
  ADD COLUMN IF NOT EXISTS last_pod_rotation_at timestamptz NULL;

ALTER TABLE public.audio_rooms
  ADD COLUMN IF NOT EXISTS scheduled_event_id uuid NULL,
  ADD COLUMN IF NOT EXISTS parent_room_id uuid NULL,
  ADD COLUMN IF NOT EXISTS pod_index integer NULL;

CREATE INDEX IF NOT EXISTS idx_audio_rooms_parent ON public.audio_rooms(parent_room_id) WHERE parent_room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audio_rooms_scheduled_event ON public.audio_rooms(scheduled_event_id) WHERE scheduled_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_starts_at_status ON public.events(starts_at) WHERE status = 'published';
