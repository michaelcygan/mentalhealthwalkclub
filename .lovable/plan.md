# Remove Google Maps/Places — Migrate to Photon (OSM)

Replace paid Google dependencies with Photon (OpenStreetMap) while keeping all user-facing functionality intact. Executed in waves; lint + build after each.

## Wave 0 — Audit
Grep repo for: `google_maps`, `GOOGLE_MAPS`, `google_place_id`, `maps.googleapis`, `places.googleapis`, `X-Goog`, `connector-gateway.lovable.dev/google_maps`, `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_*`, `hero_source = 'google'`. Confirm `LOVABLE_API_KEY` usage elsewhere before touching it (Radio/AI). Report findings.

## Wave 1 — Provider-neutral data model (migration)
- `alter table public.places rename column google_place_id to provider_place_id;`
- Add `provider text not null default 'google'` with `check (provider in ('google','osm'))`.
- Drop old unique on `google_place_id`; add `create unique index places_provider_external_id_unique on public.places (provider, provider_place_id);`
- Existing rows keep `provider='google'` + former id.
- Regenerate Supabase types after approval.

## Wave 2 — Photon server search
Rewrite `src/lib/walk-places.functions.ts`; add `src/lib/geocoding/photon.server.ts`.
- Remove `GATEWAY`, `gatewayHeaders`, Google requests, X-Goog headers.
- `PHOTON_BASE_URL` env, default `https://photon.komoot.io`. Server-only.
- `GET /api?q=&limit=8&lang=en&lat=&lon=` with 5s timeout, 1 retry, Zod validation (3–120 chars), safe URL build.
- Normalize to:
```ts
type PlaceSuggestion = {
  provider: "osm";
  provider_place_id: string; // `${osm_type}:${osm_id}`
  name: string; address: string | null;
  lat: number; lng: number;
  category: string | null;
  osm_type: "node"|"way"|"relation"|null; osm_id: string | null;
};
```
- Map OSM tags → app categories (park/trail/beach/neighborhood/city/cafe).
- Build a de-duplicated address from `street/housenumber/postcode/city/district/county/state/country`.

## Wave 3 — Cache/create place
Replace `getOrCreateWalkPlace({ google_place_id })` with `{ suggestion: PlaceSuggestion }`.
- Server-validate all fields.
- Lookup by `(provider, provider_place_id)`; insert if missing; handle race via re-fetch.
- No second details request; use suggestion fields directly.

## Wave 4 — Imagery
- Keep Wikipedia/Wikimedia enrichment for park/trail/neighborhood/city/beach.
- Remove Google photo fallback entirely.
- Fallback order: Wiki image → existing OSM static map (if reliable) → designed gradient.
- Data cleanup migration: `update public.places set hero_url=null, hero_attribution=null, hero_source=null where hero_source='google';`

## Wave 5 — Walk composer
Update `src/routes/_authenticated/walk.new.tsx`:
- Replace `google_place_id` with `provider`/`provider_place_id` throughout.
- Autosuggest: min 3 chars, 400ms debounce, max 8, pass device coords as `near`, sequence-guard stale responses, clear on select/short query.
- States: Searching… / No places found / Could not search right now.
- Suggestion UI hides ids/coords; shows name + address.
- Subtle attribution: "Place data © OpenStreetMap contributors" → link to OSM copyright.
- Manual meeting-point fallback: allow walk creation with venue text only, no place_id required.

## Wave 6 — Maps & outbound
- Confirm Leaflet+CARTO map unchanged; no Google SDK/tiles.
- Any outbound "open in maps" links → `https://www.openstreetmap.org/?mlat=&mlon=#map=`.

## Wave 7 — Config/connector cleanup
- Remove from `.env.example`, docs, runtime, types: `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`, `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID`, `GOOGLE_MAPS_API_KEY`.
- Ask user to disconnect the Lovable Google Maps connector via Settings → Connectors (agent cannot delete managed secrets).
- Keep `LOVABLE_API_KEY` (used by AI/other connectors — verified in Wave 0).
- Re-grep to confirm only permitted references remain (`provider='google'` legacy rows, migration comments).

## Wave 8 — QA
Run through the full test matrix listed in the request; verify no Google network calls; `npm run lint && npm run build`.

## Technical notes
- Photon returns GeoJSON `[lon, lat]` — swap to `{lat, lng}`.
- `provider_place_id` format: `node:123`, `way:456`, `relation:789`.
- Existing `events.place_id` FKs untouched — legacy rows keep working.
- Two migrations total: (1) schema rename+provider column+index, (2) null-out `hero_source='google'` imagery. Both submitted for approval before code that depends on new types.
- No new client-side geocoding; Photon only via server function.

## Deliverable
Final report: Google refs found, files changed, env vars removed, migrations applied, provider endpoint used, remaining legacy `provider='google'` row count, lint/build results.
