# World-Class Pass — Revised

Tighten what exists, lean into mobile where it matters, and add one new primitive: **quick walk notes**. No gesture-feature creep.

---

## 1. Home as a Living Surface

- **Hero unification.** Collapse `HeroGradient` + `WeeklyRing` + `LiveNowStrip` into one above-the-fold "Today" stage. Ring sits inside the gradient; live-now becomes a single softly-animated line ("3 walking now · join one").
- **One primary CTA.** Replace the four mode buttons with a single **"Begin walk"** pill that opens the existing drawer. Mode selection moves *into* the drawer as a segmented control (uses existing `ToggleGroup`).
- **Now & Next promoted** to directly under the hero — the app's heartbeat. Today it's buried.
- **Mood Cloud → ambient header.** When a recent reflection exists, render `MoodCloud` faintly behind the hero copy instead of as its own card.

Net: one card removed, calmer first paint, fewer decisions before motion.

---

## 2. Active Walk: Cinematic Mode

- **Wake Lock** already exists for audio walks — extend it to all walks.
- **Big-number typography.** Elapsed time as the hero (already mostly there — finish the type ramp).
- **Live route sparkline** continues to use the in-progress points (already wired); add a faint full-bleed bottom strip so the path stays visible as you walk.
- **Floating action cluster.** Pause / End / `AmbientPill` collapse into one bottom cluster. Frees the screen.
- **Status-bar tint** already in place — verify dark mode parity.

---

## 3. NEW: Quick Walk Notes (the headline feature)

A private, mid-walk notepad that attaches everything you wrote to the walk's journal entry on completion. Built almost entirely from existing primitives.

**Behavior**
- A small **"Note"** pill in the active-walk control cluster (paper icon). Tap → bottom `Sheet` opens with a single `Textarea`, big touch target, autofocus, keyboard-aware (uses existing `useKeyboardInset`).
- "Save & close" or swipe-down dismiss → note is added to a local list and the sheet closes for privacy. A subtle counter on the pill ("Note · 3") shows how many you've captured.
- Long-form is fine, but the design encourages short captures — each note becomes its own timestamped fragment ("00:14:22 · the light through the trees").
- Notes are **kept entirely client-side during the walk** (in-memory + `sessionStorage` backup so a refresh doesn't lose them). Never sent over the wire mid-walk.
- On **End walk**, notes are concatenated (with timestamps) into the existing `reflection_note` field — or, if the user already wrote a reflection, appended below it under a "Captured along the way" heading. Zero schema changes.
- Tapping the pill again reopens the same note pad to keep adding.

**UI details**
- Sheet has a paper-feel tint (cream surface token) — distinguishes it from the walking screen.
- Each saved fragment shows in a small scrollable list above the input, oldest at top, with the elapsed-time badge.
- Swipe a fragment left to delete (uses existing radix sheet patterns; no new gesture libs).
- Optional one-tap voice dictation via the platform mic button on iOS/Android keyboards — no extra code, just `inputMode` hints.

**Why it matters**
- Captures the actual reason people walk: thoughts surface in motion. Today they evaporate before End-of-Walk reflection.
- Privacy by default — pop open, pop closed.
- End-walk reflection becomes richer with zero extra work.

**Scope**
- ~1 new component: `walk-notes-sheet.tsx` (~120 lines).
- ~10 lines added to `walk.active.$id.tsx` to mount the pill + merge notes into `reflection_note` on save.
- No DB migration. No new RLS. No new dependencies.

---

## 4. Journal: from List to Memory

- **Sticky month headers** with the week's mood gradient bleeding into the divider (uses `MoodCloud` color logic).
- **`view-transition-name`** on entry cards → smooth iOS-style hero transition into a full-screen entry view. Pure CSS in 2026 browsers.
- **Search** via existing `Input` at top, debounced filter on note text. Five lines, big utility.
- Surface walk notes nicely: when a journal entry has the "Captured along the way" block, render it as a quoted timeline within the card so the moments shine.

---

## 5. Design System Tightening

- Sweep components for `text-white`, `bg-black`, raw hex → semantic tokens.
- Add two motion presets in `styles.css` (`--ease-out-soft`, `--ease-spring`) and standardize sheet/drawer/pill animations.
- Type scale: collapse to 3 sizes (display / title / body).
- Dark-mode pass on every route, especially gradient + glass surfaces.

---

## 6. Cutting-Edge 2026 Capabilities (small adds, high signal)

- **Wake Lock** on all walks (above).
- **View Transitions API** for journal entry → detail.
- **Scroll-driven CSS animations** on hero parallax (zero JS).
- **`navigator.share()`** on completed walks (existing native share sheet).
- **App Badging API** for unread inbox count — `inbox-bell.tsx` already tracks it.

---

## 7. Explicitly NOT included

- No swipe-to-begin, long-press tab bar, or edge-swipe back. (Per your call — gesture overkill.)
- No new routes, tables, or dependencies.
- No streaks/notification spam.
- No AI features in this pass.

---

## Files touched

Edited (~9): `src/routes/index.tsx`, `src/routes/walk.active.$id.tsx`, `src/routes/journal.tsx`, `src/components/hero-gradient.tsx`, `src/components/now-and-next.tsx`, `src/components/route-sparkline.tsx`, `src/components/mobile-tab-bar.tsx` (minor), `src/styles.css`, plus a small token sweep in `ui/`.

New (1): `src/components/walk-notes-sheet.tsx`.

---

## Suggested execution order

1. Walk notes (highest user value, fully isolated).
2. Active walk polish + Wake Lock everywhere.
3. Home recomposition.
4. Journal view-transitions, search, and notes rendering.
5. Design-system sweep + motion presets.
6. 2026 API sprinkle.

Each step ships independently. We can do all six in one pass or stop after any step and feel the upgrade.
