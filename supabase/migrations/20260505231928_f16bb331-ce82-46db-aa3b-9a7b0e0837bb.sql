REVOKE EXECUTE ON FUNCTION public.evaluate_badges(uuid, uuid) FROM authenticated, anon, public;

CREATE OR REPLACE FUNCTION public.tg_walk_session_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    PERFORM public.evaluate_badges(NEW.user_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_walk_session_completed ON public.walk_sessions;
CREATE TRIGGER trg_walk_session_completed
AFTER UPDATE ON public.walk_sessions
FOR EACH ROW EXECUTE FUNCTION public.tg_walk_session_completed();