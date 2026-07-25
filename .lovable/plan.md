## Geolocation fallback for Plan-a-walk weather

Right now the NWS forecast only appears once a place is picked, because `WhenPicker`'s `location` prop is `null` until `pickedPlace` has coordinates. Add a low-cost browser geolocation fallback so the strip shows immediately when the user hasn't yet chosen a place.

### Behavior

- On mount of the walk-new page, if the browser supports `navigator.geolocation`, request `getCurrentPosition` once with a short timeout (~6s) and low accuracy (`enableHighAccuracy: false`, `maximumAge: 10 * 60_000`).
- If it resolves, store `{ lat, lng }` in a new `deviceCoords` state.
- Pass an effective location to `WhenPicker`:
  - Prefer `pickedPlace` coords when present (name = place name).
  - Otherwise use `deviceCoords` (name = `"Near you"`).
  - Otherwise `null`.
- If the user denies permission, times out, or the API is missing → stay `null`. No prompts, toasts, or retries. No persistence.
- Silent failure: any error keeps current behavior (empty state, no strip). NWS already returns `unsupported` outside the US, which quietly hides the strip.

### Files touched

- `src/routes/_authenticated/walk.new.tsx` — add `deviceCoords` state, one-shot geolocation effect, compute the effective `location` passed into `<WhenPicker />`.

No changes to:
- `src/components/walk-page/when-picker.tsx` (already consumes `location`).
- `src/hooks/use-walk-weather.ts`, `src/lib/walk-weather.functions.ts`, `src/lib/walk-weather-match.ts`.
- Walk creation payload, DB schema, permissions UX elsewhere in the app.

### Guardrails

- Geolocation request fires only on this route, only once, only if the user hasn't picked a place yet. It's cancelled/ignored if `pickedPlace` gets coords first.
- No fallback IP-geolocation service; if the browser API isn't available we accept the empty state.
- Coordinates never leave the client except through the existing authenticated `getWalkWeather` server function, which already rounds to 3 decimals.

### Acceptance

- Open Plan-a-walk with no place selected → after granting location, the time sheet shows the hourly strip near the user's location.
- Deny or ignore the prompt → sheet renders exactly as today (no strip, no error).
- Pick a specific place afterward → strip switches to that place's coords.
- Outside NWS coverage (non-US) → strip stays hidden (existing `unsupported` path).
