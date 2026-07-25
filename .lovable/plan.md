# Wave 2 — Public homepage, Nearby grid, retire /discover and /events

Goal: turn `/` into the V1 non-negotiable "public nearby walk grid," fold Discover into it, and finish retiring the `/events*` URLs. No visual overhaul of authenticated home — that stays as-is; we only add a Nearby rail and a proper public state.

## What changes

### 1. Public read path for walks
- New migration: add a narrow anon SELECT policy on `public.events` scoped to `status='published' AND visibility='public' AND audience_mode='public' AND starts_at >= now() - interval '1 day'` (so anon can only see genuinely public, current/future walks). `GRANT SELECT` on the safe columns to `anon` via a `public_events` view (id, slug, title, starts_at, timezone, venue_name, city, meeting_point, lat, lng, attendee_count, image_url, cover_override_url, host_user_id). Underlying table policy still gates row visibility; the view provides column safety.
- New `src/lib/nearby.functions.ts` with `nearbyWalksPublic` — a `createServerFn` (no auth middleware) that creates a server publishable-key Supabase client inside the handler and queries `public_events`. Accepts optional `{ lat, lng, hours, limit }`, applies Haversine ≤25mi filter when coords provided, otherwise returns soonest upcoming.

### 2. Homepage `/` rebuild
- Logged-out `/`: keep the existing hero, add a **Nearby walks** grid below it powered by `nearbyWalksPublic`. Loader calls the public server fn so the grid is SSR/SEO-friendly. `head()` gets a real description + OG title/description/type for the shareable landing page.
- Logged-in `/`: keep the current authenticated home components (TodayIsland, UpcomingRail, etc.), then append the same Nearby rail so authenticated users get the discover-style feed without a second destination. `UpcomingRail` already shows *your* upcoming; Nearby shows *everyone's* nearby.
- Nearby card component: reuse `WalkCard` from `src/components/discover/walk-card.tsx`. Coord acquisition uses the same optional `navigator.geolocation` prompt as Discover, gracefully falling back to soonest-upcoming when denied.

### 3. Retire `/discover`
- Replace `src/routes/_authenticated/discover.tsx` with a `beforeLoad` redirect to `/`.
- Update the 4 remaining `to="/discover"` links (in `friend-pulse.tsx`, `groups.tsx`, `places.tsx`, `trails.tsx`) to point at `/`.

### 4. Retire `/events*` from user-visible nav
- `src/routes/events.tsx` and `src/routes/events.$slug.tsx` already redirect (to `/walk/new` and `/w/$code` respectively). Update `events.tsx` to redirect to `/` instead of `/walk/new` (the URL was meant as a listing, not a compose action).
- Remove the "Events" row from `src/routes/more.tsx`.
- Update `src/routes/_authenticated/trails.$id.tsx` `navigate({ to: "/events" })` to `navigate({ to: "/" })`.
- Update `COMPOSE_HIDDEN_PREFIX` in `src/components/mobile-tab-bar.tsx` — drop `/events/` (route retired), no functional change since it's a redirect.

### 5. SEO metadata
- Give `/` a real head: title, description under 160 chars, `og:title`, `og:description`, `og:type=website`, `twitter:card=summary_large_image`. No `og:image` yet — dynamic per-walk OG images already exist at `/api/public/walk.$code.og` for share links.

## Files touched

- new: `supabase/migrations/*_public_events_view.sql`
- new: `src/lib/nearby.functions.ts`
- edit: `src/routes/index.tsx` (add Nearby grid to both states, add proper `head()` + loader, tighten logged-out marketing copy only where copy touches the grid)
- edit: `src/routes/_authenticated/discover.tsx` → redirect stub
- edit: `src/routes/events.tsx` (redirect target `/` instead of `/walk/new`)
- edit: `src/routes/more.tsx` (drop Events row)
- edit: `src/components/home/friend-pulse.tsx`, `src/routes/_authenticated/groups.tsx`, `src/routes/_authenticated/places.tsx`, `src/routes/_authenticated/trails.tsx`, `src/routes/_authenticated/trails.$id.tsx` (link/target fixes)
- edit: `src/components/mobile-tab-bar.tsx` (prefix cleanup)

## Deferred to later waves (per Wave 0 plan)

- Groups simplification → Wave 4
- Follows migration → Wave 4
- Rewriting `walk.new` short flow → Wave 3
- Adding `events.location geography(Point,4326)` + GiST index → Wave 3 (needed for a real geo query; Haversine on the client is fine at Wave 2 scale of ~28 rows)
- Retiring `/circles`, `/listen`, `/trails`, `/places`, `/read`, `/impact`, `/shop` → later waves; only their `/discover` links are updated now

## Risks

- The new anon SELECT policy widens reads on `events` — mitigated by the view exposing only display-safe columns and the strict WHERE clause (`visibility+audience_mode+status+starts_at`).
- Host display names for Nearby cards: `WalkCard` doesn't require host name today, so no `public_profiles` join is needed at this wave.
- 28 live events; policy change is safe to roll forward.

## Verification

- After migration: `curl` `/` unauthenticated in preview, confirm SSR HTML contains at least one walk title from the public grid (or an empty-state), no 500.
- Confirm `/discover` and `/events/*` redirect to `/` and `/w/:code`.
- Run `supabase--linter` to confirm no new RLS-missing warnings introduced by the new view + policy.
