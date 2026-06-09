## Journal page — MVP polish pass

Answering the asks directly, then layering on the world-class flourishes.

### 1. Anything left from the revamp?
Functionally, the revamp is complete — feed, tracking, stats, writing flow all landed. What's left is **craft**: compose affordance, iconography, smart units, badge surface, motion. Everything below is that pass.

### 2. Compose button — move out of the floating FAB
Replace the green floating "+" (which collides with bottom nav and looks heavy on mobile) with a **pill in the header**, right-aligned next to "Journal":

```text
Journal                              [ ✎  Write ]
A quiet page for the walking life.
```

- Pill: forest background, small pen icon + "Write", rounded-full, subtle shadow.
- Sticks to the top of the page (no scroll-follow / no FAB).
- Tapping opens the same `ReflectionWriteSheet` it does today.
- Remove the fixed-position `<button>` in `entries-feed.tsx` entirely.

### 3. New streak icon (not a flame)
Flame is overused and slightly aggressive for a mental health surface. Swap to **`Sprout` from lucide-react** in the `clay` color — it matches the brand (walking, growing, gentle), and pairs naturally with "showing up". Used in:
- `tracking-module.tsx` hero number
- anywhere else the flame appears (search confirms only one spot)

### 4. Expanded stats — smart units + badge carousel

**Smart unit formatting** for the lifetime row. New tiny helper `formatDuration(minutes)`:
- `< 60` → `"42 min"`
- `< 24 × 60` → `"3.4 hrs"` (one decimal, drop if .0)
- `< 365 × 24 × 60` → `"12 days"` (walking days equivalent at 24h, or we use 60-min "walking days" — see note)
- `≥ year` → `"1.2 yrs"`

Practical mapping for *walking* minutes: minutes → hours after 60, → days after 24 hrs, → years after 365 days. Same helper applied to the period row (week/month/all) and the lifetime row, so a long-time user sees "2.3 yrs" instead of "1,204,800". Steps logged keeps `toLocaleString()` with a comma.

**Badges metric + carousel** replaces the single "Latest badge" row:

```text
┌─────────┐  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐  →
│   12    │  │🏅│ │🏅│ │🏅│ │🏅│ │🏅│
│ BADGES  │  └──┘ └──┘ └──┘ └──┘ └──┘
└─────────┘
```

- Left: count tile (`12 / BADGES EARNED`), same visual weight as other stats.
- Right: horizontal scroll-snap rail of earned badges, newest first, ~56px circles with icon + tiny name underneath. Edge fade on the right to hint scrollability.
- Tap a badge → opens a small dialog (reuse `@/components/ui/dialog`) showing icon, name, description, earned date, and a "View all" link to `/profile`.
- Pulls from `user_badges` + `badge_definitions` — extend `getJournalStats` to return `badges: { id, name, description, icon, earned_at }[]` (cap at ~20 most recent for the rail; the dialog can still show one).

### 5. World-class flourishes (lightweight, ship-safe)

Project already uses `motion/react` elsewhere; reuse, no new deps.

- **Streak number count-up**: `motion`'s `animate(useMotionValue, ...)` on mount so the streak rolls from 0 → N over ~600ms. Same for the lifetime stat tiles when "View more stats" expands.
- **Heatmap reveal**: stagger cells fading in column-by-column (50ms total) when stats expand. Today's cell gets a soft pulsing ring.
- **Stats expand**: `AnimatePresence` + height/opacity transition instead of the current snap-open.
- **Entry rows**: fade+rise on mount (stagger 30ms), tap scales to 0.98, expand uses layout animation so the row grows in place smoothly.
- **Filter chips**: spring on active change; active chip gets a subtle `layoutId` underline that slides between chips.
- **Write pill**: gentle hover/tap scale; the pen icon does a tiny wiggle once per session as a discoverability cue.
- **Empty state**: the "blank first page" card fades the sprout/streak in once data lands.
- **Pull-to-refresh polish**: project already has `use-pull-to-refresh` — wire it on `/journal` to re-call `reload()`, with the sprout icon as the indicator (continuity with the streak).
- **Reduced motion**: respect `prefers-reduced-motion` — all motion blocks fall back to instant.

### Files touched

- `src/routes/journal.tsx` — header gets the Write pill; remove header padding tweaks only as needed; wire pull-to-refresh.
- `src/components/journal/entries-feed.tsx` — delete floating FAB and its `writeOpen` state (lift to `journal.tsx` so the header pill controls the sheet); keep search/filter; chip motion.
- `src/components/journal/tracking-module.tsx` — swap Flame → Sprout; count-up; smart-unit helper for period row.
- `src/components/journal/stats-panel.tsx` — smart-unit helper for lifetime row; replace "Latest badge" block with badges count + carousel + dialog; heatmap stagger + today pulse.
- `src/components/journal/entry-row.tsx` — mount stagger, tap scale, layout-animated expand.
- **New** `src/lib/format-duration.ts` — single shared helper.
- **New** `src/components/journal/badges-carousel.tsx` — the carousel + dialog component.
- `src/lib/journal-entries.functions.ts` — extend `getJournalStats` to also return `badges` array (newest 20) and `badgesCount`.

### Out of scope (deliberately)
- No new tables, no schema changes.
- No new badge artwork — uses whatever `badge_definitions.icon` already provides.
- No haptics / sound.
- No reminders, no streak-freeze mechanics.
