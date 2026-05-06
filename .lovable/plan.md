## Scheduled Walks (Local Walks) — host, RSVP, geo check-in

Builds on what's already there: `events`, `event_rsvps`, `LocationAutosuggest`. No new top-level concepts — a "Local Walk" is just an `event` with `event_type = 'community_walk'` that any user can create.

## User flow

1. **Host creates a Local Walk** from `/events` → "Schedule a walk" button → form on `/events/new`:
   - Title, short description, date+time, duration
   - Meeting point (free text — "Lincoln Park, north fountain")
   - Location via `LocationAutosuggest` (city + lat/lng required)
   - Capacity (default 8, max 20)
   - Vibe tag (quiet / chatty / brisk / gentle)
   - Submits → `host_user_id = self`, `status = 'published'`, slug auto-generated
2. **Local users discover** on `/events` (already filtered by city autosuggest)
3. **RSVP** on the detail page (already exists — `event_rsvps`)
4. **Day-of:**
   - **Host** sees a "Start walk" button when within ±30 min of `starts_at`. Clicking flips `events.status` to `'in_progress'` and stamps `started_at`. This unlocks check-in for everyone.
   - **RSVP'd attendees** see "Check in" button only after the host starts. Click → browser geolocation → server validates distance ≤ 15 m (≈50 ft) from event lat/lng → stamps `checked_in_at`.
   - Failed check-in (too far) shows distance + "Move closer and try again."
5. **Host ends walk** → "End walk" button → `status = 'completed'`, `ended_at` stamped. Each checked-in attendee gets a `walk_sessions` row credited (so it counts toward badges/journal).

## Why this is elegant

- Re-uses `events` + `event_rsvps` (no new tables, no parallel concept)
- Geo check-in is server-side (Haversine in a server fn) so a malicious client can't fake it
- Integrates with existing `walk_sessions` → Local Walks count for streaks/badges automatically
- Same RSVP UI as today — just adds two buttons (Start, Check-in) gated by role + time + status

## Schema changes (small)

Migration adds to `events`:
- `started_at timestamptz`
- `ended_at timestamptz` (already not present? — verify; add if missing)

`status` values used: `published` → `in_progress` → `completed` (already a free-text column, no enum change).

## Server functions (`src/server/walks.functions.ts`)

- `createLocalWalk({ title, description, starts_at, duration_min, location, meeting_point, capacity, vibe })` — auth required, inserts event with `host_user_id = auth.uid()`, generates slug
- `startLocalWalk({ event_id })` — host-only, requires within ±30 min of starts_at, sets `status='in_progress'`, `started_at=now()`
- `checkInToLocalWalk({ event_id, lat, lng })` — RSVP'd-only, event must be `in_progress`, computes Haversine distance to event lat/lng, rejects if > 15 m, otherwise updates `checked_in_at`. Also creates a `walk_sessions` row with `event_id` + `walk_type='irl_event'` so it counts in journal/badges.
- `endLocalWalk({ event_id })` — host-only, sets `status='completed'`, `ended_at=now()`. Closes any open walk_sessions for this event.

All use `requireSupabaseAuth` middleware so RLS + identity is enforced.

## UI changes

**`/events`** — add "Schedule a walk" button at top-right
**New: `/events/new`** — host form (auth-gated, redirects to `/auth` if signed out)
**`/events/$slug`** — extend detail page:
- If `host_user_id === me` and status `published` and within window → "Start walk" button
- If `status === 'in_progress'` and I have an RSVP → "Check in here" button (asks for location permission, calls server fn)
- If host and `in_progress` → "End walk" button
- Live attendee/checked-in counts (use Supabase Realtime subscription on `event_rsvps` — already enabled? if not, enable)
- Status badge: Scheduled / In progress / Completed

## Edge cases / safety

- Geolocation denied → friendly message, fallback "Ask host to mark you present" (host can manually check in attendees from a list — small admin section on detail page)
- Walk auto-expires: if `starts_at + duration + 4h` passed and still `in_progress`, treat as completed in UI (no server cron needed v1)
- Capacity enforcement on RSVP (already partial — verify and tighten)
- Distance constant: `CHECKIN_RADIUS_METERS = 15` exported, easy to tune

## Files

**Create:**
- `src/server/walks.functions.ts`
- `src/routes/events.new.tsx`
- migration adding `started_at`, `ended_at` to events (if missing)

**Edit:**
- `src/routes/events.tsx` (add "Schedule a walk" CTA)
- `src/routes/events.$slug.tsx` (Start / Check-in / End buttons + status badge + manual host check-in)

## Open question
Should non-hosts be able to schedule walks (any user can create a Local Walk), or is hosting gated to admins/moderators in v1? The plan above assumes **any signed-in user can host** — fits the peer-led ethos. Confirm before I build, or I'll proceed with that default.