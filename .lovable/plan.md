# Solo Walk V1: Timer, Radio, Private Journaling

Scope is a refinement of the existing single-route Solo Walk. No new DB migration is needed — `walk_sessions` already carries `walk_type`, `status`, `started_at`, `ended_at`, `duration_seconds`, `reflection_note`, `reflection_prompt`, `mood_after`, and single-active is already enforced. `RadioQuickPicker` already exists and is reused as-is. Nothing new is stored beyond what the current schema supports.

## Wave 1 — Server-authoritative End
- `src/routes/_authenticated/walk.index.tsx`: `onEndClick` calls `completeSoloWalk` immediately with the current reflection draft; only after success set `session` to the returned completed row and transition to `finish`. Show `Ending…` while pending; disable End.
- Remove the "Back to active" button on the finish screen. Once ended, the walk is ended.
- `completeSoloWalk` is already idempotent (returns the row when already completed) and already ignores client-supplied duration. No server change needed for this wave.

## Wave 2 — Hard 4-hour timeout
- New `src/lib/solo-walk.constants.ts` exports `SOLO_WALK_MAX_SECONDS = 4 * 60 * 60`.
- Client timer: always `Math.min(Date.now() - startedAt, SOLO_WALK_MAX_SECONDS)`. Refresh on `visibilitychange` and window `focus`. Keep the 1s interval as a display refresh only.
- Add UI state `timed_out`. When elapsed reaches the cap, stop advancing, show the "Timer stopped" copy, and offer **Finish walk** (calls `completeSoloWalk`) and **Discard** (existing abandon).
- `src/lib/solo-walk.functions.ts` → `completeSoloWalk.handler`: cap `duration = min(nowMs - startedMs, MAX)`; write `ended_at = new Date(startedMs + duration*1000).toISOString()`. Import the shared constant. This also protects against a stale/direct request.
- Delete the 12-hour "stale" banner; replaced by the timed_out state.

## Wave 3 — Page composition
Single-column, `max-w-md`, mobile-first, cream/forest tokens. Three visible states:

- **Ready:** eyebrow `SOLO WALK` → h1 tagline → subcopy `A short walk still counts.` → primary `Start walking` → below it a labelled `RADIO — OPTIONAL` block with `<RadioQuickPicker />`.
- **Active:** eyebrow `Walking` → giant serif `tabular-nums` timer as the visual center → `RADIO` module (see Wave 4) → `JOURNAL` collapsible (Wave 5) → sticky bottom action zone with `End walk` and a small secondary `Discard`.
- **Timed out:** same header, timer frozen at cap, copy block, two actions.

The sticky End container is `sticky bottom-0` with `pb-[env(safe-area-inset-bottom)]` and enough bottom padding on `<main>` so it clears the mobile tab bar and the Now Playing dock.

Replace `window.confirm` for Discard with a shadcn `AlertDialog` using the copy in the brief.

## Wave 4 — Compact Radio module in-walk
Reuse the existing `RadioQuickPicker` (no duplication of entitlement/usage/paywall). Extend it with an optional variant to render the "now playing from Radio" strip when appropriate. Concretely:

- Add a small `<RadioActiveStrip />` sibling that reads `usePlayer()` and renders only when `player.current?.id?.startsWith("radio:")` — showing title/subtitle plus Play/Pause (via `player.toggle()`) and a "Change station" button that scrolls/reveals the quick-picker chips.
- Never autoplay; a station only starts on tap (already true in `RadioQuickPicker`).
- Never stop Radio when the walk ends or the route unmounts — do not touch `player.stop()` in end/abandon flows.
- Radio errors surface via the existing `toast.error` inside `RadioQuickPicker`; the walk timer is independent.

## Wave 5 — In-walk journaling
- Active state: a compact `Journal` section, collapsed by default with a `Write a note` button. When expanded, show single stable prompt "What is worth keeping?" and a `<textarea>` bound to the existing `reflection` state.
- Continue the existing session-scoped localStorage draft (`solo-walk-reflection:{sessionId}`). No debounced DB writes during the walk.
- `onEndClick` passes the current draft to `completeSoloWalk` (already the shape). Only clear localStorage after the server returns a completed session with `reflection_note` matching (or after any successful `saveSoloWalkReflection` from the finish screen).
- No new `journal_entries` row; the Journal feed already reads `walk_sessions`.

## Wave 6 — Finish state
- Header: `SOLO WALK` / `You walked for {fmtMinutes(session.duration_seconds)}.` / `Everything below is optional.` — **duration reads from the completed server session, never from the clock.**
- Fields: `How are you leaving?` (mood_after) and `What is worth keeping?` (reflection_note). Single primary `Save & close`; no Back button.
- New server fn `saveSoloWalkReflection` in `src/lib/solo-walk.functions.ts`:
  - `.middleware([requireSupabaseAuth])`, input `{ id: uuid, moodAfter?: string, reflectionNote?: string }`.
  - Verifies ownership, `walk_type = 'solo'`, `status = 'completed'`.
  - Updates only `mood_after`, `reflection_note`, and sets `reflection_prompt = 'What is worth keeping?'` when reflection is non-empty (else NULL).
  - Idempotent; returns the updated row.
- On success: invalidate `home`, `profile-stats`, `journal` queries, clear the local draft, toast `Walk saved. Today counts.`, `navigate({ to: "/" })`.

## Wave 7 — Loading, recovery, errors
- Add `error` UI state. If the initial `getActiveSoloWalk` throws, show `Could not check your walk` with `Try again` (retries the fetch) and `Return home`. Do NOT fall back to Ready on error.
- On successful load: `null` → ready; active + elapsed < cap → active; active + elapsed ≥ cap → timed_out. Restore local draft when an active/timed_out session is recovered.
- Start remains idempotent (server already returns existing active).
- If a completion request errors after the server actually completed the row (network drop), a retry hits the idempotent path and returns the completed session; UI enters finish. Reflection save failures leave the draft in localStorage.
- Radio failures never mutate the walk state.

## Wave 8 — Accessibility & mobile
- Timer wrapped in `aria-live="off"`.
- A visually hidden `aria-live="polite"` status region announces `Walk started`, `Timer stopped`, `Walk ended`.
- Labelled controls, `aria-pressed` on the Radio Play/Pause, `<label htmlFor>` on mood and reflection inputs, `aria-expanded` on the Journal disclosure.
- All tap targets ≥ 44px; buttons keep `focus-visible` rings.
- `prefers-reduced-motion` disables the motion.section entrance.
- Layout verified at 390px; sticky End sits above tab bar + dock via `env(safe-area-inset-bottom)`; no wake-lock.

## Wave 9 — QA
Manual pass through the brief's timer / Radio / journal / privacy / regression matrix. After each wave: `npm run lint && npm run build`, fix errors from that wave before moving on.

## Files touched
- `src/routes/_authenticated/walk.index.tsx` — state machine, timer math, timed_out, sticky End, journal disclosure, error state, a11y, AlertDialog for Discard.
- `src/lib/solo-walk.functions.ts` — 4h cap in `completeSoloWalk`; new `saveSoloWalkReflection`.
- `src/lib/solo-walk.constants.ts` — new; `SOLO_WALK_MAX_SECONDS`.
- `src/components/radio/radio-quick-picker.tsx` — optional in-walk "now playing" strip (or a small sibling component in the same file).

## Not doing
No migration, no new tables, no wake-lock, no GPS/steps/photos, no second player, no separate `journal_entries` row, no new Plus gate on Solo Walk, no autoplay.
