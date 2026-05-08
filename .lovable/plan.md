# Facilitator Role — Plan

A volunteer account type (therapists / psychology students) who taps **Start facilitating** and is auto-routed through live Walk & Talk pods, one at a time, in the reserved 5th seat. Walks continue to function with zero facilitators online — this layer is purely additive.

---

## 1. Role & access

**Schema**
- Extend `app_role` enum: add `'facilitator'`.
- New table `facilitator_profiles`:
  - `user_id uuid PK → auth.users`
  - `status text` — `'pending' | 'approved' | 'suspended'` (default `pending`)
  - `credentials text` (free text: license #, school, supervisor)
  - `bio text`, `approved_at`, `approved_by uuid`
- RLS: facilitator can read/update own row; admins manage all.

**Onboarding (out of scope for this pass beyond the stub)**
- A simple `/facilitate/apply` form that creates the row + assigns `facilitator` role on admin approval. For now: admins grant manually via SQL; the app gates on `has_role(uid, 'facilitator') AND status='approved'`.

---

## 2. Facilitator session model

**New table `facilitator_sessions`** — one row per "shift" of being available:
- `id`, `facilitator_user_id`, `started_at`, `ended_at`
- `status` — `'available' | 'in_pod' | 'on_break' | 'ended'`
- `current_audio_room_id uuid` (nullable)
- `pods_visited int default 0`, `total_seconds int default 0`

**New table `facilitator_visits`** — one row per pod drop-in:
- `id`, `facilitator_session_id`, `audio_room_id`, `joined_at`, `left_at`
- `planned_duration_seconds int` (the timer value, e.g. 300)
- `outcome text` — `'completed' | 'reported' | 'left_early' | 'pod_ended'`
- `notes text` (private to facilitator + admin)

---

## 3. Routing logic — "press play, flow through walks"

**Server fn `startFacilitatorShift()`** — creates `facilitator_sessions` row, status `available`.

**Server fn `nextPodForFacilitator()`** — the heart of the flow. Picks the next live pod:

```
candidates = audio_rooms
  WHERE status = 'open'
    AND scheduled_event_id IS NOT NULL          -- only scheduled walks (groups)
    AND facilitator_user_id IS NULL              -- no facilitator currently
    AND current_participant_count >= 2           -- skip empty/solo pods
    AND id NOT IN (recent visits this shift, last 30 min)  -- don't re-enter
score by:
  1. longest time without a facilitator visit (fairness)
  2. highest walker count (most people benefit)
  3. event soonest to end (catch before it closes)
pick top 1
```

If none available → return `{ status: 'no_pods', retryAfterSeconds: 30 }`. UI shows ambient "listening for walks…" state.

**Server fn `joinPodAsFacilitator({ roomId, plannedDurationSeconds })`**:
- Set `audio_rooms.facilitator_user_id = uid`
- Insert `audio_room_participants` with `role='facilitator'`
- Insert `facilitator_visits` row
- Update session: `status='in_pod'`, `current_audio_room_id`
- Broadcast realtime event `facilitator_joined` so walkers see the announcement banner

**Server fn `leavePodAsFacilitator({ visitId, outcome })`**:
- Mark participant `left_at`, clear `audio_rooms.facilitator_user_id`
- Close `facilitator_visits` row with outcome + duration
- Broadcast `facilitator_left`
- Increment session counters
- Set session back to `available` (UI auto-fetches next pod)

**Server fn `reportFromPod({ visitId, reportedUserIds[], reason, details })`**:
- Insert into existing `safety_reports` (one per user)
- Force-close the audio room: `status='closed'`, `ends_at=now()`
- Mark visit `outcome='reported'`
- Walker dock receives realtime close event → "Walk ended by facilitator" toast → returns to home

**Server fn `endFacilitatorShift()`** — sets `ended_at`, `status='ended'`, leaves any active pod cleanly.

---

## 4. Walker-side changes (small)

- `walk-talk-dock`: subscribe to `audio_rooms.facilitator_user_id` change. When a facilitator joins, show a soft banner: *"{Name}, facilitator, has joined to listen in"* + small badge on their avatar. When they leave, fade banner.
- Constellation: facilitator avatar gets a distinct ring color (warm clay) and a small "facilitator" label — no mute icon, no speaking ring change.
- Pod close from facilitator report → existing leave flow + toast.

---

## 5. Facilitator UI — `/facilitate`

Single dedicated route, gated by `has_role(uid, 'facilitator')`. Mobile-first, big touch targets.

**State: `idle`** (before press play)
- Hero: "Hold space for a walk." Short description.
- Big primary button: **Start facilitating**
- Below: today's stats (pods visited, hours held)
- Optional: time limit selector (15min / 30min / 60min / unlimited shift)

**State: `searching`** (no pod available)
- Ambient pulse animation (matches walker matching screen)
- "Listening for live walks… {n} active right now"
- Auto-polls `nextPodForFacilitator` every 30s
- Buttons: **End shift** · **Take a break** (pauses polling)

**State: `in-pod`** (active visit)
- Top: pod title, walker count, "you are facilitating"
- **Timer**: ring countdown from chosen visit length (default 5 min). Configurable: 3/5/8 min.
- Audio cockpit (same mic / hands-free / PTT controls as walker, but unmuted by default — facilitators talk)
- **Suggested prompts** drawer (collapsed by default, swipe up):
  - Curated by stage (opener / mid-walk / wrap)
  - "What brought you out walking today?"
  - "Anyone want to share what's on their mind?"
  - "We've got a couple minutes left — anything sitting with you?"
  - Tap to copy / glance only
- When timer hits 0: pulse animation + **Next walk →** button appears (replaces timer). Facilitator says goodbye, then taps.
- Persistent secondary actions:
  - **Report & close** (red, requires confirm + reason + which user(s))
  - **Leave early** (no report — just exits this pod, returns to searching)
- Quick-note field: private notes saved to `facilitator_visits.notes`

**State: `between`** (after Next, before next pod loads)
- 10s breathing screen: "Nice work. Resetting…"
- Auto-advances to `searching`

**State: `break`**
- "On a break. Tap when ready."
- Resume / End shift buttons

---

## 6. Suggested prompts (static seed)

Hardcoded JSON in `src/lib/facilitator-prompts.ts`:
```
openers:   ["What brought you out today?", "Anyone walking somewhere new?", ...]
deepening: ["What's been sitting with you this week?", ...]
gentle:    ["No pressure to share — happy to walk in quiet too.", ...]
wrap:      ["A couple minutes left — anything you want to land on?", ...]
```
Later: AI-generated prompts via Lovable AI based on pod mood/theme (next pass).

---

## 7. Edge cases

- **Pod ends mid-visit** (host ends walk, all walkers leave): facilitator's dock shows "This walk ended" + auto-advance to next.
- **Facilitator disconnects** (closes tab): server cron `rotate-pods` already runs — extend it to clear stale `facilitator_user_id` after 90s of no participant heartbeat.
- **Two facilitators race for same pod**: `joinPodAsFacilitator` uses `UPDATE … WHERE facilitator_user_id IS NULL RETURNING` — only one wins; loser gets next pod.
- **Walker reports facilitator**: existing `safety_reports` flow already covers this; admins can suspend via `facilitator_profiles.status='suspended'`.
- **No pods available for full shift**: facilitator just sees ambient state — fine, this is expected as bandwidth varies.

---

## 8. Files to touch

**New**
- `supabase/migrations/<new>` — enum, two tables, RLS
- `src/server/facilitator.functions.ts` — all server fns above
- `src/routes/facilitate.tsx` — main facilitator UI (gated)
- `src/components/facilitator/timer-ring.tsx`
- `src/components/facilitator/prompt-drawer.tsx`
- `src/components/facilitator/report-dialog.tsx`
- `src/lib/facilitator-prompts.ts`

**Edited**
- `src/components/walk-talk-dock.tsx` — facilitator-joined banner + avatar styling + force-close handling
- `src/routes/api/public/hooks/rotate-pods.ts` — clear stale facilitators
- Bottom nav / profile menu — add "Facilitate" entry visible only to facilitator role

---

## 9. Out of scope (next passes)

- Public application form & admin approval UI (manual SQL grant for now)
- AI-generated prompts tuned to pod mood
- Post-walk facilitator reflection summary / supervisor review
- Facilitator scheduling availability calendar
- Walker preference: "prefer pods with facilitators" / "no facilitators please"
- Stipend / hours tracking for paid program

---

## Why this shape

- **Press-play simplicity**: one button starts the flow, server picks pods, facilitator never has to choose. Matches the walker UX philosophy.
- **Zero-facilitator resilience**: the reserved 5th seat already exists; everything here is purely additive — walks work identically when no one is facilitating.
- **Fairness routing**: longest-without-a-facilitator scoring spreads attention across pods instead of clustering on the busiest one.
- **Timer + Next button** mirrors how a real group therapist rotates through breakouts; the goodbye moment is honored, not rushed.
- **Report = close**: collapses two safety actions into one decisive control — a facilitator wouldn't leave a harmful pod running while filing paperwork.
