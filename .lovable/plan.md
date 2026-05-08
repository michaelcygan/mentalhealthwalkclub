## Weather across the platform — implementation plan

### API choice — Open-Meteo (free, no key)

Open-Meteo (`https://api.open-meteo.com`) covers everything we need with no API key, no signup, and a generous public quota (~10k req/day). It returns:

- **Current conditions** — temperature, apparent temp, wind, weather code, is_day
- **Hourly forecast** — temp + precipitation + wind for the next 12–24h
- **Minutely_15 precipitation** — 15-minute precipitation outlook for the next 1–3h (the "about to rain" signal)
- **Air quality** companion endpoint at `air-quality-api.open-meteo.com` if we ever want pollen/AQI

All requests are pure `GET` with `latitude`, `longitude`, plus a comma list of fields. CORS is open, so we call it from the browser — no server route, no secret, no Lovable Cloud touch.

### Shared foundation

Create three small files, used everywhere weather appears:

- `src/lib/weather.ts` — typed fetcher with two entry points:
  - `getNow(lat, lng)` → current conditions
  - `getForecastWindow(lat, lng, hoursAhead)` → 1–24h slice with precipitation, used for both event scheduling and the "rain soon" warning
  - In-memory cache keyed by `lat,lng` rounded to 2 decimals + 10-minute TTL so we don't hammer the API or rerender churn
  - Maps WMO weather codes → `{label, icon, tone}` (sun, cloud, drizzle, rain, snow, fog, thunder)
- `src/lib/weather-icons.tsx` — tiny inline SVGs (sun, partly-cloudy, cloud, rain, drizzle, snow, fog, storm) so we don't drag in another icon set; respects `currentColor`
- `src/hooks/use-weather.ts` — `useCurrentWeather(coords)` + `useForecast(coords, hoursAhead)` thin wrappers over the lib, with `loading` / `error` / `data`. Coords come from the user's profile (`profiles.lat/lng`) or `navigator.geolocation` as a fallback (cached in localStorage so we don't re-prompt).

Privacy: we never log, store, or send coordinates anywhere except the Open-Meteo request. No new tables. No secrets.

### Surface 1 — Homepage / Now & Next (light touch)

In `src/components/now-and-next.tsx` (or its container on `index.tsx`), add a single inline pill: `☁︎ 58° · breezy` with a one-liner like "Good walking weather." or "Light rain at 4pm — earlier might be kinder." Tap → expands to a 6-hour mini-strip (icon + temp + raindrop %). Skipped entirely if no coords yet (no permission prompt on the home page — opt-in feels cleaner).

### Surface 2 — Walk scheduling flow (`events.new.tsx`)

When the user picks a date+time and a city/coords:
- Show a forecast row directly under the time picker: weather icon, temp, precipitation %, wind for that exact hour
- Quiet inline hint when it matters:
  - `"Forecast: light rain at 5pm — consider 6pm or earlier"` (with a "shift 1h earlier" / "shift 1h later" quick-action chip if a drier hour exists ±2h)
  - `"Cold (38°) — remind attendees to bundle up?"` toggle that appends a line to the description
- Open-Meteo supports forecasts up to 16 days, so this works for any reasonable scheduling horizon. Beyond 7 days we soften the language to "early outlook."

### Surface 3 — Active walk (`walk.active.$id.tsx`)

Two pieces:

- **Header weather chip** — same compact icon+temp pill near the timer, glanceable
- **"Rain soon" warning** — poll `minutely_15` precipitation every 5 minutes during the walk:
  - If precipitation > 0.2mm forecast within the next 20 min and current is dry → show a soft amber banner: `"Rain likely in ~12 min. Loop back?"` with a haptic tap and an "OK, noticed" dismiss
  - Only fires once per session; never nags
  - If user is already in rain, switch to a different banner: `"Walking in the rain — proud of you. End early?"`

Battery: we already throttle GPS; weather is a tiny 1–2KB GET every 5 min and only while the walk is active and tab is visible.

### Surface 4 — Journal (`journal.tsx`) — capture conditions per walk

Conditions become part of the walk's memory. Two parts:

- **Capture at end-of-walk**: when finalizing a session, fetch current weather for the last GPS point and store a tiny snapshot on the walk row
- **Display in journal**: a small chip on each entry card and in the detail pane — `🌧 52° · light rain` — and bake the same chip into the share-card overlay we shipped, so the conditions live on the share image too
- **Journal aggregate insight**: a one-liner like "You've walked through rain 4 times this month." in the existing insights area

### Database — single small migration

Add a JSONB column to `walk_sessions`:

```text
weather_at_end jsonb       -- { tempF, code, label, windMph, precipMm, isDay, capturedAt }
```

JSONB keeps it flexible without a schema change later (adds humidity, AQI, etc. without migrations). No new RLS — inherits walk_sessions own/group policies. Already-existing routes that read walks will get this for free; the share-card baker reads it from the walk row.

### Files to add / edit

```text
src/lib/weather.ts                  (new)  — typed fetcher + WMO map + cache
src/lib/weather-icons.tsx           (new)  — inline SVG set
src/hooks/use-weather.ts            (new)  — useCurrentWeather, useForecast
src/components/weather-pill.tsx     (new)  — compact icon+temp+label
src/components/weather-strip.tsx    (new)  — 6h hourly strip (homepage expand, scheduler)
src/components/rain-soon-banner.tsx (new)  — active-walk amber/blue banner
src/components/now-and-next.tsx     (edit) — slot WeatherPill
src/routes/events.new.tsx           (edit) — forecast row + nudges under time picker
src/routes/walk.active.$id.tsx      (edit) — header pill + minutely poll + banner + capture on end
src/routes/journal.tsx              (edit) — chip on list rows + detail pane
src/lib/share-card.ts               (edit) — paint weather chip onto the bottom of the card
supabase/migration                  (new)  — add walk_sessions.weather_at_end jsonb
```

### Rollout order

1. Foundation lib + hook + pill (no UI placement yet)
2. Homepage Now & Next pill (smallest blast radius, validates the API)
3. Active walk header chip + capture-on-end + journal chip + share-card chip
4. Rain-soon banner during active walks
5. Scheduler forecast row + nudges

Each step ships independently and degrades gracefully — if Open-Meteo is unreachable, every weather UI just renders nothing rather than blocking the surface.

### Tone

Weather copy is gentle, never alarming: "Light rain coming in 12 min — loop back?" not "WARNING: PRECIPITATION DETECTED." The point is care, not alerts.
