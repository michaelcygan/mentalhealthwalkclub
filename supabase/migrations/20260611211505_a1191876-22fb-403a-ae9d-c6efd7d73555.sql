CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Remove prior versions if re-running
DO $$
BEGIN
  PERFORM cron.unschedule('emit_walk_reminders_hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('emit_weekly_recap_sunday');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'emit_walk_reminders_hourly',
  '0 * * * *',
  $$ SELECT public.emit_walk_reminders(); $$
);

SELECT cron.schedule(
  'emit_weekly_recap_sunday',
  '0 14 * * 0',
  $$ SELECT public.emit_weekly_recap(); $$
);