
# Mental Health Walk Club — MVP Plan (v2)

A warm, community-first wellness web app. The socializing happens **on your feet** — IRL events or live audio walks while actually walking. Solo walks count too. Mood and notes private. Peer support, not therapy.

## Core Philosophy Shift

- **No social feeds, no chat, no "hanging out" in the app.** Time in-app should push you outside.
- **Groups** (renamed from Clubs) are lightweight identity/affinity tags — opt-in chips on your profile and on events. They are not destinations with feeds.
- **Audio walks** are only available *during* an active walk session. You must start walking (motion detected) before you can join or stay in an audio room.
- **IRL events** are the primary group experience.

## Brand & Design

- Palette: warm cream `#F7F2E9`, soft sage `#C9D6C2`, forest `#2F4A3A`, muted clay `#C8866D`, warm stone `#A89E8E`, charcoal `#2A2A2A`.
- Serif display (Fraunces) headings + Inter body. Rounded-2xl cards, soft shadows, calm transitions.
- Mobile-first; bottom tab bar on mobile, sidebar on desktop.

## Auth

Email/password + Google via Lovable Cloud. Trigger auto-creates `profiles` + `user_preferences`. Onboarding: city, preferred walk modes, group affinities (chips), audio comfort, **location permission**.

## Location & Tracking (new emphasis)

This is a location-first app:
- On walk start, request `geolocation` permission; use `watchPosition` to track route.
- **Distance** computed from haversine between GPS samples; persisted to `walk_sessions.distance_meters` and `route_id` (sampled polyline in a `walk_routes` table).
- **Steps** estimated from distance × user stride (with manual override) — schema-ready for native HealthKit/Health Connect later.
- **Movement gate for audio walks**: a small motion detector requires sustained movement (e.g. >15 m in first 60 s) before the Join Audio Room button activates. If movement stops for >2 min during an audio walk, a gentle nudge appears: "Still walking? Audio walks happen on your feet."
- All location data stays private to the user; only aggregate distance shown.

New table: `walk_routes (id, walk_session_id, points jsonb, created_at)`.

## Navigation (5 tabs, opens to Walk)

1. **Walk** · 2. **Groups** · 3. **Events** · 4. **Journal** · 5. **Profile**

## Walk Tab (primary surface)

Hero CTA: **Start Mental Health Walk**. Secondary: Walk Solo · Guided Solo Walk · Find an IRL Walk. Weekly goal progress. Suggested walk based on last mood/intention.

Note: "Join Live Audio Walk" is **not** a top-level entry point anymore — audio rooms are surfaced *inside* the active walk screen once you're moving.

### Start Walk Flow
1. How are you walking today? (Solo / Guided Solo / IRL Event / Audio Walk)
2. Feeling chips (anxious, lonely, overwhelmed, sad, burned out, grieving, restless, okay, hopeful, just need company, prefer not to say)
3. Optional 1–10 mood score
4. Optional intention text
5. Start → request location → create `walk_sessions` row (`status=active`)

### Active Walk Screen
Elapsed time, **live distance (mi)**, estimated steps, mood/intention chip, pause/end, calming gradient.

- Solo: "Walking alone still counts."
- Audio mode: shows **"Confirming you're walking…"** spinner until motion gate passes, then reveals matching audio rooms (filtered by your group affinities + comfort level). Tap to join → opens external audio URL + creates participant row.
- Persistent safety button.

### End Walk Flow
Mood after + score, optional reflection, save. Then totals (minutes, miles, steps), goal progress, badges earned, gentle insight.

## Groups Tab (de-emphasized, lightweight)

Groups = affinity chips, not communities with feeds. Seeded: Anxiety, Burnout, Grief, New Friends, Quiet Walkers, Sunday Reset, Chicago Chapter.

Each group page shows only:
- Name + short description
- Member count
- **Upcoming IRL events tagged with this group**
- **Active audio rooms tagged with this group** (only joinable from an active walk)
- Join/Leave (adds chip to profile + filters event/audio matching)

