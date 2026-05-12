# Live Walk "Dynamic Island" — v2

Three things to fix, plus a scale pass so this works for 100k concurrent walks.

## 1. Move it to the bottom + size it up

Today `LiveActivityPill` is a tiny top-of-screen chip. Replace it with a bottom-anchored mini-player that sits **above** the mobile tab bar (never under it) and never appears on `/walk/active/*`.

Layout (mobile):
```
┌──────────────────────────────────────────┐
│ ●  ⏱ 09:12  ·  Quiet Walkers Twilight    │  ← title row
│ 👟 1.2 mi · 1,842 steps                  │  ← stat row (compact)
│ [⏸]  [🔇]  [end]                  RETURN →│  ← controls
└──────────────────────────────────────────┘
       (sits above the 5-tab MobileTabBar)
```

Positioning rules:
- Fixed, `bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 8px)` on mobile.
- Fixed, bottom-left above the desktop sidebar footer on `md+`.
- `MobileTabBar` exposes its height via a CSS var so the pill stacks cleanly and never overlaps. When the tab bar auto-hides on scroll-down, the pill drops with it via the same var.
- Swipe-down collapses to a small bean (timer + dot) anchored to the same bottom slot. Swipe-up re-expands. Persisted in `sessionStorage` (already done).
- Tap title row = return to active walk. Tap controls = act in place.

## 2. Inline controls

The pill reads walk context and renders the right controls per format:

| Format            | Controls shown                                     |
|-------------------|----------------------------------------------------|
| Solo              | Pause/Resume · End                                 |
| Guided / Podcast  | Play/Pause (audio) · Mute · End                    |
| Walk & Talk / Pod | Mic mute/unmute · Speaker mute · Leave room · End  |
| Friend walk       | Mic mute · Speaker mute · End                      |

Wiring:
- A tiny **`useWalkController(walkId)` hook** centralizes pause/resume/end and audio mute. Both the active-walk page and the pill call into it so state stays in lockstep.
- Pause/resume writes to a single source of truth: a `walk_control` channel (Supabase Realtime broadcast, **not** a DB write per tap). The active-walk page listens and applies. End is the only DB write (sets `status='completed'`).
- Audio mute uses the existing `useAudioRoom` / `GuidedPlayer` refs surfaced via a lightweight context (`WalkAudioContext`) the active walk publishes into; the pill subscribes. No new tables.

## 3. Bulletproof dismissal

Root cause today: `LiveActivityPill` only refreshes on its own realtime subscription + 30s poll. If the realtime UPDATE is missed (offline blip, RLS, tab throttling), the pill keeps showing "active" after the user ended the walk.

Fixes (defense in depth):
1. **Local broadcast on end.** The active-walk page dispatches a `window` event `mhwc:walk-ended` with the walk id. The pill listens and immediately clears. Same event fires on `endWalk()` and on cancel paths.
2. **Route-aware guard.** When the user lands on `/journal` *and* the most recent session is `completed`, treat as ended even before realtime catches up.
3. **Single-flight load with abort.** Replace the current load with TanStack Query keyed on `user.id`, `staleTime: 15s`, `refetchOnWindowFocus`, plus the realtime channel as an invalidator. Stops the rare race where an in-flight `load()` overwrites a fresh "no active walk" result with a stale "active" row.
4. **Hard ceiling.** If `started_at` is older than 6h, hide the pill and call a cleanup server fn that flips orphan sessions to `abandoned`. Catches force-closed tabs.

## 4. Scale to 100k concurrent

Today every mounted client opens its own Supabase Realtime channel filtered by `user_id` on `walk_sessions` and `audio_room_participants`, plus a 30s poll. At 100k concurrent that's 200k channels and 3.3k req/s of redundant polling.

Changes:
- **Drop the 30s poll.** Replace with `refetchOnWindowFocus` + the broadcast event above. Realtime + focus refetch is sufficient.
- **One channel per user, not two.** Merge into a single `user:{id}` channel that listens to both tables via two `postgres_changes` filters on the same socket. Halves connections.
- **Server-fn for the heavy read.** Move the "current active walk + room context" query into a single `getMyLiveWalk` server function returning the merged shape the pill needs. Eliminates the second round-trip to `audio_rooms` for every render.
- **Throttle pause/resume to broadcast only.** Audio mute and pause never hit the DB. Only `start`, `end`, and the existing 30s persistence tick write rows.
- **No realtime channel when there's no active walk.** Lazy-subscribe: only open the channel after the first query confirms an active walk exists; tear down on end. Cuts steady-state channel count to ~the number of *currently walking* users, not all signed-in users.
- **Indexes.** Confirm `walk_sessions (user_id, status, started_at desc)` partial index `WHERE status='active'` exists; add migration if not. Same for `audio_room_participants (user_id, status)`.

## Out of scope

- New audio formats, queue, background notifications, push.
- Server-rendered Live Activity on iOS native — web only.
- Redesigning the active-walk page itself.

## Files

- `src/components/live-activity-pill.tsx` — rewrite (bottom anchor, controls, broadcast listener, lazy realtime).
- `src/components/mobile-tab-bar.tsx` — expose height as CSS var; small.
- `src/lib/walk-controller.tsx` — new context + `useWalkController` hook.
- `src/lib/walk-audio-context.tsx` — new lightweight context the active walk publishes refs into.
- `src/routes/walk.active.$id.tsx` — emit `mhwc:walk-ended`, consume controller, publish audio refs.
- `src/components/guided-player.tsx` — expose `play/pause/mute` via context.
- `src/lib/audio/use-audio-room.ts` — already exposes mute; thread through context.
- `src/lib/walks.functions.ts` (or new `src/lib/live-walk.functions.ts`) — `getMyLiveWalk` server fn + `cleanupOrphanWalks`.
- `supabase/migrations/*` — partial index on `walk_sessions(user_id, started_at desc) WHERE status='active'`.

No DB schema changes beyond the index.