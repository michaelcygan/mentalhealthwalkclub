## Solo Walk — Remaining Waves

Waves 1–7 are done (DB migration + unique active-session index, server functions, rebuilt walk route with ready/active/finish/saved states, Radio quick picker, composer + tab bar updates, homepage Today island resume state, Journal inclusion of empty solo walks).

Three waves remain from the original plan, all small.

### Wave 8 — Streaks + routine dots
- Ensure a completed solo walk (even with no reflection) counts toward the daily walking streak and lights up today's dot on the homepage routine strip.
- Verify the streak query includes `walk_sessions` where `kind = 'solo'` and `status = 'completed'`, not just walks with journal content.
- No new tables; adjust the existing streak/dots selector only.

### Wave 9 — Stale + edge-case handling
- 12h stale banner already shown; add a one-tap "End now" that calls `completeSoloWalk` using the server-computed duration, and "Discard" that calls `abandonSoloWalk`.
- Handle the "already has active session" error from `startSoloWalk` by routing the user into the existing active session instead of surfacing a raw error.
- Confirm idempotency: double-tapping Start or Finish cannot create duplicates or corrupt duration.

### Wave 10 — QA pass
- `tsgo --noEmit` + production build.
- Playwright: start → wait → finish → saved; verify session appears in Journal, streak/dot updates, no public/discover/group leakage, composer hidden during walk, Radio picker respects Free/Plus entitlement.
- Verify unauthenticated users are redirected and that solo walks never appear on public profiles or group feeds.

### Out of scope (still deferred)
Pause, GPS/route tracking, step counting, photo uploads, mood/weather, sharing, notifications.

### Technical notes
- Duration stays server-owned (`ended_at - started_at`); client never sends elapsed time.
- Single-active-session invariant is enforced by the existing partial unique index; client should treat the conflict as "resume" not "error".
- All new UI reuses existing components — no new dependencies.

Want me to proceed with Waves 8–10, or is there something you'd add/cut first?
