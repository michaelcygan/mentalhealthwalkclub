# Group-Scoped Walk & Talks (with adaptive consolidation)

Make Walk & Talks scheduled from a Group act like a private dinner party for that group: only members can RSVP and join, the room count adapts to who actually shows up, and rooms quietly consolidate as people leave so nobody ends up alone before the host closes the walk.

This is a small mechanic on top of existing primitives (`events`, `event_rsvps`, `audio_rooms`, `audio_room_participants`) — no new tables.

---

## 1. Group-only access

When a Walk & Talk is scheduled with a `group_id`, treat it as members-only.

- **Schedule:** in `scheduleAudioWalk`, when `groupId` is set, store `events.visibility = 'group'` (we already have the column; today it's hardcoded `'public'`). The `audio_rooms` row is unchanged structurally — `group_id` already lives on it.
- **RSVP gate (server fn `rsvpToEvent`, new):** any RSVP for an event with `visibility='group'` requires an active `group_memberships` row. Fail with a typed `{ requiresJoin: true, groupId, groupName, groupSlug }` payload (not a thrown error) so the UI can offer one-tap join → retry RSVP.
- **Join gate (`joinScheduledWalk`):** same membership check up front. Same typed `requiresJoin` response.
- **Discovery:** the Groups page already filters `events` by `group_id`. The Events tab list query gets `visibility != 'group' OR user is member` — one extra clause via two queries OR'd in the client (no RLS change required since the existing select policy already returns the row to anyone authenticated; we filter in the query).
- **Detail page (`/events/$slug`):** when `visibility='group'` and the viewer is not a member, replace the RSVP button with a soft "{Group} members only · Join group to RSVP" button that joins → re-renders → reveals RSVP.

We deliberately do **not** tighten RLS to fully hide the event row — keeping it visible lets shared links act as join invitations. Privacy of who's RSVP'd is already protected by `event_rsvps_select_own_or_host`.

## 2. RSVP-driven pod count (replace capacity-driven pods)

Today `openScheduledRoomImpl` pre-creates `ceil(capacity / breakout_size)` pods regardless of who actually shows up. For group walks this leaves empty rooms.

Change for **all** scheduled audio walks (group or not) when `breakout_size > 0`:

- At open time, count `event_rsvps` with `status='going'` (call it `N`).
- `podCount = max(1, ceil(N / breakout_size))`.
- If `N === 0`, still create 1 pod so a walk-up host isn't blocked.
- Pods are created exactly as today (`parent_room_id`, `pod_index`, `requires_active_walk: true`).

This is a one-line change inside `openScheduledRoomImpl`.

`joinScheduledWalk` already lazily opens the room when start time is near — same flow continues to work for late joiners (matched into the least-full pod).

## 3. Adaptive consolidation as people leave

This is the key mechanic the user described: as participants drop, merge under-filled pods so nobody is left alone until the host closes the walk.

### Trigger

Add a small server fn `consolidatePods(eventId)` invoked at three moments:

1. From the **client** inside `walk-talk-dock` after a user successfully calls `leaveAudioRoom` for a pod whose parent has `breakout_size > 0`. Fire-and-forget.
2. At the **end** of `joinScheduledWalk` (cheap idempotent check; ensures a late joiner's pod count is sane).
3. Optional: from `reshufflePods` so a host-initiated mix also consolidates first.

### Algorithm (single pass, deterministic, runs in one transaction-ish sequence)

```
P = open pods for event, ordered by current_participant_count asc, then pod_index asc
B = breakout_size

while there exist two open pods A, B in P with countA + countB <= B:
  pick A = least-full open pod
  pick B = next least-full open pod (different from A)
  move all active participants from A → B   (UPDATE audio_room_participants SET audio_room_id = B.id)
  mark A: status = 'closed', ends_at = now()
  refresh P from DB

# Floor case — never strand a single person:
if exactly one pod remains with one participant AND there is another open pod with room:
  move that lone person into the other pod and close the now-empty pod.

# Last person standing:
# Do NOT auto-close the final pod when it has 1 person — the user explicitly
# wants "down to the last person until they close the walk." Closing happens
# only when the host ends the event OR that last participant calls leave
# (existing tg_audio_room_participant_count trigger handles auto-close when
# the participant count hits 0).
```

Notes:
- Existing trigger `tg_audio_room_participant_count` already decrements counts and closes a room when count hits 0 — perfect, we let it do its job for the truly-final empty pod.
- We never touch the umbrella `parent_room_id` row; it stays open as the event's anchor.
- All pod moves preserve `walk_session_id` on the participant row, so the user's walk session is uninterrupted.
- We do **not** kick anyone or interrupt audio — the dock subscribes to its own `audio_room_id`; when it changes mid-call, the dock seamlessly reconnects (it already supports this for `reshufflePods`).
- Race protection: wrap in advisory locking via a single `select … for update` on the parent room, or accept best-effort with idempotent re-runs (cheaper). We'll go with idempotent re-runs — the algorithm is safe to call repeatedly.

### When `breakout_size === 0` (one circle)

No pods exist; consolidation is a no-op. The single umbrella room behaves exactly as today and closes naturally when empty.

## 4. Host close

Add a small "End walk" affordance on `/events/$slug` for the host once the event has started:

- Server fn `endScheduledWalk(eventId)` (host only): set parent room and any open pods → `status='closed', ends_at=now()`, set `events.ended_at=now()`.
- The dock observes the room status and shows a calm "Walk ended — thanks for being here" curtain (already a similar pattern when a room closes).

This gives the host the "until they close the walk" termination the user described, instead of relying solely on the natural empty-room close.

## 5. UI surface (small)

- **Groups page → Upcoming walks card:** if event is `visibility='group'`, add a tiny "Members only" eyebrow above the title.
- **Event detail (`/events/$slug`):** non-member sees the "Join {group} to RSVP" button described in §1. Member sees today's RSVP/join flow.
- **Groups page schedule pill:** unchanged — still says "Walk & Talk." We just default `visibility='group'` server-side when a `groupId` is present.
- **Host control:** "End walk" pill in the host's RSVP/host area, only when room is open. Reuses existing button styles.

No new design tokens, no new components beyond a tiny `EndWalkButton`.

## 6. Files touched

- **`src/server/audio.functions.ts`**
  - `scheduleAudioWalk`: set `visibility = groupId ? 'group' : 'public'`.
  - `openScheduledRoomImpl`: derive `podCount` from RSVP count, not capacity.
  - `joinScheduledWalk`: add membership check for group-scoped events; return `requiresJoin` payload; call `consolidatePodsImpl` after insert.
  - **New** `consolidatePodsImpl` + `consolidatePods` server fn (host or trigger-callable).
  - **New** `endScheduledWalk` server fn (host only).
- **`src/server/events.functions.ts`** (or wherever RSVP lives — verify; if RSVP is currently a direct supabase call from the client, move the create-RSVP path through a new `rsvpToGroupEvent` server fn so the membership gate is server-side. The delete path can stay client-side since RLS already restricts it to `user_id = auth.uid()`).
- **`src/routes/events.$slug.tsx`**: non-member CTA, host "End walk" button, surface `requiresJoin` join → retry flow.
- **`src/routes/groups.$slug.tsx`**: "Members only" eyebrow on group-scoped event cards.
- **`src/components/walk-talk-dock.tsx`**: fire `consolidatePods(eventId)` after a successful `leaveAudioRoom` when there's a `parent_room_id`.

No DB migration required — every column we touch (`events.visibility`, `audio_rooms.status`, `audio_room_participants.audio_room_id`) already exists.

## 7. Out of scope

- No new RLS-level hiding of group events from non-members (kept visible so shared links act as invites).
- No DM/chat inside pods.
- No persistent "pod history" — moves overwrite `audio_room_id` on the participant row; the room's lifecycle (`status='closed'`, `ends_at`) is the audit trail.
- No across-event matchmaking; consolidation only merges pods that share a `parent_room_id`.

## 8. Edge cases & how the plan handles them

| Case | Behavior |
| --- | --- |
| Host RSVPs 12, only 4 show up, breakout_size=3 | At open: `ceil(4/3)=2` pods (not 4). |
| 6 people in 3 pods of 2 each, one leaves | Two pods at 2 + one pod at 1 → merge the 1-pod into the smallest 2-pod (would be 3 ≤ size 3) → 2 pods of 3 and 2. |
| Pods at 3,3,3 (size=3), one leaves → 3,3,2 | No merge possible (3+2 > 3). Stays as is. |
| Late joiner arrives | `joinScheduledWalk` puts them in least-full pod, then consolidates (might not merge anything; cheap). |
| Last person standing | Pod stays open with 1 person; their dock continues; when they leave, existing trigger auto-closes that pod. The umbrella event also closes if host calls `endScheduledWalk`. |
| Non-member with a shared link | Sees event detail, sees "Join {group} to RSVP" button — one tap joins, then RSVP flows normally. |
| User RSVPs then leaves the group | Their RSVP row remains; on join, the membership check fails with `requiresJoin`. They can re-join the group to enter. |
| Two consolidations race (two leaves at once) | Both runs are idempotent — second pass either finds nothing to merge or merges what's still mergeable. Worst case: one extra UPDATE statement. |
