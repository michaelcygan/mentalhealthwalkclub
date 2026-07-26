## Goal
Collapse the Solo Walk flow into a single, calm page: **Start → Walking (with End) → End (mood + reflection + save)**. Drop the pre-walk optional fields, the intermediate "saved" screen, and the toggle-open reflection during the walk.

## Current friction
- Ready state stacks a big Start button, an "Optional" details section (arriving mood + intention), and a Radio quick picker — feels heavy for what should be one tap.
- Active state has two side-by-side buttons (Reflect / End walk), a collapsible reflection box, and a discard link.
- After saving, users are pushed to a separate "Walk saved." confirmation screen with two navigation buttons.
- Four visible UI states (`ready`, `active`, `finish`, `saved`) for a routine loop.

## Target flow (one page, three phases)

```text
┌─ ready ─────────────┐   ┌─ active ────────────┐   ┌─ finish ────────────┐
│ Title + subtitle    │ → │ Elapsed timer       │ → │ "You walked N min"  │
│ [ Start walking ]   │   │ Intention (if any)  │   │ Mood after (opt.)   │
└─────────────────────┘   │ [ End walk ]        │   │ Reflection (opt.)   │
                          │ (small discard link)│   │ [ Save walk ]       │
                          └─────────────────────┘   └─────────────────────┘
                                                             │
                                                     toast + redirect to /
```

Everything renders inside one card on `src/routes/_authenticated/walk.index.tsx`. Phase transitions animate in place, no route change.

## Changes in `src/routes/_authenticated/walk.index.tsx`

1. **Ready phase — minimal**
   - Keep title, one-line subtitle, and the big **Start walking** button.
   - Remove the `<details>` "Optional" block (arriving mood + intention inputs).
   - Remove the Radio quick picker from this page (Radio is already reachable from the dock/home rail; the walk page shouldn't double as a launcher).
   - `onStart` no longer sends `moodBefore` / `intention`.

2. **Active phase — just the timer and End**
   - Keep the elapsed clock and (if a prior session had one) the intention line for continuity with resumed walks.
   - Remove the "Reflect" toggle button and the inline reflection textarea — reflection lives in the End step only.
   - Keep the small "Discard walk" text link and the stale-session banner (End now / Discard) as-is; those are safety valves, not friction.
   - Single primary button: **End walk**.

3. **Finish phase — reflection lives here**
   - Keep mood-after + reflection inputs, both optional, both labeled as such.
   - "Back" button stays (returns to active) so an accidental tap doesn't lose the walk.
   - **Save walk** completes and, on success, shows a toast ("Walk saved — today counts") and navigates to `/`. No dedicated `saved` screen.

4. **State machine**
   - Drop the `saved` UI state; remove that whole render branch.
   - `UIState = "loading" | "ready" | "active" | "finish"`.

5. **Drafts / resume**
   - Keep the localStorage reflection draft keyed by session id (useful if user closes the tab mid-finish).
   - Keep the "Resumed your open walk" toast when the server returns an existing active session.

## Out of scope
- No server changes. `startSoloWalk` still accepts optional `moodBefore` / `intention`; we just stop sending them from this page.
- No changes to homepage streak dots / Today island / journal integration.
- Radio + audio still available globally via the dock; not removed from the app, only removed from this page.

## Technical notes
- Imports to drop: `RadioQuickPicker`, `RadioIcon`, `Check`, `PenLine`, `Link` (if unused after removing the saved screen — verify), `useMemo` stays for `isStale`.
- Remove state: `moodBefore`, `intention`, `reflectOpen`.
- `onSave` success path: `toast.success("Walk saved — today counts.")` then `navigate({ to: "/" })`.
