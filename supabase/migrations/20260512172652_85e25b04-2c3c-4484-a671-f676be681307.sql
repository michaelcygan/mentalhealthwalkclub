CREATE INDEX IF NOT EXISTS idx_walk_sessions_active_user
  ON public.walk_sessions (user_id, started_at DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_audio_room_participants_active_user
  ON public.audio_room_participants (user_id, audio_room_id)
  WHERE status = 'active';