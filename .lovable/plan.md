## 1. Map renders blank inside the active walk

The map controls (crosshair, expand, recenter) appear, so `WalkLiveMap` mounts — but the canvas is empty. Two likely causes:

- Initial container has the right height (`h-56`) but the lazy-loaded map mounts before the section is in its final layout, and our existing `requestAnimationFrame(resize)` fires once. The "Hide map" toggle remounts the section, which is when MapLibre needs another nudge.
- When `points` is empty, we never call `easeTo`, so the camera stays at a fallback `[-74, 40]` (NYC) — which on the warm style can render as a near-blank cream tile in many regions.

**Fix in `src/components/walk-live-map.tsx`:**
- When `walkerCoords` (passed in via a new `center` prop from the shell) exists at init, center on it instead of the NYC fallback.
- Add a `useEffect` that calls `m.easeTo({ center: [walkerCoords] })` whenever the coords first arrive even if `points` is empty.
- Add one more `m.resize()` on the map's `idle` event (first frame), and trigger a resize when the parent toggles `showMap` back on (already covered by ResizeObserver, but add an explicit `setTimeout(resize, 50)` after mount).

**Fix in `src/components/active-walk/active-walk-shell.tsx`:**
- Pass `walkerCoords` down as a new `center` prop to `WalkLiveMap` so the initial center is the user's location, not NYC.

## 2. Motion sensor button is too prominent / persistent

Today the "Enable motion sensor for steps" pill shows whenever `motion.permissionState === "needed"` (always, on iOS, until granted). It pulls focus even when GPS is producing perfectly good step estimates.

**New flow** (in `src/routes/walk.active.$id.tsx`):
- Treat motion as a **silent fallback**, not a default capture method.
- Hide the nudge entirely when `gps === "live"` AND `gpsSteps > 0` — GPS-derived steps are good enough.
- Only surface the nudge when one of these is true after a 30s grace period:
  - `gps === "denied"` or `gps === "weak"` after 30s, OR
  - `gps === "live"` but cadence stays at 0 after 90s of walking (GPS has fix but isn't producing motion).
- Move the nudge's visual weight down: replace the chunky bordered pill with a small inline link directly under the STEPS stat in `WalkStatTrio` (subtle muted-foreground, underlined, "Tap to also count steps via motion"). Tap → calls `motion.request()`. Auto-dismiss when granted/denied or when conditions clear.
- Once tapped (granted or denied), never show again for that session (track in a ref).

**Files touched:** `src/routes/walk.active.$id.tsx`, `src/components/active-walk/walk-stat-trio.tsx` (accept optional `stepsHint?: ReactNode` slot under the steps cell).

## 3. Replace the journal pill with an always-open inline composer

The current `WalkNotesPill` collapses to a tiny dot after 8s, which is what the user sees in screenshot 3. They want an open invitation — visible composer, low friction.

**New component:** `src/components/active-walk/walk-journal-composer.tsx`
- Always-visible card (rounded-2xl, soft border, card bg) that sits where the utility row sits today.
- Top: small "JOURNAL · this walk" eyebrow + lock icon + "saved here only until you end the walk" subtext.
- Body: a `<textarea>` with placeholder _"jot a thought… it stays with this walk."_ — auto-grow up to ~4 lines, debounced auto-save (400ms) into the same `walkNotes` array used today.
- Below textarea: tiny chip row of saved notes (timestamp + first ~24 chars), tap a chip to delete with confirm — same shape `WalkNote[]` so end-walk flow keeps working unchanged.
- Right-side small buttons: 📷 add photo (reuses `compressImage` from `walk-notes-sheet.tsx`, exported), and a count badge for photos.
- No sheet, no expand/collapse — just the open composer.

**Files touched:**
- Create `src/components/active-walk/walk-journal-composer.tsx`.
- Export `compressImage` from `src/components/walk-notes-sheet.tsx` (keep the existing `WalkNotesPill` export for now in case other places use it; we'll check and remove if unused).
- In `src/routes/walk.active.$id.tsx`, swap `WalkNotesPill` in `utilityRow` for `<WalkJournalComposer …/>`. Move it out of the centered chip row and render it as its own full-width section above the action bar.

## 4. Smooth blend at the bottom (action bar meets page)

Today `WalkActionBar` uses `border-t border-border glass` — a hard hairline + frosted background that looks like a seam against cream when the page is scrolled to the bottom (screenshot 4).

**Fix in `src/components/active-walk/walk-action-bar.tsx`:**
- Drop the `border-t`.
- Add a 24px tall pseudo-bar above the action bar that fades from `transparent` → `var(--background)` so content fades into the bar instead of butting against a line. Implemented as a sibling absolutely-positioned `<div aria-hidden>` with `bg-gradient-to-b from-transparent to-background` sitting at `-top-6 left-0 right-0 h-6`.
- Keep `glass` only on md+ (where it visually works); on mobile use `bg-background` so there's no frosted seam at the bottom.

## 5. Smooth blend at the top (header meets meta row)

Same problem at the top in screenshot 5: `border-b border-border/60 glass` makes a visible seam under the sticky header when the green hero scrolls behind it.

**Fix in `src/routes/__root.tsx`:**
- Remove `border-b border-border/60` from both mobile `<header>` instances (lines 197 and 208).
- Add a 16px gradient strip below the header (`absolute -bottom-4 left-0 right-0 h-4 bg-gradient-to-b from-background/90 to-transparent pointer-events-none`) so content fades under instead of meeting a hairline.
- Keep `glass` for blur — it's the hairline that's the issue, not the blur.

## Out of scope

- No changes to walk types/business logic, end-walk flow, or RLS.
- No new dependencies.
- `WalkNotesPill` stays exported for backwards compat; we just stop using it on the active walk page.
