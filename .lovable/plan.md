
# Auto Walk Scheduler — Waves 5, 8, 9

Wrap up the scheduler with the deferred place picker, safety guardrails, light analytics, and a QA pass.

## Wave 5 — Reusable place picker

- New `src/components/walk-page/walk-place-picker.tsx`: extract the debounced Photon search + result list currently inline in `src/routes/_authenticated/walk.new.tsx` (lines ~56–69 and ~191–258). Props: `value` (selected place snapshot | null), `onChange`, `nearLat/nearLng` for location bias, and an optional `allowManual` flag so admin can bypass search and type venue/lat/lng directly.
- Update `walk.new.tsx` to consume the new component with no UX change.
- Wire the picker into the admin schedule sheet (`src/routes/admin.events.tsx`): replace the raw venue/address/lat/lng inputs with the picker, but keep a "Enter manually" toggle for launch cities where Photon returns nothing useful. Server payload still sends `place_id` when a cached place is chosen, otherwise `venue_name`/`address`/`lat`/`lng` — no server changes needed.

## Wave 8 — Safety heuristics + analytics

Guardrails in `src/lib/admin-seed-walks.functions.ts` (create + update):

- Reject start times outside a 06:00–21:00 local window (public safety default). Admin override via an explicit `allow_off_hours: true` flag on the input.
- Reject `duration_minutes > 180` unless `allow_long_duration: true`.
- Require `city` + at least one of `place_id` OR (`venue_name` AND (`lat`/`lng` OR `address`)) so seeds never point at "nowhere" (already partially enforced; tighten it).
- Cap 20 active schedules per city to prevent accidental flooding.
- Add a small confirmation copy block in the admin sheet noting these rules.

Analytics logging (lightweight, no new table):

- On every create/update/pause/resume/materialize-now/unpublish, insert a row into `error_reports` with `severity='info'` and a structured `context` payload (`{scheduler_action, schedule_id, city, actor_user_id}`) — reusing the existing admin-visible log surface. If you prefer a dedicated table I'll flag it; otherwise `error_reports` avoids a migration.
- Surface a "Recent scheduler activity" collapsible on the Auto schedules tab that reads the last 20 `scheduler_action` rows via a new admin server fn.

## Wave 9 — QA + production build

- Manual matrix: create schedule (community + self-host), edit recurrence (verify preserve/remove/create counts), pause/resume, generate-now, unpublish empty occurrence, RSVP-guarded unpublish rejection, seed disclosure on `/w/$code` (both hostless and self-hosted).
- Verify `pg_cron` daily job actually runs `materialize_seed_walks` (spot-check `next_occurrence_at` advances).
- Confirm seeded walks appear in `/discover` and `/` nearby grid via existing published-status filters.
- `tsgo --noEmit` clean + production build (`bun run build`) green.
- Playwright smoke: load `/admin/events`, open Auto schedules tab, screenshot; load a generated `/w/$code` seed page, screenshot the community-starter disclosure.

## Technical details

- Time-window and duration checks live in the Zod validator on `ScheduleInput`/`UpdateInput` so both create and update share them; the override flags default false.
- City-cap check: `select count where city ilike $1 and active = true` before insert, and on update when `active` flips from false→true or `city` changes.
- New server fn `listSchedulerActivity` (admin-gated) selects from `error_reports` where `context->>'scheduler_action' is not null` ordered by `created_at desc limit 20`.
- Place picker component keeps its own local `query`/`results`/`loading` state; parent only sees the selected snapshot to keep it drop-in.

## Out of scope

- Email/SMS notifications for upcoming seed walks.
- Attendance tracking.
- Localized (non-English) copy for the community-starter disclosure.