No feed. No posts. No chat. No "live now" lounge.

## Events Tab (the real social layer)

List + detail. Types: community walk, walk + coffee, walk + party, therapist-led, fundraiser, private practice. Filter by city, date, group affinity, vibe. RSVP, check-in, claim badge after.

## Journal Tab

Private dashboard: walk history, totals (walks/minutes/**miles**/steps), mood before/after trend chart, best day/time, goal progress, badges, private notes. Optional map of a recent route.

## Profile Tab

Identity, city/chapter, **group affinity chips**, badges, subscription placeholder, privacy settings, safety + emergency resources, hosted walks, impact/donation section.

## Safety Layer

Persistent safety button on active walk + audio rooms: emergency services note, 988 crisis line, leave room, report user, block user, community guidelines.

## Database Schema

All tables per original spec, plus:
- `walk_routes` (per above) for GPS samples.
- Rename: `clubs` → `groups`, `club_memberships` → `group_memberships`, FKs `club_id` → `group_id` on `walk_sessions`, `audio_rooms`, `events`.
- `audio_rooms` gains `requires_active_walk boolean default true`.
- `user_roles` separate table with `app_role` enum + `has_role()` SECURITY DEFINER for admin checks.

### Indexes
- `walk_sessions(user_id, started_at desc)`
- `events(city, starts_at)`, `events(starts_at)`
- `audio_rooms(status, theme)`
- `group_memberships(group_id)`, `(user_id)`
- `event_rsvps(event_id)`, `(user_id)`
- `safety_reports(status)`
- `walk_routes(walk_session_id)`

### RLS
- Walk sessions, routes, mood, notes: owner-only read/write.
- Groups + events: public read; write by owner/host or admin.
- RSVPs: owner-only; host reads attendees for own event.
- Audio room participants: insert requires an active walk session owned by the user with confirmed motion (enforced in server function, not RLS).
- Safety reports: any auth user inserts; admin/moderator reads.
- Aggregate counters via triggers (member_count, attendee_count, current_participant_count) for 1M-user scale.

## Badges

Seed: First Walk, Ten Walks Taken, Walked It Through, Quiet Courage, Walked With Others, Sunday Reset, Still Here, Chicago Chapter Founding Walker. `evaluate_badges()` runs on walk completion.

## Goals

Weekly: walks count, minutes, **miles**, steps, audio walks, solo walks, IRL walks.

## Audio Rooms (placeholder + gated)

Schema fields `external_room_name`, `external_room_url` ready for Daily/LiveKit. Join button only renders after motion gate passes inside an active walk. Participant row records `walk_session_id` (required FK).

## Admin (`/admin`, role-gated)

Users, Events, Groups, Safety Reports, Badge Definitions, Donation Ledger, Featured Events, Featured Groups.

## Seeded Sample Data

7 groups, ~12 events across cities, 8 badges, sample walk history with routes + goals for demo user, one impact_donations row.

## Technical

- TanStack Start routes: `/`, `/walk`, `/walk/active/$id`, `/groups`, `/groups/$slug`, `/events`, `/events/$slug`, `/journal`, `/profile`, `/admin/*`, `/auth`.
- Server functions (`createServerFn` + `requireSupabaseAuth`): start/end walk, push GPS sample, RSVP, join/leave group, join audio room (validates active walk + motion), evaluate badges, admin queries. Zod-validated.
- Browser geolocation `watchPosition` with batched server pushes.
- Recharts for mood trends; lightweight SVG polyline for route preview.
- shadcn/ui restyled to brand tokens in `styles.css`.

## Out of Scope (v1)

- 1:1 DMs (never, by design)
- Group feeds/posts/chat (intentionally absent)
- Real audio SDK (placeholder URL)
- Native step tracking (schema-ready)
- Payments checkout (fields stored only)
