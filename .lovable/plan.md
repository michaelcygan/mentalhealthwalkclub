## Home v2 — one island, smarter rails, less scroll

The Home tab is solid but reads as a stack of independent cards: greeting, weather chip, two CTA buttons, reflection rotator, week chart, 7-day forecast, friend pulse, podcasts, blog, then two duplicate "go to other tab" links. v2 consolidates the top fold into a single Today island, makes every section context-aware, and trims redundancy with the bottom nav.

### Layout (top → bottom)

```text
1. Today island               ← new (replaces greeting + streak + weather chip + 2 CTAs)
2. Best window today          ← new (contextual, hides when irrelevant)
3. Reflect in 30s             ← replaces ReflectionRotator (matches Journal pattern)
4. Week pulse                 ← refined WeekSummary (more compact + tap to expand)
5. Friend pulse               ← capped to 3, with "See all" link
6. 7-day outlook              ← collapsed by default with "Best day" pill
7. Listen & read              ← combined PodcastRail + BlogRail under one segmented strip
```

Same rhythm as Discover and Journal: one hero island, then snap rails. The two duplicate footer links ("Walks near you", "Journal") are removed — both already live in the bottom nav.

### New modules

1. **Today island** — one rounded gradient card that owns the top fold:
   - Greeting + first name + streak chip (Flame icon, "3w") on one line.
   - One contextual line: "Best walk today 6–7pm · 64° clear" or "Rain easing by 4pm" or "A quiet day — perfect for a slow loop". Derived from the existing daily weather + walk-score helpers already wired into WeatherForecast.
   - Inline mini week ring: 7 dots, today highlighted, filled where you walked. Same data as WeekSummary, reused.
   - Two CTAs side-by-side: **Walk now** (primary, becomes **Resume walk** when an in-progress `walk_sessions` row exists) and **Plan a walk**.
   - Weather pill tucked in the top right.
   No nested cards. ~180px tall on mobile.

2. **Best window today** — single pill card surfacing the highest-walk-score hourly window from the existing daily forecast (when one is meaningfully better than the rest). Tap → opens `/walk/new` with the time prefilled. Hidden when no daylight remains or no clear winner exists.

3. **Reflect in 30s** — replace the auto-rotating ReflectionRotator with the same one-prompt + 3-alt pattern already shipped on Journal "For You". Stops the constant motion at the top of the page, matches design language, and removes the duplicate "write" CTA users already get from the journal tab.

### Refinements to kept modules

- **Week pulse**: drop the secondary `delta vs last week` line into a tiny chip beside the total ("18 min · 2 walks · +6 min"). Cap card height; expose a "View journal" tap that routes to `/journal?segment=stats`.
- **FriendPulse**: cap rendered items to 3; if there are more, add a small "See all" link to `/discover` (Friends going section). Hide the entire card when zero items rather than a tall pulse skeleton.
- **WeatherForecast**: collapse to a single "Best walking day: Sat ↑" pill by default; tap to expand the existing 7-tile row inline. Saves ~120px until needed.
- **Podcasts + Blog**: render under a single "Listen & read" card with a 2-tab segmented control (Listen / Read), reusing both existing rails. Avoids two near-identical horizontal scrollers stacked back-to-back.
- **Footer**: remove the two duplicate "Walks near you" and "Journal" link cards. Replace with a single quiet serif line ("Still here. Still walking.") matching the Journal footer voice. The bottom nav already provides these jumps.

### Behaviour rules

- All new logic is client-side, computed from data already loaded by existing hooks (`useProfileStats`, `useCurrentWeather`, `getDaily`, `getCircleActivity`) plus one tiny additional query for any in-progress walk session (1 row, same `walk_sessions` table) — added to the same `useEffect` that already runs for `lastReflection`.
- Renders gracefully with thin data: no weather → no Best window pill, island shows just greeting + CTAs; no walks → mini ring shows seven empty dots and Week pulse shows "First walk of the week?"; no friends → FriendPulse hidden.
- The `lastReflection` quote currently shown inside the Journal footer link is moved up into the Reflect-in-30s card as a small "Last time you wrote: …" caption (tap to expand into full entry).

### Files

- New: `src/components/home/today-island.tsx`, `best-window.tsx`, `reflect-30s.tsx` (thin wrapper that imports the existing `journal/reflect-30s.tsx` so behaviour stays identical), `listen-and-read.tsx`.
- Edited: `src/routes/index.tsx` (compose new layout, remove duplicate footer links, drop the old greeting/CTAs/InlineWeatherChip), `src/components/home/week-summary.tsx` (compact header chip + tap target), `src/components/home/friend-pulse.tsx` (3-cap + See all), `src/components/home/weather-forecast.tsx` (collapsed default + Best-day pill).
- Untouched: `ReflectionRotator` (kept in the file but no longer rendered — safe to delete in a follow-up if you confirm).

### Out of scope

- Push notifications, AI-generated daily summaries, route recommendations, persisting "Best window" prefill in `/walk/new` beyond a query param, deleting `ReflectionRotator` (kept in case you want it back), redesigning `AmbientBackdrop`.

Ready to build on your word.