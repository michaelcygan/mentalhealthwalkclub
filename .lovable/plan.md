# Weather peek on the walk page

Add a small, glanceable weather summary in the empty space to the right of the walk title (as circled). Keep the existing full `WalkWeather` strip lower on the page unchanged.

## What it shows

A compact pill/square with:
- Condition icon (sun / cloud / rain / snow — reuse `src/lib/weather-icons.tsx`)
- Temperature (e.g. `72°F`)
- Precip chance if ≥ 20% (e.g. `· 30%`)

Sourced from the NWS period nearest to `event.starts_at`, using the existing `useWalkWeather` hook + `pickPeriodForTime` from `src/lib/walk-weather-match.ts`. No new server function or query — the same query key is reused by the full strip below, so this is one network call for the page.

## Behavior

- Only render when `hasMap && !isPast` (same condition as the full strip) and the query returns `status: "ok"` with a matched period.
- While loading: render a small skeleton of the same footprint so layout doesn't jump.
- On error / unsupported region (outside NWS coverage): render nothing — the full strip already handles that messaging below.
- Tooltip / `title` on hover: full `shortForecast` text.

## Layout

Desktop / tablet (≥ sm):
- Wrap the header block in a flex row: title + meta on the left, peek aligned top-right in the circled spot.
- Peek is a rounded-2xl card, `bg-card border border-border`, ~ auto width, single line.

Mobile (< sm):
- Peek moves to a slim row directly under the "Hosted by …" line (still above RSVP), full-width-ish inline pill, left-aligned. This preserves the "peek at the top" feel without crowding the title on narrow screens.
- Achieved with `sm:absolute sm:top-0 sm:right-0` + relative header, or a simpler `flex-col sm:flex-row sm:items-start sm:justify-between` header with the peek as the second flex child.

## Files

- `src/routes/w.$code.tsx` — restructure the `<header>` in `WalkPage` to a responsive flex row; render a new `<WalkWeatherPeek lat={lat} lng={lng} centerIso={event.starts_at} />` inside it, gated on `hasMap && !isPast`.
- `src/components/walk-page/walk-weather-peek.tsx` — new small client component using `useWalkWeather` + `pickPeriodForTime` + `weatherIconFor`. Skeleton + null states as above.

## Non-goals

- No change to the full `WalkWeather` strip section.
- No new data fetching, caching, or server code.
- No change to `Cover`, RSVP, map, or share rows.
