## North star

A walker opens the app and sees one calm, time-aware list: *what's about to start, what's live now, what's later this week*. Tapping anything is one step from being inside it. No new mental model — just smarter use of what's already there.

## What we're building

### 1. Scheduled audio walks (group "circles")
A host (group owner or admin) schedules an audio walk for a specific time. At T-15 it surfaces in Live Now with a soft countdown. At T-0 it opens. Walkers tap once, their walk auto-starts, and they're placed into a **breakout pod of 3–4** (randomized). Pods can be reshuffled mid-walk by the host, or auto-reshuffle every N minutes for "speed-walk" style mixers.

### 2. Scheduled IRL walks
Already mostly there. We polish surfacing, add a T-30 push-style nudge in-app, and add a "starting soon" state to the events list and Live strip.

### 3. Unified Live strip
Today's `<LiveNowStrip>` shows only currently-live audio rooms. We expand it to a single timeline:
`Starting in 8 min` · `Live now (3 walking)` · `Tonight 7pm` · `Sat morning`.
Same component, smarter query.

---

## Data model (minimal additions)

We **keep `events` and `audio_rooms` separate** but add bridge fields. No table renames.

### `events` — add
- `audio_room_id uuid null` — when set, this scheduled event is an audio walk; the room exists from the moment it's scheduled (created in `scheduled` status).
- `breakout_size int default 0` — 0 = no pods (one big circle); 3 or 4 = pod size.
- `breakout_rotate_minutes int null` — null = pods are fixed; N = auto-reshuffle every N minutes.

### `audio_rooms` — add
- `status` gains a new value `'scheduled'` (alongside existing `'open'` / `'closed'`). Pre-T-0 the room is reservable but not joinable.
- `scheduled_event_id uuid null` — back-pointer to the parent event (for pods, points to the parent event too).
- `parent_room_id uuid null` — pods point to the umbrella room. Umbrella row holds the "this gathering exists" record; pod rows are the actual joinable circles.
- `pod_index int null` — 1, 2, 3… for display ("Pod 2 of 4").

### `audio_room_participants` — unchanged
A walker's `audio_room_id` is always a *pod* (or the umbrella room when `breakout_size = 0`). Reshuffling = update participants' `audio_room_id`.

### Why this shape
- Keeps `walk_session` pure: one person walking. Untouched.
- Keeps `event` as the scheduled-thing primitive (works for both IRL and audio).
- Pods reuse the existing audio room infrastructure — the WebRTC mesh, mute, participants list — *zero* new realtime code.
- "Live now" becomes one query: `events where starts_at between T-15 and T+90 OR audio_rooms where status='open'`.

---

## Server functions (new)

In `src/server/audio.functions.ts`:

- **`scheduleAudioWalk({ groupId, title, theme, startsAt, durationMinutes, breakoutSize, breakoutRotateMinutes, capacity })`**
  Creates an `event` (event_type='audio_walk') + an umbrella `audio_room` in `scheduled` status. Returns `{ eventId, slug }`.

- **`openScheduledRoom({ eventId })`** — called by cron at T-0 (and a manual "open early" button for hosts). Flips umbrella room to `open`. If `breakout_size > 0`, pre-creates `audio_rooms` for pods (status='open', `parent_room_id`, `pod_index`).

- **`joinScheduledWalk({ eventId, walkSessionId })`** — replaces today's "join" flow when entering from a scheduled event. Picks the least-full pod (or the umbrella if no pods), inserts the participant, returns `{ roomId, podIndex, podCount }`. Also creates the walker's `walk_session` if they don't have one active (one-tap join).

- **`reshufflePods({ eventId })`** — host-triggered or cron-triggered. Pulls all active participants, randomizes, reassigns `audio_room_id` evenly across pods. Real-time subscription on `audio_room_participants` makes the UI swap automatically.

In `src/server/walks.functions.ts` (existing file) — small helper:
- **`startWalkForEvent({ eventId })`** — one-step "I'm here": creates walk_session with `event_id` + `walk_type` set, then redirects to `/walk/active/$id`.

## Cron jobs

Two scheduled jobs (pg_cron → server route):

