# Journal Stats v2 — sticky additions

The Stats segment currently shows: period toggle + 4-up counters, insights strip, year heatmap, 30d mood arc, badges. Strong bones, but nothing that pulls the user *back* tomorrow or reveals a delightful pattern. Add six modules — each one is small, computed from data already on hand, and earns its place.

## What gets added (ordered by impact)

### 1. Weekly goal ring (top of Stats)
A round-trip reason to return.

- User sets a weekly target: walks/week (1–7) or minutes/week (30–600). Default: 3 walks.
- Big animated progress ring + "2 of 3 walks · 1 day left" copy.
- "Edit goal" opens a tiny sheet (chip presets + numeric). Persisted to a new `user_goals` row (user_id, kind, target, updated_at) so it follows the user across devices.
- On hit: confetti pulse + warm copy ("You showed up. Three for three.").

### 2. Personal bests strip
A reward surface for long-time users.

Snap rail of 4 cards:
- **Longest streak** (days)
- **Longest walk** (minutes)
- **Biggest mood lift** (+N, with date)
- **Most active day** (minutes in a single day)

All computed client-side from feed entries + `minutesByDay`.

### 3. This month vs last month
Direct progress signal.

Three-row mini table with sparkbars + delta chips:
- Walks · `12 vs 8` `+50%`
- Minutes · `4h 20m vs 3h 10m` `+37%`
- Avg mood lift · `+1.4 vs +0.9` `+0.5`

Up = forest, down = clay, flat = muted. Tap to swap to "this week vs last week".

### 4. Time-of-day rhythm
"When do you walk?" Four-bucket bar chart: Early (5–8) · Morning (8–12) · Afternoon (12–17) · Evening (17–22). Tallest bucket labeled as "Your hour" with a soft glow.

### 5. Mood × weather
Tiny grid: sun · cloud · rain · night. For each, show count + avg mood-after. Reveals "Cloudy walks still lift you +1.2" — the kind of insight that travels by screenshot.

### 6. Walk-type breakdown
Stacked bar (single thin row, segmented by `walk_type` color) under personal bests, with a 3-item legend ("solo 62% · social 24% · phone 14%"). Quiet, factual.

## New "Share my month" card (footer of Stats)
A single tappable card that opens a generated 1080×1920 shareable image: month name, minutes, walks, top mood, a quote pulled from the user's longest reflection that month. Uses `share()` already in `lib/device`. Sticky-by-default because it turns Stats into something users want to post.

## Layout

```
Stats segment
├── Weekly goal ring                (new)
├── Tracking module (period + 4-up)
├── This month vs last              (new)
├── Personal bests strip            (new)
├── Time-of-day rhythm              (new)
├── Mood × weather                  (new)
├── Walk-type breakdown             (new)
├── Year heatmap
├── Mood arc 30d
├── Insights strip (best day / walks lift / consistency)
├── Badges
└── Share my month                  (new)
```

Insights strip stays but moves below the new modules so the strongest signals land first.

## Technical notes

- **No new server reads required** for modules 2–6 and the share card; all derived from `listJournalFeed` (walk entries carry `started_at`, `duration_seconds`, `mood_*_score`, `walk_type`, `weather_at_end`) plus the existing `JournalStats` payload. If the feed limit (100) becomes the bottleneck, raise it to 200 for the Stats route.
- **Goal persistence**: new `user_goals` table — `id`, `user_id` (fk auth.users), `kind` ('walks_per_week' | 'minutes_per_week'), `target` int, `updated_at`. RLS: user can read/write own row only. GRANT select/insert/update to authenticated; service_role full. New server fns `getUserGoal` and `setUserGoal` in `src/lib/user-goals.functions.ts`.
- **Share card**: render an off-screen `<div>` styled at 1080×1920, snapshot via `html-to-image` (small dep) → `share({ files: [...] })`. Fallback: download blob.
- **Components** (all under `src/components/journal/`): `weekly-goal-ring.tsx`, `month-vs-month.tsx`, `personal-bests-strip.tsx`, `time-of-day-rhythm.tsx`, `mood-weather-grid.tsx`, `walk-type-bar.tsx`, `share-month-card.tsx`. Insertion is purely in the Stats branch of `journal.tsx`.
- **Motion**: ring uses `motion` stroke-dashoffset; bars stagger in with `useReducedMotion()` respect; everything else fade-up like the rest of the page.

## Quality bar (390×728)

- Goal ring is the first thing the user sees in Stats; full ring visible without scroll.
- Every new module renders gracefully with zero data (e.g. "Set a target to track your week" / "Walk a few more times to see your time-of-day rhythm").
- No new module taller than ~180px on mobile.

## Out of scope (fast-follow)
- Editable personal-best photo backdrops.
- Goal history / streaks of hit-goal weeks.
- Year-in-review long-form recap.
- Friend comparisons (privacy work needed).

---

If you'd rather ship a tighter v1, I'd cut to: **Weekly goal ring + Personal bests + This month vs last + Mood × weather**. Those four carry most of the stickiness. Tell me "tight version" or "ship all" and I'll execute.
