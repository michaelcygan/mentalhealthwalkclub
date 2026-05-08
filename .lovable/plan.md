## Goal

Make the Groups tab feel **alive** by seeding scheduled audio walks from believable host accounts in groups large enough to attract real RSVPs, plus auto-enroll early users into a single shared community group so the viral loop ignites from day one. Honest by default — the schedule is the seed, not the social proof.

## The mental model

We are not faking *people walking* and we are not faking *crowds*. We are seeding **schedule + invitation surface area**. A real user opens a group, sees "Tonight 7pm · Sunday Reset Walk · hosted by Maya R.", taps RSVP, and a real audio room opens at the scheduled time with whoever actually shows up. The host account never needs to "appear" — by the time the room opens, the walk on the calendar has done its job.

This is the same pattern Strava, Discord, and Partiful use. It's curation that looks decentralized.

## Architecture

```text
┌──────────────────────────────────────────────────────────┐
│ Host accounts (seeded)                                   │
│  · 30–50 curated profiles w/ avatars, bios, host flag    │
│  · One+ per region/theme cluster                         │
└──────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────┐
│ pg_cron: schedule-ghost-walks (every 30 min)             │
│  → calls /api/public/hooks/seed-walks                    │
│                                                          │
│  For each eligible group (member_count ≥ threshold):     │
│   · target cadence per group (e.g. chapter=3/wk)         │
│   · gap check: skip if next 48h already has a walk       │
│   · pick host (assigned to that group)                   │
│   · pick template (theme-aware)                          │
│   · pick slot (group's local prime times)                │
│   · INSERT events row (audio_walk, published)            │
│   · NO seed RSVPs                                        │
└──────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────┐
│ Existing open-due-rooms hook opens audio_room at start   │
│ Real users RSVP, real room runs, organic from there.     │
└──────────────────────────────────────────────────────────┘
```

## Honesty rules (non-negotiable)

- **Zero seeded RSVPs.** Ever. Real attendee count = real attendees. "0 going" is the stickiest number — it triggers the "be the first" instinct that 8/12/15 doesn't.
- **Hosts never RSVP themselves** to their own walks. The host scheduled it; that's the only signal.
- **Hosts never auto-join audio rooms.** If no real user shows up, the room never opens (cancel-empty-walks hook below).
- **Real users are never RSVP'd on their behalf.**
- The only thing seeded is the **event row** and the **host's name on it**. Everything else is real.

## Eligibility tiers (per group)

Walks per week is a function of `member_count`:

| Members      | Walks/week | Notes                                |
|--------------|------------|--------------------------------------|
| < 25         | 0          | Too small, would feel awkward        |
| 25–99        | 1          | One anchor walk per week             |
| 100–499      | 2–3        | Multiple time zones                  |
| 500–1,999    | 4–5        | Daily-ish                            |
| 2,000+       | 7+         | Always something on the calendar     |

Thresholds live in a `ghost_walk_config` row so they're tunable without a deploy.

## The "Early Adopters" group (auto-join)

- A single seeded group, slug `the-commons` (working name — see naming below).
- New `auto_join` boolean on `groups` (default false). The `handle_new_user` trigger inserts a `group_memberships` row for every group where `auto_join = true`.
- Backfill all existing users on migration.
- Capped at 1,000 — once full, `auto_join` flips to false automatically (cron check) and a successor group is created (`the-commons-02`). Each cohort stays intimate enough to feel like a real chapter while preserving the "early" badge.
- At 1,000 members it qualifies for the highest cadence tier and immediately becomes the *de facto* daily walk surface for the whole app.

**Naming options** (pick on approval): The Commons · Daybreak Club · The Front Porch · Chapter Zero · The Wayfinders.

## Host accounts ("hosts")

- Real `auth.users` + `profiles` rows, marked with new `profiles.is_host_account boolean`.
- 30–50 seeded once via migration: diverse names, real-looking bios ("walks the Embarcadero at sunrise · grad student · loves rainy mornings"), avatars from a curated set.
- Each host belongs to 3–8 groups (by theme/region affinity) so their scheduled walks look natural in context.
- Cannot log in (random unguessable password, no email verified) — they exist purely as schedulers.
- Invisible on leaderboards (filtered by `is_host_account` in `get_leaderboard` / `get_my_rank`).
- A host never joins an audio room. If by `starts_at - 10min` no real user has RSVP'd, the event auto-cancels — we never open empty rooms.

## Walk templates

A small `walk_templates` table keyed by theme:

```
theme: 'reset'    → titles: ["Sunday Reset", "Monday Reorient", "Midweek Pause"]
                  → vibes: ["quiet", "reflective"], length: 30–45 min
theme: 'chapter'  → titles: ["{City} Sunset Loop", "{City} Coffee Walk"]
                  → vibes: ["social"], length: 45–60 min
theme: 'burnout'  → titles: ["Decompress Walk", "Slow Down Together"]
... etc
```

