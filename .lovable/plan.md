## Final polish plan

Seven items, grouped by surface. Each is small-to-medium, no schema changes.

### 1. "Start a walk" opens the composer (not solo)
Today the big button on Home jumps straight into a Solo walk. That hides Walk & Talk and Local from new users.

- Rewire both "Start a walk" buttons in `src/routes/index.tsx` (lines 188 + 487) to open a **Walk Composer sheet** instead of starting solo.
- Composer sheet (new `src/components/walk-composer-sheet.tsx`) shows three large choices in one place: **Solo**, **Walk & Talk**, **Local**. Each has a one-line description and a primary CTA.
- The "OTHER WAYS TO WALK" row stays as a quiet shortcut, but the primary path now teaches the three formats.
- Default focus = Solo (one-tap if that's what they want), so we don't add friction for repeat users.

### 2. App must open to Home for signed-in users (persistence)
Currently the app re-shows the marketing landing on every cold open because the auth session hasn't restored yet (and on iOS home-screen apps, localStorage can be evicted).

- Auth IndexedDB backup is already in place (`src/lib/auth-persistence.ts`).
- Add a lightweight **"last known signed-in" flag** in `localStorage` + IndexedDB (`wc_was_authed`). Set on sign-in, clear on sign-out.
- In `src/routes/index.tsx`, while `authLoading` is true **and** the flag is set, render the Home skeleton (already added) instead of ever flashing the marketing landing. Only show the marketing hero once we've confirmed there's no session.
- Net effect: if you've ever signed in on this device, opening the app goes straight to Home — no marketing flash, no welcome modal.

### 3. Paywall copy: lead with Walk & Talk
In `src/components/auth-form.tsx` (line 146) and `src/components/welcome-dialog.tsx` (Plus tile), change:
- From: "Free 30 days · then $4.99/mo · Local Walk RSVPs"
- To: "Free 30 days · then $4.99/mo · Unlimited Walk & Talks + Local RSVPs"
Mirror the same positioning in `PlusCheckout` headline copy so Walk & Talk is the hero benefit everywhere.

### 4. "Save to journal" button — fix tap target
In `src/components/end-walk-flow.tsx`:
- Increase the button to full-width on mobile, min-height 56px, larger font.
- Wrap with `touch-action: manipulation` and remove any parent that's intercepting taps (the circled area in the screenshot suggests a transparent overlay — audit the ending screen container for stray `pointer-events`).
- Add a subtle pressed-state (`active:scale-[0.98]`) so the user gets feedback on first tap.

### 5. Flip the heaviness meter
In the arrival/reflection meter (the "HOW HEAVY DOES IT FEEL?" component — likely `src/components/reflection-drift.tsx` or end-walk flow):
- Swap labels and value mapping so **LIGHT is on the left, HEAVY on the right**. This matches the universal "low → high" reading direction and how sliders behave elsewhere in the app.
- Keep stored values consistent (remap on save so historical data still aligns).

### 6. On-walk screen: GPS path + map polish
In `src/components/walk-live-map.tsx` and the active walk route (`src/routes/walk.active.$id.tsx`):
- **Z-index fix**: ensure the live route polyline renders **above** the map tiles and below only the user puck. The current overlay (the dark green stats panel) sits on top of the map area — reduce its opacity to ~70% with a soft blur, or move it to a true bottom sheet so the map breathes.
- **Smoothing**: add a simple GPS smoother — drop points with `accuracy > 25m`, require min movement of ~3m between points, and apply a 3-point moving average before drawing. Result: the line stops looking squiggly.
- **Path styling**: thicker stroke (4px), rounded caps, soft glow using `--forest`, so it reads as a deliberate trail not a debug overlay.

### 7. On-walk screen: unify into one template for all walk formats
This is the bigger one — the current screen feels half-baked because each format (Solo, Walk & Talk, Local, Guided) is improvising its own layout.

Design a **single ActiveWalkShell** component that all formats render inside:

```text
┌─────────────────────────────────┐
│  context chip  ·  weather  ·  safety │   ← top meta row
├─────────────────────────────────┤
│                                 │
│         BIG TIMER               │   ← always present
│       elapsed · GPS state       │
│                                 │
│   pace   ·   miles   ·   steps  │   ← always present
├─────────────────────────────────┤
│   [ format module ]             │   ← swappable slot
│   • Solo:  intention card       │
│   • W&T:   audio dock + pool    │
│   • Local: RSVP roster + ETA    │
│   • Guided: prompt + timer ring │
├─────────────────────────────────┤
│   live map (collapsible)        │
├─────────────────────────────────┤
│   [ Pause ]      [ End walk ]   │   ← sticky action bar
└─────────────────────────────────┘
```

- Extract shared chrome (header, timer, stat trio, map, action bar) into `src/components/active-walk-shell.tsx`.
- Each format passes a `formatModule` prop that fills the swappable slot.
- Action bar is **sticky at the bottom above the tab bar** with safe-area padding, big tap targets, and clear primary/secondary hierarchy (Pause = secondary, End = primary clay color).
- The "On your feet." headline and weather chip move into the meta row so they're consistent across formats.

This refactor also fixes the screenshot's circled bug (the Pause button was clipped behind the tab bar) because the action bar will reserve its own space.

### Order of work
1. Persistence + open-to-Home (item 2) — biggest UX win, smallest change.
2. Composer sheet (item 1) + paywall copy (item 3) + Save-to-journal fix (item 4) + heaviness flip (item 5) — quick polish batch.
3. On-walk shell + map polish (items 6 + 7) — the deeper refactor, done last so it benefits from the cleared decks.

### Out of scope for this batch
- No DB or billing changes.
- No new format types — just unifying the existing four under one shell.
- Marketing landing copy stays as-is.

Reply "go" and I'll start with batch 1.