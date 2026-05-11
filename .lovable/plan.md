## Goal

Today there are two completely different "pick a walk" UIs:

1. **Polished composer** — the `PreWalkSheet` defined inside `src/routes/index.tsx`. Opens from the big *Start a walk* button, the *Other ways to walk* pills, the *Comeback* nudge, and the *Live now* strip. It chains through mode → mood cloud → weight → intention → guide picker, then actually creates the `walk_session` row and routes to `/walk/active/$id`.
2. **Half-broken drawer** — the *Choose your walk* sheet in `src/components/mobile-tab-bar.tsx` triggered by the center shoes FAB. Its mode buttons are plain `<Link to="/">` tiles that just close the drawer and dump you on Home — they never start a walk. Friend Walk + Schedule + PWA install live here too.

We'll collapse #2 into #1 so there is exactly one composer, reachable from every entry point including the FAB.

## What gets built

### 1. Promote `PreWalkSheet` to a shared component

- Move the `PreWalkSheet` JSX (currently lines 359–446 of `src/routes/index.tsx`) into a new file `src/components/walk-composer/walk-composer.tsx`.
- Move the supporting state + `beginWalk` + `openSheet` + `handleSheetChange` + `proceed` logic out of `HomeRoute` into a `useWalkComposer()` hook in `src/components/walk-composer/use-walk-composer.tsx` so the same controller can be mounted once and triggered from anywhere.
- Expose a tiny imperative API via a `WalkComposerProvider` mounted in `__root.tsx` (or in the authed layout, wherever auth context already sits):
  ```ts
  const { open } = useWalkComposer();
  open({ type: "solo" }); // or "audio" | "guided_solo"
  ```
- The provider renders **one** `<WalkComposer />` instance + the existing `FriendWalkScheduleSheet` + `FriendWalkShareCard` so Friend Walk creation/scheduling state lives in one place too.

### 2. Add Friend Walk rows inside the composer

The current mode grid in PreWalkSheet only shows Solo / Walk & Talk / Guided. To preserve everything the FAB drawer offered, extend the composer's first screen with two additional rows below the mode grid:

- **Friend Walk · share a link** — same gradient clay tile, calls `createFriendWalk` then opens `FriendWalkShareCard`.
- **Schedule a Friend Walk** — opens `FriendWalkScheduleSheet`.
- **Add to home screen** — only when `usePwaInstall().canInstall`.

These already exist in `mobile-tab-bar.tsx` (lines 128–171) — we lift them as-is into the composer body so both entry points show them.

### 3. Rewire the FAB

In `src/components/mobile-tab-bar.tsx`:

- Delete the local `Drawer`, `ModeButton`, `sheetOpen` state, and the friend-walk/schedule/share state (now lives in the provider).
- The center button's `onClick` becomes `() => { haptics.tap(); composer.open(); }` — no preselected type, lands on the mode grid.
- Keep the live-count pulse ring + badge exactly as today.

### 4. Rewire HomeRoute

In `src/routes/index.tsx`:

- Replace local `sheetOpen / walkType / feeling / moodScore / intention / pickGuide / busy` state and the `<PreWalkSheet ... />` render with `const composer = useWalkComposer();`.
- `StartCta` → `composer.open({ type: "solo" })`.
- Long-press on `StartCta` → `composer.open({ type: "solo", focus: "mode" })` (same as tap for now; long-press hook stays).
- *Other ways to walk* pills → `composer.open({ type: "guided_solo" | "audio" })`.
- `ComebackNudge` and `LiveNowStrip` → same pattern with their existing types.

### 5. Visual polish on the unified composer

The screenshot shows the FAB drawer's grid is more spacious (2-col, larger tiles with circle icons) than the current 3-col strip in PreWalkSheet. We adopt the better-looking 2-col layout for the mode tiles inside the composer:

```text
┌──────────────┬──────────────┐
│ ● Solo       │ ● Walk & Talk│
│ Just me…     │ Match a pod  │
├──────────────┼──────────────┤
│ ● Guided     │ ● Local Walk │
│ A voice…     │ Sidewalks    │
└──────────────┴──────────────┘
[ Friend Walk · share a link  NEW ]
[ Schedule a Friend Walk          ]
[ Add to home screen     (if PWA) ]
```

Local Walk becomes a 4th tile that closes the composer and navigates to `/events` (today it's a small text link inside the composer plus a pill on Home — both keep working).

Below the grid the existing mood-cloud → weight → intention → CTA flow stays unchanged. Header copy stays *"Start a walk / Choose how you want to walk"*.

### 6. Cleanup

- Delete `ModeButton` from `mobile-tab-bar.tsx`.
- Drop the now-unused `MODE_PREFACE` map only if no longer referenced (keep if still used in header copy).
- No DB / server-fn changes; no route changes.

## Out of scope

- No changes to `/walk/active/$id` or the in-walk Journal composer.
- No changes to mood cloud, weight bar, or guide picker internals.
- No analytics/event renaming.

## Files touched

- **new** `src/components/walk-composer/walk-composer.tsx`
- **new** `src/components/walk-composer/use-walk-composer.tsx` (provider + hook)
- **edit** `src/routes/__root.tsx` — mount `<WalkComposerProvider>` inside the auth context
- **edit** `src/routes/index.tsx` — remove local PreWalkSheet + state, call `useWalkComposer().open(...)`
- **edit** `src/components/mobile-tab-bar.tsx` — remove drawer + ModeButton, FAB calls `composer.open()`
