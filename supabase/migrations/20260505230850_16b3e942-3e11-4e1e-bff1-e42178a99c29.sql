
-- Fix search_path on remaining functions
ALTER FUNCTION public.tg_set_updated_at() SET search_path = public;
ALTER FUNCTION public.tg_group_member_count() SET search_path = public;
ALTER FUNCTION public.tg_event_attendee_count() SET search_path = public;
ALTER FUNCTION public.tg_audio_room_participant_count() SET search_path = public;

-- Revoke execute on security definer functions that should only run via triggers / server code
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.evaluate_badges(UUID, UUID) FROM PUBLIC, anon;
-- has_role MUST remain callable by authenticated for use inside RLS policies; that is its purpose.
