# Solo Walk V1 — Private Routine Loop

Restore the smallest dependable private walking loop: Start → optionally listen to Radio → End → optionally reflect → walk counts toward routine + appears in Journal. Free and Plus. No pause, no GPS, no photos, no new player.

Existing schema already supports it: `walk_sessions` has `walk_type` (default `'solo'`), `status` (default `'active'`), `started_at` (default `now()`), `mood_before/after`, `intention`, `reflection_note`, `reflection_prompt`, `duration_seconds`. No new columns required. Homepage `today-island` already counts completed walks toward the weekly dots; Journal feed already reads `walk_sessions`.

## Waves

### Wave 0 — Audit (no code)
Confirm supported `walk_type`/`status` values and existing RLS for `walk_sessions`; verify no trigger increments event/host counters from solo rows; check for existing duplicate active solos before adding a unique index. Deliverable: short note in PR body.

### Wave 1 — `src/lib/solo-walk.functions.ts`
Auth + eligibility-middleware server functions returning a normalized `SoloWalkSession`:
- `getActiveSoloWalk()` → newest own row where `walk_type='solo' AND status='active'`, else null.
- `startSoloWalk({ moodBefore?, intention? })` → if active exists return `{ session, resumedExisting: true }`; else insert `user_id=auth.uid, walk_type='solo', status='active', event_id=null`; trim/validate mood + intention.
- `completeSoloWalk({ id, moodAfter?, reflectionNote?, reflectionPrompt? })` → ownership + solo + active check; server-computed `ended_at=now()`, `duration_seconds = extract(epoch from now()-started_at)`; idempotent (already-completed returns the row).
- `abandonSoloWalk({ id })` → sets `status='abandoned', ended_at=now()`; never deletes.
All race-safe: catch unique-index violation and return the existing active session.

### Wave 2 — Migration: single active solo per user
1. Find + mark older duplicate active solos as `abandoned` (preserve newest).
2. `CREATE UNIQUE INDEX one_active_solo_walk_per_user ON public.walk_sessions (user_id) WHERE status='active' AND walk_type='solo';`
3. Review/tighten RLS so users can only select/insert/update their own rows; solo rows stay private.
4. Regenerate Supabase types.

### Wave 3 — `/walk` route (replace redirect)
Rewrite `src/routes/_authenticated/walk.index.tsx` with states `loading | ready | active | finish`. Loader calls `getActiveSoloWalk`; elapsed time derives from `started_at` (no client-authoritative timer). LocalStorage stores only an unsaved reflection draft keyed by session id.
- **Ready**: title, one-liner, big `Start walking`, optional mood + intention (visually secondary), optional `Walk with Radio` picker.
- **Active**: elapsed clock, `Reflect` (inline expandable textarea, autosaves to localStorage), `End walk`, `Discard`.
- **Stale (>12h)**: show "Finish it / Discard it" instead of silently creating another.
- **Finish**: duration, optional mood-after, optional "What is worth keeping?", `Save walk` (disable while pending; preserve draft on error; idempotent retry).
- **Saved**: brief confirmation with `Back home` / `View journal`; invalidate home + journal + profile-stats queries.

### Wave 4 — Composer entry point
`src/components/mobile-tab-bar.tsx`: composer actions in order — `Write a reflection` (→ /journal), `Walk now` (→ /walk), `Plan a walk` (→ /walk/new). Remove `const isWalk = false`; add `/walk` to compose-hidden prefixes so the FAB doesn't overlap the walk controls. Signed-out/ineligible follow existing prompts.

### Wave 5 — Homepage integration (`today-island.tsx`)
Primary action becomes `Start a solo walk` with subcopy "Private timer · counts toward your routine"; secondary row keeps `Post a walk` + `Groups`. Rename existing `activeWalkId` → `activeSoloWalk` (filter to `walk_type='solo' AND status='active'`); when present, primary CTA becomes `Resume walk · N min` linking to `/walk`. Weekly dots/streak continue using existing completed-session logic — no solo-specific math.

### Wave 6 — Radio picker (reused entitlement)
Extract shared helper (`useStartRadioStation` or small `RadioQuickPicker`) used by both `radio-rail` and the walk ready screen. Compact list of active stations + `No audio`. No hidden `<audio>`, no queue, no autoplay. Uses existing `usePlayer`, free-limit + Plus checks, global Now Playing dock. Starting/ending a walk does not touch Radio playback or usage accounting.

### Wave 7 — Journal integration
In `src/lib/journal-entries.functions.ts` / `entries-feed.tsx`, adjust the "meaningful content" filter so a completed row is shown when `walk_type='solo' || hasReflection || hasMood || hasPhotos`. Minimal card: "Solo walk · 24 minutes · Today at 4:40 PM"; reflection text renders below when present. No duplicate `journal_entries` row — reflection stays on `walk_sessions`. Free users save reflections (no Plus gate).

### Wave 8 — Privacy/entitlement review
Verify solo rows never surface in Discover/Nearby/profiles/groups/notifications/sitemap. Same adult-eligibility middleware as other participation flows. No changes to Plus pricing, Radio allowances, event/host counters. Grep for triggers or aggregate queries that might pick up solo rows and confirm none do.

### Wave 9 — Lightweight analytics
Reuse existing event-log if present: `solo_walk_started/resumed/completed/abandoned`, `radio_started_from_solo_walk`. Properties limited to duration bucket, entry surface, boolean flags. Never log reflection/mood/intention/location/URLs. Analytics failure never blocks the walk.

### Wave 10 — QA + `npm run lint && npm run build`
Run the adversarial matrix from the brief (double-clicks, two tabs, refresh mid-walk, 12h stale, cross-user completion attempts, ineligible/signed-out starts, Free radio limit, offline save retry, keyboard/screen reader, safe-area). Fix all lint/build errors before moving on.

## Rollout
Simple `SOLO_WALK_ENABLED` config flag (no new framework). Admin-only → full rollout. When disabled: hide entry points; existing history stays; active sessions still resumable via `/walk` direct link.

## Technical notes
- Do not edit generated router files.
- No new tables, no new streak logic, no second audio player.
- Duration always server-computed from timestamps; client only displays `now - started_at`.
- Idempotency: `startSoloWalk` returns existing active; `completeSoloWalk` returns already-completed row; unique-index race returns the winning row.
- Reflection draft: `localStorage["solo-walk-reflection:{sessionId}"]`, cleared after save/abandon.
