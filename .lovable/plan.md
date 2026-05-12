## Scope

Three small passes. Nothing on Home structure, Groups, or the active walk screen.

1. Walk Composer — light UI polish + copy cuts. Walk creation only.
2. Center FAB — long-press opens Walk & Talk.
3. Live Activity pill — Dynamic-Island-style replacement for `NowPlayingBar`, walk-in-progress only.

---

## 1. Walk Composer: polish + remove non-walk rows

Composer is for starting a walk. Nothing else.

Changes (surface only — same flow, same height, same mood/weight/intention rows):

- Remove the **Add to home screen** row entirely. Install lives elsewhere; not the composer's job.
- Remove the italic preface line under the title (`MODE_PREFACE`).
- Remove the secondary "skip the rest, just walk" link under the CTA.
- Tighten copy on the remaining rows (see §4).
- Bump the gap between the mode grid and the friend rows from `space-y-5` to `space-y-6` so the eye groups them apart.
- Mode tiles, mood cloud, weight bar, intention textarea, footer CTA: unchanged.

Files: `src/components/walk-composer/walk-composer.tsx` (~30 LOC removed, 0 added). Drop the `usePwaInstall` import + `pwa` block.

---

## 2. Center FAB: long-press → Walk & Talk

Add a ~480ms long-press handler to the center button in `mobile-tab-bar.tsx` using the same pattern `StartCta` uses on Home.

- **Tap** → `composer.open()` (unchanged)
- **Long-press** → `haptics.success()` + `composer.open({ type: "audio" })`

Composer already accepts `{ type }` and pre-selects the matching tile. No new component.

Files: `src/components/mobile-tab-bar.tsx` (~15 LOC added).

---

## 3. Live Activity pill — confirms your read

Yes — exactly that. The pill is the **minimized state of the active walk**: when a walk is running and the user navigates away (Home, Journal, Groups), this pill is what lets them keep the walk visible and tap back in. It replaces the current `NowPlayingBar` (which already does this job, just less elegantly).

Behavior:

- Mounted once in `__root.tsx` (replaces `<NowPlayingBar />`).
- Reads the same data the current bar reads: active `walk_sessions` row + (if present) the user's `audio_room_participants` row for room title and live count.
- Renders a compact pill ~8px below the status bar, centered, glass background with forest tint, springs in/out.
- Content: live dot · timer · room title (when in a pod) · 👥 count (when in a pod).
- **Tap → `navigate({ to: "/walk/active/$id", params: { id } })`** — back to the full walk screen.
- Hidden on `/walk/active/*` (the on-screen dock owns it there).
- No "friend walk soon" state. Only the active-walk minimized state.
- Optional: swipe-up collapses to a tiny bean (icon + timer); tap re-expands. State in `sessionStorage` so it doesn't bounce back.

Net: delete `now-playing-bar.tsx` (121 LOC), add `live-activity-pill.tsx` (~110 LOC).

Files: new `src/components/live-activity-pill.tsx`, edit `src/routes/__root.tsx` (one import swap), delete `src/components/now-playing-bar.tsx`.

---

## 4. Copy pass

User's lines locked in. Remaining sweep stays minimal.

| Old | New |
|---|---|
| "Walking alone still counts." | (removed with preface) |
| "A gentle voice in your ear." | (removed) |
| "You'll be matched once you start moving." | (removed) |
| "Real people, real sidewalks." | (removed) |
| "spin up a private room — drop the link in your story" | "share a link, walk together" |
| "pick a time later this week — share the invite now" | "pick a time, send the invite" |
| "skip the rest, just walk" | (removed) |
| "Show up however you can." | **"Start today."** |
| "Eight minutes is enough — your body knows." | **"Start with 5 minutes."** |
| "Your first walk is the hardest. Five minutes around the block counts." | **"A lap around the block counts."** |
| "Two days in a row feels good." | "two days in a row." |
| "Walk in progress · 12:04 on your feet…" | "walking · 12:04" |
| "tap to return" pill | "return" |

Rule: cut adjectives, cut hedges, cut em-dash explainers, prefer one short clause.

Files touched for copy only: `src/components/walk-composer/walk-composer.tsx`, `src/routes/index.tsx` (microState strings), new `live-activity-pill.tsx`.

---

## Out of scope

- Home, Groups, active walk screen — untouched.
- Composer structure, rows, defaults, accordions.
- Live Activity states beyond active walk.
- Auth, billing, friend-walk creation, guided audio internals.

---

## Files touched

**New (1)**
- `src/components/live-activity-pill.tsx`

**Edited (4)**
- `src/components/walk-composer/walk-composer.tsx` — drop preface, install row, secondary link; copy cuts; spacing nudge
- `src/components/mobile-tab-bar.tsx` — long-press → Walk & Talk
- `src/routes/__root.tsx` — swap `NowPlayingBar` for `LiveActivityPill`
- `src/routes/index.tsx` — microState copy only

**Deleted (1)**
- `src/components/now-playing-bar.tsx`

---

## Order

1. Composer polish + copy cuts (incl. install row removal).
2. FAB long-press.
3. Live Activity pill swap.
4. Home microState copy sweep.

Each step ships independently.
