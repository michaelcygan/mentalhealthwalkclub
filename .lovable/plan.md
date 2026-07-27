# Admin Auto Walk Scheduler

Internal admin tool that maintains a rolling set of published "community starter" walks in launch cities. One recurring series per schedule; weekly / bi-weekly / every-4-weeks; hostless by default with clear disclosure.

## Waves

### Wave 1 — Data model
- Migration: `public.walk_seed_schedules` (fields per spec: internal_name, title, description, vibe, place snapshot, city/state/country, timezone, first_local_date, start_local_time, frequency_weeks ∈ {1,2,4}, duration_minutes, pace, dog/kid friendly, accessibility_notes, host_user_id nullable, active, horizon_occurrences default 6, last_materialized_at, next_occurrence_at, last_error).
- Add `events.seed_schedule_id uuid null` FK ON DELETE SET NULL; reuse existing `events.is_seed`.
- Partial unique index `(seed_schedule_id, starts_at) WHERE seed_schedule_id IS NOT NULL`.
- Enable RLS: authenticated admins only via `has_role(auth.uid(),'admin')`; writes go through server functions with the admin client. GRANT SELECT/INSERT/UPDATE/DELETE to authenticated, ALL to service_role.
- Add `updated_at` trigger.
- Regenerate Supabase types (auto after migration approval).

### Wave 2 — Materializer
- `public.materialize_seed_walks(_schedule_id uuid default null)` SECURITY DEFINER.
- Compute occurrences with `(local_date + start_local_time) AT TIME ZONE schedule.timezone` (DST-safe).
- Walk forward by `frequency_weeks * 7` days in local time from `first_local_date`, skip past occurrences, insert the next `horizon_occurrences` future events.
- Insert events with `is_seed=true`, `event_type='seed_walk'`, `status='published'`, `visibility='public'`, `audience_mode='public'`, `price_cents=0`, `donation_percent=0`, `attendee_count=0`, place snapshot copied from schedule, slug `slugify(title)-YYYY-MM-DD-<random6>`.
- Rely on the unique index for idempotency; update `last_materialized_at`, `next_occurrence_at`, `last_error`; continue on per-schedule failure.
- Returns `{processed, inserted, existing, failed}`.

### Wave 3 — One daily cron
- Enable `pg_cron`; `cron.schedule('materialize-seed-walks-daily', '15 5 * * *', $$select public.materialize_seed_walks();$$)` guarded by an unschedule-if-exists to keep migration rerunnable.
- Create/edit server functions call `materialize_seed_walks(id)` inline so admins see occurrences immediately.

### Wave 4 — Admin server functions
`src/lib/admin-seed-walks.functions.ts` with `requireSupabaseAuth` + `has_role` admin check + Zod, using `client.server` admin client loaded inside handlers:
- `listSeedSchedules`, `listSeedScheduleOccurrences`
- `createSeedSchedule` (validates IANA tz via `Intl.DateTimeFormat` probe; snapshots place fields; runs materializer)
- `updateSeedSchedule` — when recurrence/location changes: preserve future events that (a) start within 24h OR (b) have any `event_rsvps` or `event_rsvp_guests`; cancel/remove the rest; rematerialize. Return `{preserved, removed, created}`.
- `pauseSeedSchedule` / `resumeSeedSchedule` (does not touch existing events)
- `materializeSeedScheduleNow`
- `unpublishEmptySeedOccurrence` — blocks if RSVPs exist or event has started; sets `status='cancelled'`.

### Wave 5 — Reusable place picker
- Extract inline place-search UI from `walk.new.tsx` into `src/components/walk-page/walk-place-picker.tsx`.
- Emits internal `{id, name, address, lat, lng, hero_url}` (backed by `getOrCreateWalkPlace`). Preserves manual meeting-point fallback.
- Reused in `walk.new.tsx` (behavior-preserving swap) and admin sheet.

### Wave 6 — Admin UI
- Extend `src/routes/admin.events.tsx` with segmented control: `Upcoming` | `Auto schedules` (no new nav item).
- Upcoming: keep existing list + Featured; add Seed badge, city, link to originating schedule, "Unpublish (empty)" action, filter All/Regular/Seeded.
- Auto schedules: grouped-by-city cards showing name, title, venue, frequency, local weekday+time, tz, duration, pace, active/paused, next occurrence, count of future generated walks, last materialization status, last error. Actions: View occurrences · Generate now · Edit · Pause/Resume.
- Create/Edit bottom sheet with fields per spec. Frequency choices: Every week / Every 2 weeks / Every 4 weeks. Host: "Community starter — no assigned host" (default) / "Hosted by me". After save show the 6 occurrence dates formatted with tz abbreviation (e.g. `Sat, Aug 8 · 11:00 AM CDT`).

### Wave 7 — Public seeded-walk presentation
- Add `is_seed`, `seed_schedule_id`, `host_user_id` to the walk-page reader.
- `w.$code.tsx`: when `is_seed && !host_user_id`, render a prominent "Community starter walk" notice above RSVP explaining no official leader is assigned and this is a peer meetup, not therapy/crisis care. Hostless walks still accept RSVPs.
- When a host is assigned: normal host card + smaller "Scheduled through Mental Health Walk Club" tag.

### Wave 8 — Safety & analytics
- Admin form guidance copy: "Use a public, easy-to-identify meeting place."
- Server-side reject on create/update: require non-empty `city` + venue_name/address, and reject if venue_name looks like a private address (basic heuristic: contains a street number + no place_id and no explicit public-place marker — kept conservative).
- No new analytics provider; log lightweight events (`seed_schedule_created`, `seed_schedule_paused`, `seed_occurrence_generated`, `seed_occurrence_rsvp`) through existing analytics path if present, otherwise skip.

### Wave 9 — QA
- Manual scenarios per spec (DST transition, invalid tz, past first date, RSVP-preservation on edit, concurrent materialize, non-admin denial).
- `npm run lint` and `npm run build`; fix wave-introduced errors.

## Technical notes

- Timezone validated with `try { new Intl.DateTimeFormat('en-US',{timeZone: tz}); } catch { reject }`.
- Materializer computes next N occurrences by iterating `first_local_date + k*frequency_weeks*7 days` and converting each via `AT TIME ZONE`; keeps only those with UTC timestamp > `now()`.
- Slug uniqueness: `<slugified-title>-<yyyy-mm-dd>-<6-char-random>`; on conflict retry once with a fresh suffix.
- Cancellation status: audit shows current events use `status` values including `scheduled`, `published`, `cancelled` — will confirm the exact allowed set in the migration audit step and use whichever cancellation value exists; fall back to `status='cancelled'` if supported.
- Existing group standing-walks system in `standing-walks.functions.ts` is untouched — used only as reference.
- All admin mutations go through `client.server` (service role), loaded lazily inside handlers to keep it out of client bundles.

## Out of scope for V1
- Host-claim flow for hostless walks.
- Arbitrary cron / multi-weekday within one schedule.
- Auto-emailing attendees on cancellation.
- Attendance tracking.