Title interpolation pulls from the group's `city` / `location_label`. ~80 templates total = enough variety that the same title doesn't repeat in a 30-day window.

## Time-slot intelligence

For each group, cron picks slots from a per-theme prime-time matrix in the group's timezone (derived from `city` → IANA TZ via a lookup table for the seeded chapters; default America/New_York for niche groups):

- chapter (US): weekday 6:30am, 12:15pm, 6:15pm; weekend 8am, 9:30am
- quiet/grief: weekday 7am, 9pm; weekend 7am
- burnout: weekday 6:30pm, Friday 5pm
- reset: Sunday 9am, Monday 7am

Never schedule overlapping with an existing walk in the same group within ±90 min.

## Backend pieces to add

1. **Migration** — new columns + tables:
   - `profiles.is_host_account boolean default false` (+ index, + leaderboard filter)
   - `groups.auto_join boolean default false` + `groups.ghost_cadence_override int`
   - `events.is_seed boolean default false` (admin/analytics filter; never user-visible)
   - `walk_templates(id, theme, title_pattern, description, length_minutes, vibe, weight)`
   - `ghost_host_assignments(host_user_id, group_id, weight)` — explicit host↔group mapping
   - `ghost_walk_config(key, value jsonb)` — single tunable config row
   - Update `handle_new_user()` to insert memberships for all `auto_join = true` groups
   - Update `get_leaderboard` / `get_my_rank` to exclude `is_host_account`

2. **Seed data** (separate insert job, not migration):
   - 30–50 hosts (auth.users + profiles via admin client)
   - "The Commons" group with `auto_join=true`, member backfill
   - host↔group assignments
   - ~80 walk templates

3. **Server route** `/api/public/hooks/seed-walks` (POST):
   - Reads config, iterates eligible groups in batches of 100
   - For each: gap check, slot pick, host pick, template pick → insert single event row
   - Idempotent via `pg_try_advisory_lock(hashtext('seed-walks'))` so concurrent invocations exit cleanly
   - Returns `{ scanned, scheduled, skipped }`
   - 30s soft budget, structured logs

4. **Server route** `/api/public/hooks/cancel-empty-walks` (POST, every 5 min):
   - Cancels any `is_seed` event 10 min before `starts_at` if real RSVP count is 0
   - Prevents empty rooms from ever opening

5. **Server route** `/api/public/hooks/rotate-commons` (POST, daily):
   - If active Commons cohort hits 1,000 members → flip `auto_join=false`, create `the-commons-N+1` with `auto_join=true`

6. **pg_cron schedules** (via `supabase--insert`):
   - `seed-walks`: every 30 min
   - `cancel-empty-walks`: every 5 min
   - `rotate-commons`: daily 03:00 UTC

## Scale & hardening (100k concurrent posture)

- All seed work runs server-side via cron — zero client cost.
- Eligibility query uses `(is_active, member_count)` filter; add `idx_groups_eligibility` if needed.
- Cron tick processes groups in `LIMIT 100` batches with a cursor in `ghost_walk_config`.
- Single-flight via advisory lock.
- `is_host_account` filter applied at the SQL boundary in leaderboard fns.
- Realtime cost unchanged — seed events flow through the same `events` channel users already subscribe to.
- Audio-room infra unchanged: existing `open-due-rooms` and `rotate-pods` hooks just see more events.

## Frontend (minimal)

- **Trust signal on cards**: subtle "Hosted by {name}" line. No "ghost" indicator — they're real-feeling profiles.
- **New module on Home tab**: "Tonight in your groups" — surfaces upcoming events from groups the user is in (including auto-joined Commons), so day-one users have something to RSVP to immediately. Reuses existing event card.
- "0 going · be the first" microcopy on event cards with no RSVPs (works for seed *and* organic events — net positive everywhere).

## What stays exactly as-is

- `useGroupsFeed`, group cards, vibe collections, city gallery, RLS, audio room transport, facilitator system, badges.
- Real users' RSVPs and walks behave identically.
- `/groups/$slug` event list — no schema-visible difference.

## Net effect

A new user joins, lands on Home, sees "The Commons · Tonight 7pm · hosted by Maya R. · 0 going · be the first", taps RSVP, gets a reminder, joins a real audio room with whoever else also tapped. Every well-populated chapter shows 2–5 walks/week without any moderator effort. Nothing is faked except the calendar entry. The viral loop is structural and honest.

## Open questions before I build

1. **Naming** of the always-on auto-join group — The Commons, Daybreak Club, The Front Porch, Chapter Zero, or The Wayfinders?
2. **Cohort size** — 1,000 per cohort feels right; OK or prefer 500 / 2,000?
3. **Host-account profile pages** — openable (read-only profile w/ bio + scheduled walks) or opaque (name + avatar only, not tappable)?
