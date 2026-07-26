## Problem
"Walks near you" today only uses browser geolocation coords + a 25-mile radius. When the browser returns an approximate/off-city location (or a distant one), real walks in the user's home city — like the Grant Park walk in the screenshot — get filtered out and the section falls back to the generic empty state. The user's profile `city` (a text field like "Chicago") is never consulted.

## Fix
Make **home city** the primary signal for nearby. Geolocation stays as an optional refinement.

Behavior:
- **No home city set** → empty state asks the user to set one, with a link to `/settings`. No walks shown, no misleading "No walks posted yet" copy.
- **Home city set** → server returns walks whose event `city` matches (case-insensitive, trimmed) the profile city, unioned with any walks within 25 mi if the browser also provided coords. Section shows those walks when there is at least one.
- **Home city set, truly zero matches** → current "No walks posted yet · Plant the first flag" empty state.

## Changes

### 1. `src/lib/nearby.functions.ts`
- Extend input schema: add `city: z.string().trim().min(1).max(120).nullable().optional()`.
- After the base 72-hour query, build the result set as the union of:
  - rows where `row.city` case-insensitively equals the input `city`, AND
  - rows within 25 mi of `lat/lng` (existing distance filter) when coords are present.
- Sort by `starts_at` asc, then miles asc (nulls last). De-dupe by `id`. Apply `limit` at the end.
- Keep the current fallback (return unfiltered upcoming list) only when BOTH `city` and coords are absent — used by the SSR loader for the public/logged-out homepage.

### 2. `src/routes/index.tsx` — `NearbyGrid`
- Accept optional `homeCity: string | null` prop from the authenticated home view (read from the existing profile query pattern already used in `more.tsx` / `settings.tsx`).
- Pass `city: homeCity` alongside `lat/lng` into `nearbyWalksPublic`. Enable the query as soon as EITHER `homeCity` is present OR geolocation has resolved with coords (today it waits for geo only).
- Query key includes `homeCity` so it refetches when the user updates their city in Settings.
- Section heading: show "Walks near you" whenever `homeCity` OR `coords` is set; keep "Upcoming walks" only for the truly public homepage.
- Subtitle: when `homeCity` is set, read `In ${homeCity}${coords ? " · plus within 25 mi" : ""}` instead of the current "Within 25 mi · …".

### 3. Empty state — `EmptyNearby`
- New variant: **no home city**. When the authenticated viewer has no `profiles.city`, render:
  - copy: "Set your home city to see walks near you."
  - primary link: "Set home city" → `/settings`.
- Existing "No walks posted yet · Plant the first flag" copy stays for the `homeCity`-is-set-but-zero-matches case (and for the public/logged-out variant).
- Loader-fed public homepage (`publicMode`) is unchanged: it still shows the unfiltered upcoming list or the current empty copy.

### 4. Profile read
- Fetch `profiles.city` for the current user once in the home route (same pattern as elsewhere, via TanStack Query), pass it into `NearbyGrid`. No new endpoints.

## Out of scope
- Any schema change (no lat/lng added to profiles).
- Fuzzy city matching, geocoding profile city into coords, or radius-based expansion beyond the existing 25 mi.
- Changing the geolocation prompt UX.

## Technical notes
- City match uses `row.city?.trim().toLowerCase() === input.city.trim().toLowerCase()`; done in JS after the base query (avoids Postgres collation surprises and keeps the query the same shape).
- Public homepage loader keeps calling `nearbyWalksPublic({ data: { hours, limit } })` with no city/coords, so anonymous SSR is unchanged.
