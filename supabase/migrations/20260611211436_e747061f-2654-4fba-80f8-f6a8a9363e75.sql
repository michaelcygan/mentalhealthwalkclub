ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_walk_reminders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_weekly_recap boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_walk_reminder_uniq
  ON public.notifications (user_id, entity_id)
  WHERE kind = 'walk_reminder';

CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id uuid, _actor_id uuid, _kind notification_kind,
  _title text, _body text, _link text, _entity_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nid uuid;
  allowed boolean := true;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;
  IF _actor_id IS NOT NULL AND _actor_id = _user_id THEN RETURN NULL; END IF;

  SELECT CASE _kind
    WHEN 'friend_request'  THEN COALESCE(p.notify_friend_requests, true)
    WHEN 'friend_accepted' THEN COALESCE(p.notify_friend_requests, true)
    WHEN 'high_five'       THEN COALESCE(p.notify_high_fives, true)
    WHEN 'walk_rsvp'       THEN COALESCE(p.notify_rsvps, true)
    WHEN 'walk_broadcast'  THEN COALESCE(p.notify_broadcasts, true)
    WHEN 'walk_reminder'   THEN COALESCE(p.notify_walk_reminders, true)
    WHEN 'weekly_recap'    THEN COALESCE(p.notify_weekly_recap, true)
    ELSE true
  END
  INTO allowed
  FROM public.profiles p
  WHERE p.id = _user_id;

  IF NOT COALESCE(allowed, true) THEN RETURN NULL; END IF;

  INSERT INTO public.notifications(user_id, actor_id, kind, title, body, link, entity_id)
  VALUES (_user_id, _actor_id, _kind, _title, _body, _link, _entity_id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO nid;

  RETURN nid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_notification(uuid,uuid,notification_kind,text,text,text,uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.emit_walk_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT e.id AS event_id, e.title, e.slug, rs.user_id
    FROM public.events e
    JOIN public.event_rsvps rs ON rs.event_id = e.id AND rs.status = 'going'
    WHERE e.status = 'published'
      AND e.starts_at BETWEEN now() + interval '22 hours' AND now() + interval '26 hours'
  LOOP
    PERFORM public.create_notification(
      r.user_id, NULL, 'walk_reminder'::notification_kind,
      'Tomorrow: ' || COALESCE(r.title, 'your walk'),
      'A gentle reminder — see you out there.',
      CASE WHEN r.slug IS NOT NULL THEN '/w/' || r.slug ELSE '/discover' END,
      r.event_id
    );
    inserted_count := inserted_count + 1;
  END LOOP;
  RETURN inserted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.emit_weekly_recap()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
  r record;
  walks int;
  already boolean;
BEGIN
  FOR r IN
    SELECT DISTINCT p.id AS user_id
    FROM public.profiles p
    WHERE EXISTS (
      SELECT 1 FROM public.walk_sessions w
      WHERE w.user_id = p.id AND w.started_at > now() - interval '30 days'
    ) OR EXISTS (
      SELECT 1 FROM public.event_rsvps er
      JOIN public.events e ON e.id = er.event_id
      WHERE er.user_id = p.id AND er.status = 'going'
        AND e.starts_at > now() - interval '30 days'
    )
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = r.user_id
        AND kind = 'weekly_recap'
        AND created_at > now() - interval '6 days'
    ) INTO already;
    IF already THEN CONTINUE; END IF;

    SELECT count(*) INTO walks
    FROM public.walk_sessions
    WHERE user_id = r.user_id
      AND status = 'completed'
      AND started_at > now() - interval '7 days';

    PERFORM public.create_notification(
      r.user_id, NULL, 'weekly_recap'::notification_kind,
      'Your week in walks',
      CASE WHEN walks > 0
        THEN 'You logged ' || walks || ' walk' || CASE WHEN walks = 1 THEN '' ELSE 's' END || ' this week. Nicely done.'
        ELSE 'A fresh week is here. Want to plan a short one?'
      END,
      '/journal',
      r.user_id
    );
    inserted_count := inserted_count + 1;
  END LOOP;
  RETURN inserted_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.emit_walk_reminders() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_weekly_recap() FROM public, anon, authenticated;