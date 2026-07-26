
-- Preserve newest active solo per user; mark older duplicates abandoned.
WITH ranked AS (
  SELECT id, user_id,
         row_number() OVER (PARTITION BY user_id ORDER BY started_at DESC, created_at DESC) AS rn
  FROM public.walk_sessions
  WHERE status = 'active' AND walk_type = 'solo'
)
UPDATE public.walk_sessions ws
SET status = 'abandoned',
    ended_at = COALESCE(ws.ended_at, now()),
    updated_at = now()
FROM ranked r
WHERE ws.id = r.id AND r.rn > 1;

-- One active solo walk per user.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_solo_walk_per_user
  ON public.walk_sessions (user_id)
  WHERE status = 'active' AND walk_type = 'solo';
