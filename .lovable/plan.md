# Home Tab — World-Class Pass

The home tab today is a long vertical list of small components stacked by hand. The fix is not to add features — it's to **promote the home page into a deliberate module feed** where each card is sized for its signal strength, mobile gestures are first-class, and the weather + live walks become real modules instead of inline text.

Everything below reuses existing primitives. Net new code is ~3 small components and a layout refactor of `src/routes/index.tsx`.

---

## The new module order (logged-in)

```text
┌─────────────────────────────────────┐
│  HERO BAND  (greeting + level ring) │  ← merges greeting + walker level
├─────────────────────────────────────┤
│  ▶ ACTIVE WALK  (only if active)    │
│  ⤴ COMEBACK NUDGE (only if 7d gap)  │
├─────────────────────────────────────┤
│  ⬛ START A WALK  (primary CTA)      │
│  ··  Other ways to walk (chips)     │
├─────────────────────────────────────┤
│  THIS WEEK  (ring + streak + dots)  │
│   ↳ weather chip lives here, inline │
├─────────────────────────────────────┤
│  HAPPENING NOW  (horizontal feed)   │  ← live rooms + scheduled <60min
├─────────────────────────────────────┤
│  WEATHER MODULE  (full card)        │  ← collapsed → expand for forecast
├─────────────────────────────────────┤
│  WEEK IN REVIEW (Sun only)          │
│  YOUR LAST REFLECTION (if any)      │
└─────────────────────────────────────┘
```

Visibility rules: every module returns `null` when its signal is empty. The page never feels half-built.

---

## Module-by-module changes

### 1. Hero Band — merge greeting + walker level
Today the greeting is a `HeroGradient` and the level lives only on /profile. Pull the level ring into the hero so the user *sees their progress at the top*.

- Left: greeting + microState copy (unchanged).
- Right (mobile: top-right inside hero; desktop: aligned right): a small `LevelRing` (40px) — reuses `walker-level.ts` math + the ring SVG already in `walker-card-header.tsx`. Tap → `/profile`.
- Adds **time-of-day tinting** to the hero gradient using the existing tone tokens (dawn/day/dusk/night) so the page feels alive across the day.

### 2. "This Week" card — pull weather into it
The weather chip currently floats above NowAndNext as a button. Move it **inside the This Week card** as a small inline chip beside the streak line — it's a status signal, not a destination.

```text
┌────────────────────────────────────┐
│  ◐ 27/90 min     This week         │
│                  Small walks count │
│  · · · · ● ● ·                     │
│  ─────────────                     │
│  3-day streak · ☀ 62° clear        │  ← weather chip inline
└────────────────────────────────────┘
```

Reuses `WeeklyRing` + `WeatherPill`. Tapping the weather chip scrolls to the full Weather module below.

### 3. Happening Now — promote into a real join-feed
`LiveNowStrip` already does this — but it's buried inside `NowAndNext` and styled like a footer. Promote it:

- **New section heading** with live dot + count: "3 walking now · 2 starting soon".
- **Larger snap-scroll cards** (260px, snap-x mandatory) with pressed states + haptics on tap.
- **One-tap join** for live rooms: tap → starts a Walk & Talk session and routes into the room (calls existing `openSheet("audio")` flow with the room id pre-selected). No middleman screen.
- **"Starting in 8 min"** countdown updates live (already polled).
- Empty state: "All quiet right now — be the first" with a one-tap "Start a Walk & Talk" pill.

### 4. Weather Module — full card, not a chip
Replace inline weather with a proper card. Collapsed by default (single row), tap to expand:

- Collapsed: `☀ 62° · clear · good walking weather` + chevron.
- Expanded: existing `WeatherStrip` with 6-hour forecast + a `RainSoonBanner` if rain ≤ 2h.
- "Best window today" pill — finds the next 90-min block of best `tone` from the forecast and surfaces it: `best window · 4–6pm`.
- Long-press → "Set a reminder for 4pm" (uses existing notification scaffolding if present, else a toast for now).

Uses existing `useCurrentWeather`, `useHourlyForecast`, `WeatherStrip`, `RainSoonBanner`. Net new: ~60 lines for the card shell + best-window calc.

### 5. Start CTA — gesture-rich
Current `StartCta` is a single button. Level it up without bloating it:

- **Long-press** the big button → opens the mode sheet directly (skip default solo).
- **Swipe left/right on the button** → cycles mode (Solo → Guided → Walk & Talk) with haptic ticks; the button label morphs.
- Press-down state uses a spring scale (0.98) + subtle shadow lift.
- Sub-chips ("Other ways to walk") become a single horizontal snap-scroll row with mini-icons; saves vertical space.

### 6. Pull-to-refresh
The `use-pull-to-refresh.ts` hook already exists. Wire it on the home scroll container — refreshes weekly stats, live rooms, weather. Subtle leaf/footprint icon descends on overscroll.

### 7. Sticky weekly progress (micro)
When the user scrolls past the This Week card, a 24px-tall sticky bar appears under the header showing `▮▮▮▮◯◯◯ 27/90` — disappears when they scroll back up. Uses existing `useScrollDirection`. Single dependency, ~30 lines.

---

## What we are NOT adding
- No new database tables.
- No new RPC.
- No new routes.
- No new dependencies.
- No new badges or features beyond surfacing what exists.

## Files

**Edit:**
- `src/routes/index.tsx` — module feed layout (~80 line refactor, mostly removing/reordering).
- `src/components/now-and-next.tsx` — split: weather goes into the new WeeklyCard, LiveNowStrip is promoted as its own section.
- `src/components/live-now-strip.tsx` — bigger cards, snap-scroll, one-tap join, empty state.
- `src/components/weekly-ring.tsx` — accepts an optional `weatherSlot` prop for the inline chip.

**New (small):**
- `src/components/home/hero-band.tsx` — greeting + level ring + time-of-day tint (~80 lines).
- `src/components/home/weather-module.tsx` — collapsible card with best-window pill (~110 lines).
- `src/components/home/sticky-week-bar.tsx` — scroll-revealed mini progress (~40 lines).

Total: ~330 lines new, ~150 lines moved/removed. Net add ≈ 180 lines for a substantially better mobile home.

---

## Mobile capabilities used
- **Haptics** on every meaningful tap (already in `lib/device.ts`).
- **Pull-to-refresh** (existing hook).
- **Long-press** on Start CTA + Weather card.
- **Swipe-to-cycle** mode on Start CTA.
- **Snap-scroll** with `scroll-snap-type: x mandatory` on Happening Now and chips.
- **Safe-area aware** padding (already throughout).
- **Time-of-day tint** — hero tint shifts every few hours; subtle cue you're in a living app, not a static page.
- **Reduced motion respected** — all springs gated on `prefers-reduced-motion`.

## Why this is "world-class 2026"
- Every module earns its place: zero-state hides, signal-state grows. The page reorganizes itself around what you actually have today.
- Weather and live walks become *modules*, not afterthoughts — matching how Apple Weather, Headspace Today, and Strava feed treat ambient context.
- One-tap join from the home page collapses 3 screens of friction into a single gesture.
- The hero shows progress (level), the card shows commitment (this week + weather), the feed shows community (happening now). Three jobs, three modules, no clutter.
- Tone stays care-first: no red, no shame, no streak loss screams. The weather hint is a friend, not a notification.