- `*/1 * * * *` → `POST /api/public/hooks/open-due-rooms` — finds events where `starts_at <= now() + 1min` and `audio_rooms.status='scheduled'`, calls `openScheduledRoom`.
- `*/2 * * * *` → `POST /api/public/hooks/rotate-pods` — finds open events with `breakout_rotate_minutes` set, calls `reshufflePods` if interval elapsed.

Auth: `apikey` header with anon key (per the standard pattern).

---

## UI changes

### A. New scheduling flow — `/events/new` enhancement
Today's form schedules IRL events. Add a single toggle at the top: **"Where does this walk happen?" → [In person] [Audio together]**.

When **Audio together** is selected:
- Hide location/address fields.
- Show: pod size (`Solo · Pairs · Trios · Quads`), rotation toggle (`Fixed pods` / `Mix every 10 min`), capacity slider (4–32), theme chip.
- "Schedule" CTA copy becomes *"Open the circle"*.

One form, two modes. No new route.

### B. Live strip — `/` (home)
`<LiveNowStrip>` rewritten to merge three queries (live audio, starting-soon events, your group's upcoming). Single horizontal scroller, three card states:

```
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ ● LIVE · 3     │  │ in 8 min       │  │ Sat 8:00 am    │
│ Quiet Morning  │  │ Sunday Reset   │  │ Park Loop      │
│ join walking → │  │ open early →   │  │ rsvp →         │
└────────────────┘  └────────────────┘  └────────────────┘
```

Cards animate from "later" → "starting soon" → "live" without re-render hops (sorted by absolute time, state derived from `starts_at` vs now).

### C. Scheduled event page — `/events/$slug`
Already shows IRL walks well. For audio walks:
- Replace location card with **"Audio circle · 8 spots · trios, mixing every 10 min"**.
- Within T-5 the CTA becomes one button: **"Join the circle"** → calls `joinScheduledWalk` → goes straight to `/walk/active/$id` with audio panel docked.
- After T-0, show live participant count and pod count: *"4 walking · 2 pods"*.

### D. In-walk pod UI — `walk-talk-dock.tsx`
When the walker is in a scheduled walk with pods:
- Pod label appears in the dock header: **"Pod 2 · 3 walking together"**.
- A subtle "🔀 mixing in 4:32" countdown when rotation is on.
- On reshuffle: voices fade out 1s, new participants fade in. A single line: *"new walkers · keep going"*.

No new screens.

### E. Group page — `/groups/$slug`
Add a small **"Schedule a walk"** button (visible to group owner/admin) that deep-links into `/events/new?group=...&mode=audio`. Group's upcoming scheduled walks list above the existing rooms list.

---

## Files touched

New:
- `src/routes/api/public/hooks/open-due-rooms.ts`
- `src/routes/api/public/hooks/rotate-pods.ts`

Edited:
- `src/server/audio.functions.ts` — three new server fns
- `src/server/walks.functions.ts` — `startWalkForEvent`
- `src/routes/events.new.tsx` — IRL/Audio toggle + pod controls
- `src/routes/events.$slug.tsx` — audio-walk presentation, one-tap join
- `src/components/live-now-strip.tsx` — unified time-aware query
- `src/components/walk-talk-dock.tsx` — pod label + rotation countdown
- `src/routes/groups.$slug.tsx` — schedule button + upcoming list

Migration: one file adding the new columns + one cron schedule registration.

---

## What makes this feel 2026

- **One primitive surface, three time states.** Same card animates across "later → soon → live". No tab switching, no separate "scheduled" page.
- **One-tap joins.** No pre-RSVP gate for audio walks — show up at start time and the next tap puts you in a pod with your walk auto-started.
- **Soft rotation.** Pods that mix every 10 minutes turn a 45-min walk into 4 short conversations with different walkers. Feels like a real walk-and-talk gathering, not a Zoom room.
- **Calm density.** The Live strip is one row, three states, no badges screaming. Time itself is the organizing principle.

---

## Out of scope (deliberately)
- Push notifications (in-app surfacing only for v1).
- Voice/audio recording or transcripts.
- Cross-group discovery for scheduled walks (your groups only).
- Custom pod assignment by host (auto-random only in v1).

---

## Approval needed
This requires:
1. A schema migration (additive only — no drops, no renames).
2. Two new cron jobs.

Ready to build on approval.