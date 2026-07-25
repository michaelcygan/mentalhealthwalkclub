
## NWS weather in Plan a walk

A calm, optional forecast strip that lives inside the existing time-wheel sheet and enriches the collapsed time card. It never blocks walk creation, never persists, and quietly disappears when NWS has no data.

### Files touched

New:
- `src/lib/walk-weather.functions.ts` — authenticated `createServerFn`, NWS provider, normalization, bounded TTL + in-flight caches.
- `src/hooks/use-walk-weather.ts` — TanStack Query hook (key `["walk-weather", roundedLat, roundedLng]`).
- `src/lib/walk-weather-match.ts` — pure helpers: coord rounding, condition-code derivation, ISO wall-clock parser, nearby-hour window selector.

Edited:
- `src/routes/_authenticated/walk.new.tsx` — extend `pickedPlace` with `lat`/`lng`; retain from `getOrCreateWalkPlace` result; extend prefill Supabase select to include `lat,lng`; pass optional `location` prop to `WhenPicker`. No changes to `createWalk` payload.
- `src/components/walk-page/when-picker.tsx` — accept optional `location`; enrich collapsed time card secondary line; render weather strip inside `TimeWheelSheet` above the wheels; tapping a tile updates the sheet's draft `h`/`mer` (minute preserved) without committing.

### Server function (`walk-weather.functions.ts`)

- `getWalkWeather` — `createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ lat, lng }))`.
- Round lat/lng to 3 decimals for request + cache key.
- Fetch `https://api.weather.gov/points/{lat},{lng}` with `Accept: application/geo+json` and a fixed `User-Agent: "MentalHealthWalkClub/1.0 (https://mentalhealthwalkclub.com)"`.
- Validate `properties.forecastHourly` is HTTPS + hostname `api.weather.gov` before following it.
- Fetch hourly forecast; normalize to `WalkWeatherPeriod[]` with a deterministic `conditionCode` derived from `shortForecast` + `isDaytime`. Precipitation: preserve `null`, clamp numeric 0–100. Return `timeZone` from point response.
- 4.5s `AbortController` timeout per request.
- Two module-level bounded TTL Maps (max ~200 entries, LRU-ish by insertion order): point cache ≈24h keyed by `lat,lng`; hourly cache ≈12min keyed by resolved URL. In-flight dedupe Map keyed by URL.
- Returns `{status:"ok"|"unsupported"|"unavailable", provider:"nws", periods, timeZone?, generatedAt?}`. Any error → `"unavailable"`; 404 from `/points` or missing `forecastHourly` → `"unsupported"`. Never throws to caller.

### Client hook

```ts
useQuery({
  queryKey: ["walk-weather", roundedLat, roundedLng],
  queryFn: () => getWalkWeather({ data: { lat, lng } }),
  enabled: coordinatesExist,
  staleTime: 10 * 60_000,
  gcTime: 30 * 60_000,
  refetchOnWindowFocus: false,
  retry: false,
})
```

### WhenPicker changes

- New prop `location?: { name; lat; lng } | null`. Call `useWalkWeather(location)`.
- **Match helper** parses NWS `startTime` (e.g. `2026-07-25T17:00:00-04:00`) via regex to extract wall-clock year/month/day/hour without timezone conversion, then matches against the currently-displayed `date`'s local Y/M/D/H.
- **Collapsed time card**: when a matching period exists for committed time, replace `{formatTime} · {tz}` with `{formatTime} · {temp}° · {shortForecast}` — or `{formatTime} · {temp}° · {pop}% rain` when precipitation ≥ 25%. Loading/unavailable/no-match → keep existing tz line unchanged.
- **Weather strip inside `TimeWheelSheet`**:
  - Computed from draft `h`/`m`/`mer` + committed date.
  - Horizontally scrollable row of up to 5 tiles: −2h, −1h, selected, +1h, +2h. Clamp to available range.
  - Fixed-height skeleton while loading (prevents wheel jump).
  - When date is outside available periods: small muted line "Forecast will appear closer to the walk."
  - When `unsupported` or `unavailable`: render nothing.
- **Tile** = `<button type="button" aria-pressed>` with Lucide icon (`Sun`/`Moon`/`CloudSun`/`CloudMoon`/`Cloud`/`CloudRain`/`CloudLightning`/`CloudSnow`/`CloudFog`/`Wind`, `aria-hidden`), hour label, rounded temp, and pop% when ≥ 25%. `aria-label`: `"Select 5 PM, 77 degrees Fahrenheit, partly cloudy, 10 percent chance of rain."` Selected style: `border-forest bg-forest/10`. Tap updates local `h` (12-hour) and `mer` in the sheet; minute untouched; commit still requires the existing "Set" button.

### walk.new.tsx changes

- `pickedPlace` state gains `lat: number | null; lng: number | null`.
- On `getOrCreateWalkPlace` success: store `place.lat`, `place.lng`.
- On prefill: `.select("id,name,address,hero_url,lat,lng")` and hydrate coords.
- `<WhenPicker … location={pickedPlace?.lat != null && pickedPlace?.lng != null ? { name, lat, lng } : null} />`.
- No change to `createWalk` payload.

### Non-goals / guardrails

- No DB migration, no walk schema changes, no analytics, no toasts on failure.
- No alerts, radar, AQI, wind, humidity, sunrise, daily forecast, city entry, or settings.
- No new npm packages; use existing `lucide-react`, `zod`, TanStack Query, `createServerFn`.
- No weather anywhere outside `walk.new` (not on public walk page, Discover, Groups, recap, etc.).

### Acceptance

Matches the 22-point acceptance list: coords retained on new + prefill, no payload change, server-only NWS with validated `forecastHourly`, normalized DTO, bounded cache + in-flight dedupe, reused response across time/date edits, collapsed card enrichment, in-sheet strip with tap-to-update-draft, keyboard/AT accessible tiles, silent on unsupported/failure, existing build + typecheck pass.
