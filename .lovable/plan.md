## Restore Discover as a V1 Directory

Replace the redirect at `/discover` with a real, focused three-segment directory: **Walks · Groups · Places**. Reuse existing server functions and card components. No schema changes, no map, no new routes.

### Wave 0 — Audit (done)
- Nav already links to `/discover`; current route redirects home.
- Reuse: `discoverNearbyWalks`, `listMyGroups`, `discoverPublicGroups`, `discoverTrails`, `WalkCard`.
- Public group cards must link to `/g/$slug` (not `/groups/$slug`); authed group detail at `/groups/$slug`.
- `discoverPublicGroups` has a scope bug: only filters when `scope === 'global'`. Local scope must add `.eq('scope','local')`.
- Existing geolocation pattern in `src/hooks/use-weather.ts` / homepage; reuse without modification.
- `/places`, `/places/$key`, `/trails` remain redirect stubs — do not link them.

### Wave 1 — Route shell
Rewrite `src/routes/_authenticated/discover.tsx`:
- Remove redirect; add `head()` metadata (title "Discover — Mental Health Walk Club", matching description + og/twitter).
- Component: page header, segmented control (Walks | Groups | Places, default Walks), sticky on mobile with safe-area padding.
- Segment state via `Route.useSearch()` + `validateSearch` (`tab: 'walks'|'groups'|'places'`) so tab is shareable and preserved on refresh.
- Lightweight geolocation: request via `navigator.geolocation` in an effect; render immediately with `coords = null`. Show subtle status row ("Using your location" / "Turn on location for nearby distances" with a "Use location" button).
- Shared `<Section>`, `<SectionLoading>`, `<SectionError onRetry>`, `<SectionEmpty>` primitives local to the file.

### Wave 2 — Walks segment
- Single React Query: `['discover','walks',lat,lng]` → `discoverNearbyWalks({ lat, lng, hours: 168, limit: 20 })`, staleTime 60s, enabled always.
- Filters (local UI state): time `[Today | This week]` default This week; distance `[5 | 10 | 25 mi]` default 25.
  - Today = walks whose local calendar date matches user's today (use event `timezone` when present, else browser tz).
  - Distance applies only when `miles != null`; walks with no coords remain visible at 25 mi, hidden at 5/10 mi.
- Cards: reuse `src/components/discover/walk-card.tsx` (already links to `/w/$code` via existing RSVP pill/flow — verify at implementation time; if it links to slug, keep as-is).
- Empty: "No walks match this view yet." + `[Post a walk]` (`/walk/new`), `[Show 25 miles]`.
- Error: inline retry, does not block other segments.

### Wave 3 — Groups segment
Two independent queries, both enabled only when `tab === 'groups'`:
1. `['discover','my-groups', userId]` → `listMyGroups()`, staleTime 5m. Merge `owned` + `member` with badges: "You host", "Member", "Private"/"Public". Link to `/groups/$slug`.
2. `['discover','public-groups', lat, lng]` → `discoverPublicGroups({ lat, lng, scope: 'local' })`, staleTime 2m. Link cards to `/g/$slug`. Exclude group ids already present in `my-groups`.

Fix `discoverPublicGroups` scope bug in `src/lib/groups.functions.ts`: add explicit `q = q.eq('scope','local')` branch alongside global.

Footer actions: `[Manage my groups]` and `[Start a group]` both → `/groups`.

Empty states per section as specified.

### Wave 4 — Places segment
- Query `['discover','places', lat, lng]` → `discoverTrails({ lat, lng, limit: 20 })`, staleTime 10m, enabled only when `tab === 'places' && coords != null`.
- Show first 12 named results. Card: name, type badge (Park/Path/Footway/Trail), distance, `[Maps]` external link (`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, `target=_blank rel="noopener noreferrer"`), optional `[Plan a walk]` → `/walk/new` (no prefill).
- Location denied: prompt "Use your location to find nearby parks and walking paths." + `[Use location]`.
- Trail fetch failure: isolated error with `[Try again]`; other segments unaffected.
- Do NOT link `/places`, `/places/$key`, `/trails`.

### Wave 5 — Query isolation & performance
- Independent queries with keys above; no `Promise.all` shared loading.
- `enabled` per section as specified; each section owns its loading/error/empty.
- Images: `loading="lazy" decoding="async"`.
- Caps: 20 walks / 12 groups / 12 places rendered.

### Wave 6 — Polish
- Reuse cream/forest/serif tokens. Editorial narrow width on desktop; two-column grid for Groups/Places at ≥md.
- Accessible segmented tabs (`role="tablist"`, `aria-selected`), busy states, labeled filter chips, external-link semantics.
- Respect mobile header, tab bar, Now Playing dock (bottom padding already conventional in project).

### Wave 7 — QA
- `npm run lint && npm run build`, fix issues from this change only.
- Manual: route no longer redirects; segment switch preserves scroll and URL; location denial degrades gracefully; failure in one segment leaves others usable; private groups do not leak into public; global groups excluded from local list; `/g/$slug` opens public group page.

### Files touched
- `src/routes/_authenticated/discover.tsx` — full rewrite (route shell + three segments in one file, small local subcomponents).
- `src/lib/groups.functions.ts` — one-line scope fix in `discoverPublicGroups`.
- No other files. No generated files. No migrations.

### Out of scope (per spec)
Friends activity, Circles, memories, invitations, featured content, maps, saved trails, place/trail detail pages, new schema, unauth Discover.
