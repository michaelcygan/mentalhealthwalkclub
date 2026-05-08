## Walk & Talk pod sizing: 4 + facilitator seat

Set the conversational pod target to **4 walkers**, with a reserved **5th seat** for a future Facilitator role (drop-in therapist). No facilitator logic yet — just the structural seat and the consolidation math that respects it.

### 1. Constants & schema

**`audio_rooms`** — change defaults, add reserved seat:
- `max_participants` default: `8` → `5` (4 walkers + 1 facilitator)
- Add column `facilitator_seat_reserved boolean NOT NULL DEFAULT true`
- Add column `facilitator_user_id uuid` (nullable, populated when a facilitator joins)

**`events`** — pod sizing:
- `breakout_size` default: `0` → `4`
- Backfill existing scheduled walks where `breakout_size = 0` to `4`

**`audio_room_participants`** — role values:
- Existing `role` text already supports `'participant' | 'host'`. Add convention for `'facilitator'` (no enum change needed; it's a free text column).

### 2. Server logic (`src/server/audio.functions.ts`)

**Pod scaling (`openScheduledRoomImpl`)**
```
walkerCap = breakout_size              // 4
podCount  = max(1, ceil(rsvps / walkerCap))
```
Rooms still created with `max_participants = walkerCap + 1` to hold the facilitator seat.

**Join gating (`joinScheduledWalk` / open Walk & Talk join)**
- Count active participants where `role <> 'facilitator'`.
- Reject join if `walker_count >= breakout_size` (4), even if total seats remain — the 5th is reserved.
- Facilitators bypass this check; they fill the reserved seat.

**Consolidation (`consolidatePodsImpl`)** — math uses walker counts only:
- Smallest pod A merges into target B when `walkers_A + walkers_B ≤ 4`.
- Facilitators are NOT moved by consolidation (they choose which pod to drop into). When A closes, if it had a facilitator, mark them as detached so they can rejoin elsewhere.

**Solo grace + ambient (lightweight, no new tables)**
- When a pod drops to 1 walker, set a 60s grace timer client-side before the dock attempts a merge call. During grace, dock shows ambient state ("Walking with you — others joining in a moment").
- Never auto-close the last walker mid-event; pod stays open with ambient music until host ends the walk.

### 3. UI surfacing

- **Schedule form** (`events.new.tsx`): show "Pods of 4 · 1 facilitator seat reserved" as a static helper line under the audio walk option. No user-facing config yet.
- **Event detail** (`events.$slug.tsx`): pod count chip reads `4 walkers per pod` instead of generic "breakout size."
- **walk-talk-dock**: when alone, swap "Waiting for others" copy → "Walking with you" + subtle ambient pulse. When pod has 4, show "Full pod" badge (facilitator slot still open and invisible to walkers — no need to advertise the empty seat yet).

### 4. Out of scope (next pass — Facilitator)
- Facilitator app role (`app_role` enum addition: `'facilitator'`)
- Facilitator dashboard listing live group walks
- "Drop in" flow that joins a pod in the reserved seat
- Therapist verification + scheduling availability
- Post-walk facilitator notes

### Files to change
- `supabase/migrations/<new>` — `max_participants` default, `facilitator_seat_reserved`, `facilitator_user_id`, `breakout_size` default + backfill
- `src/server/audio.functions.ts` — pod scaling, walker-only join gate, consolidation walker math, facilitator detach on close
- `src/components/walk-talk-dock.tsx` — solo grace + ambient copy, full-pod badge
- `src/routes/events.new.tsx` — helper copy
- `src/routes/events.$slug.tsx` — pod label copy

### Why these specific numbers
- 4 walkers = Dunbar conversational ceiling for audio without video
- Consolidation cleanly resolves: 2+2→4, 3+1→4, 1+1→2 (waits for next merge)
- Reserved 5th seat means facilitators never get rejected by full pods and never displace a walker
