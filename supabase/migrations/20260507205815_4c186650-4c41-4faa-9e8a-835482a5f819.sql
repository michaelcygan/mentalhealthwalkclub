CREATE OR REPLACE FUNCTION public.tg_audio_room_participant_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  new_count INTEGER;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    UPDATE public.audio_rooms
      SET current_participant_count = current_participant_count + 1,
          status = CASE WHEN status = 'closed' THEN 'open' ELSE status END
      WHERE id = NEW.audio_room_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status <> 'active' THEN
    UPDATE public.audio_rooms
      SET current_participant_count = GREATEST(current_participant_count - 1, 0)
      WHERE id = NEW.audio_room_id
      RETURNING current_participant_count INTO new_count;
    IF new_count = 0 THEN
      UPDATE public.audio_rooms SET status = 'closed', ends_at = now() WHERE id = NEW.audio_room_id;
    END IF;
  END IF;
  RETURN NULL;
END; $function$;

DROP TRIGGER IF EXISTS audio_room_participant_count_trg ON public.audio_room_participants;
CREATE TRIGGER audio_room_participant_count_trg
AFTER INSERT OR UPDATE ON public.audio_room_participants
FOR EACH ROW EXECUTE FUNCTION public.tg_audio_room_participant_count();