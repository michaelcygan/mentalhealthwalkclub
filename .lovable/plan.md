## Phase 5 — Discover hub + Parks & Trails

Three small passes. After Pass A, the **Discover** tab is the unified entry point for Groups, Places, and the feed itself. Groups and Places stay as their own deep routes but surface as summary rails inside Discover.

---

### Pass A — `/discover` becomes the hub (no schema)

**New surface**
- New route `src/routes/_authenticated/discover.tsx`. Layout:
  1. **Tonight near you** — public + group walks ≤25mi, next 48h. Up to 4 cards + "See all" → `/events`.
  2. **Groups near you** — top 3 local public groups + "See all" → `/groups`.
  3. **Global identity groups** — top 3 + "See all" → `/groups`.
  4. **Places** — top 4 place tiles + "See all" → `/places`.
  5. **Trails near you** — placeholder card "Coming in next pass" (replaced in Pass B).

**Server fns**
- New `src/lib/discover.functions.ts`: `discoverNearbyWalks({lat, lng, hours=48})` — queries `events` where `visibility='public'` OR `audience_mode='group'`, within Haversine 25mi, ordered by `starts_at`. RLS already filters what the user can see.

**Nav rewire (per user direction)**
- Replace the **Groups** card on `/profile` with a single **Discover** card.
- Keep `/groups`, `/groups/$slug`, `/places`, `/places/$key` reachable (linked from Discover rails). They do not appear standalone on profile anymore.
- Add an "Open in Discover" back-link breadcrumb on `/groups` and `/places` pointing to `/discover`.
- If a bottom tab bar exists, swap its "Groups" slot for "Discover".

**Empty/no-location states**
- If geolocation denied: Discover still loads Global rail + recent public groups + top places by group_count. Inline "Turn on location" nudge.

---

### Pass B — Trails: schema + browse

**Schema (single migration)**
- `trails (id uuid pk, source text default 'osm', osm_id text, kind text, name text, lat double precision, lng double precision, country text, region text, city text, tags jsonb, length_m int, last_synced_at timestamptz, created_at)` + unique `(source, osm_id)`. Public read; service-role write.
- `user_saved_trails (id, user_id, trail_id, position int, note text, created_at)`. RLS: owner-only.
- `trail_search_log (cell_key text pk, last_synced_at timestamptz)` — keyed by `round(lat,1)_round(lng,1)` so each ~7-mile cell refreshes at most weekly.

**Server fns — `src/lib/trails.functions.ts`** (Worker-safe, plain `fetch`)
- `discoverTrails({lat, lng})` — if the cell's `last_synced_at` is older than 7d (or missing), fetch Overpass (`node["leisure"="park"]`, `way["highway"="path"]["foot"="designated"]`, etc.) within ~25mi, upsert into `trails`, stamp the cell. Return rows within 25mi sorted by Haversine.
- `listMySavedTrails()` — joined with positions, sorted by `position asc`.
- `saveTrail({trail_id})` — appends to end, enforces Free cap of 5 (Plus removes; wired in Phase 8).
- `unsaveTrail({trail_id})`.
- `reorderSavedTrails({ids: string[]})` — single transaction updating positions.

**Routes**
- `src/routes/_authenticated/trails.tsx` — two rails: **Saved** (drag-to-reorder via `@dnd-kit/core` + `@dnd-kit/sortable`) and **Near you**. Standard Tanstack route, ssr off (location-dependent).
- Discover Pass A's trails placeholder becomes a real rail (4 nearest + "See all").

---

### Pass C — Trail detail + "Start a walk here"

- `src/routes/_authenticated/trails.$id.tsx` — Wikimedia Commons cover by lat/lng (reuse existing helper), OSM tag summary (`leisure`, `surface`, `length_m`), static `WalkMap` pin, Save/Unsave button.
- "Start a walk here" CTA → existing walk-create flow with `meetup_lat/lng/label` + `trail_id` prefilled.
- Add a small **Your trails** strip to `/profile` (3 chips + "See all").
- Place-detail page (`/places/$key`) gets a "Trails near this place" line if any trail rows sit within ~1mi.

---

## After Phase 5 — sequence confirmed: 6 → 7 → 8 → 9 → 10

### Phase 6 — Media + playlists (one pass)
- Tables `playlists (id, owner_id, name, mood, is_public)`, `playlist_items (playlist_id, position, track_id, kind)`.
- `/listen` route, three rails: Podcasts, Ambient mixes, Your queue.
- Solo-walk pre-screen picker (silence / ambient / podcast / playlist) wires to existing player.

### Phase 7 — Solo walks slim (one pass)
- Strip map/distance/pace from the solo flow.
- Keep timer, audio player, weather, mood pre/post, journal entry, accelerometer step counter, soft camera FAB, post-walk reflection prompt.

### Phase 8 — Plus retune + 50% impact (one pass)
- Reprice `plus_monthly` to $1.99 in Stripe + UI strings.
- Gates: Circles unlimited, audience precision per walk, unlimited journal, unlimited saved trails, unlimited groups (Free = host 2 private / join 5 public).
- `requirePlus` middleware on gated server fns.
- Monthly server fn populates existing `impact_donations` (gross→net→50% donated).
- `/impact` page: running total, current partner, methodology blurb. Supporter badge on profile.

### Phase 9 — Merch v1 (one pass)
- Tables `merch_products`, `merch_orders`. `/admin/merch` CRUD. Stripe Checkout. 2–3 starter SKUs.

### Phase 10 — Design polish (final pass, continuous)
- Serif headlines + handwritten accents pass across new surfaces. Paper/grain texture. Slower transitions (300→500ms). Dusty-rose + deeper moss for Places/Trails. Sparkline + mood-line + yearly heatmap each paired with one plain sentence.

---

## Technical notes

- Overpass is keyless and rate-limited (~10k req/day per IP). 7-day per-cell cache keeps us well under that even for power users.
- All Overpass + Wikimedia + Open-Meteo calls run inside `createServerFn` handlers — pure `fetch`, Worker-safe.
- `friend_walks.trail_id` is already on the schema; no walk-side migration needed for Phase 5.
- Free-tier trail cap of 5 is the only new gate in this phase; rest of the gating lives in Phase 8.

---

## Starting point

If approved, I'll start with **Pass A (Discover hub)** — no migration, fastest visible payoff, sets the navigation shape every later pass plugs into.