# Maps on Walking Platform — Implementation Plan

Goal: bring real, beautiful maps into the product without bloating the bundle or compromising privacy. Three surfaces benefit most:

1. **Active walk** — live, Strava-style tracking on a map.
2. **Journal entry** — persistent route snapshot baked over a basemap, plus a shareable post-walk card.
3. **Group page** — a live map of group members currently on public walks.

---

## Tech choice

- **MapLibre GL JS** (open-source, no token, WebGL, smooth on mobile) as the renderer.
- **Tiles**: free **Protomaps** style + a CartoDB Positron fallback. No API key, no per-tile billing. We swap to Mapbox/Stadia later if branding demands.
- **Static snapshots** for journal/share cards: render client-side via MapLibre's `map.getCanvas().toDataURL()` after the route is drawn, then upload as PNG to Supabase storage. No server-side rendering needed (works in the Cloudflare Worker constraint).
- Lazy-load MapLibre only on routes that use it (`React.lazy` + dynamic import) so it never lands in the homepage bundle.

---

## Data model changes

We already have `walk_routes(points jsonb)` and `walk_sessions.privacy`. Small additions:

- **`walk_sessions`**: add `share_map boolean default false` (separate consent from `privacy`, so a public walk can still opt out of route map sharing).
- **`walk_sessions`**: add `route_snapshot_path text` for the baked PNG used in journals + share cards.
- **New `walk_live_pings` table** for the group live map:
  - `walk_session_id`, `user_id`, `group_id`, `lat`, `lng`, `heading`, `pinged_at`, expires after ~2 min.
  - RLS: insert by self only; select where the walk is `status='active'`, `privacy='public'`, `share_map=true`, and the viewer is a member of the same group (or it's tagged to that group).
  - Realtime publication enabled so group page subscribers get pings live.

No changes to `walk_routes` — existing point storage is reused for the final route.

---

## Surface 1 — Active walk live map

`src/routes/walk.active.$id.tsx` already runs `watchPosition` and feeds `RouteSparkline`. Replace the sparkline area with a collapsible **"Live map"** card:

- Component: `src/components/walk-live-map.tsx` (lazy).
- Renders MapLibre canvas, tracks the user's blue dot, draws the polyline as it grows.
- "Recenter" pill, "follow me" auto-pan toggle, tap-to-expand to fullscreen sheet.
- For public walks, every ~15s upserts a row into `walk_live_pings` (debounced; only if user moved >10m).
- Battery-conscious: pause map rendering when tab hidden; reuse the `gps` state already wired.

Privacy: a small toggle row above the map — **Visible on map** (off by default; on auto-enables when `privacy='public'`). Stored in the session row.

---

## Surface 2 — Journal route snapshot + share card

Two pieces, both built on the same map snapshot:

**On walk end** (in existing `endWalk` flow):
- After `walk_routes` saves, render an offscreen MapLibre map at 1080×1080 (square) and 1080×1350 (story).
- Draw the route polyline with a soft glow, pin start/end, light Positron basemap, app watermark.
- `canvas.toBlob()` → upload to a new private `walk-snapshots` bucket → save `route_snapshot_path` on the session.

**Journal display** (`src/routes/journal.tsx` `WalkDetailPane`):
- Show the snapshot at the top of the entry (signed URL, 1h). Tap to open an interactive MapLibre view that replays the route with a small scrubber that moves a dot along the polyline (uses indexed timestamps already in `walk_routes.points`).
- Photos pinned at their `taken_at_seconds` along the route as small thumbnails on the interactive view.

**Share card** (new `src/components/walk-share-card.tsx`):
- Reuses the snapshot, layers stats (distance, time, mood lift, intention) in the existing design tokens.
- "Save image" + Web Share API (`navigator.share` with the file blob — already a mobile primitive we're not using yet).
- Available from journal detail and from the post-walk completion screen.

---

## Surface 3 — Group live map

On `src/routes/groups.$slug.tsx`, add a **"Walking now"** map card above the events list:

- Subscribes to `walk_live_pings` filtered by `group_id` via Supabase Realtime.
- Renders one avatar marker per active walker (their last ping). Tapping opens a small bottom-sheet with the walker's display name, intention, and an "applaud" button (reuses `group_signals`).
- If no one is walking, the card collapses to a one-line "No one out right now — be the first?" CTA that deep-links to the start-walk flow with `group_id` prefilled.
- Auto-prunes markers when last ping > 2 min old.

Optional polish: a heatmap layer showing aggregated past public routes for the group (built once a day from `walk_routes` into a precomputed GeoJSON in storage). Out of scope for v1.

---

## Other surfaces that benefit (light touches)

- **Events** (`events.$slug.tsx`, `events.tsx`): tiny static map preview using the same MapLibre snapshot helper, centered on `events.lat/lng` with a single pin. Replaces the current text-only `MapPin` icon row.
- **Profile**: a quiet "recent routes" mosaic of snapshots (only those marked `share_map`).
- **Live now strip**: existing `live-now-strip.tsx` gets an optional map peek per item.

---

## Privacy & safety (non-negotiable)

- Default: **private**. Maps stored, never shared, no group map ping.
- "Public" requires explicit toggle per walk; group ping requires public + share_map.
- All ping coords are **fuzzed** by ~50–100m before insert (so live map shows neighborhood, not doorstep).
- Snapshots crop the **first 150m and last 150m** of every route to obscure home/work locations — same trick Strava added after the heatmap incident.
- Block list (`blocks` table) is honored when rendering group map markers.

---

## Performance budget

- MapLibre GL ~200KB gz; loaded only on `/walk/active/*`, `/journal`, `/groups/$slug`. Homepage and tab bar untouched.
- Tile cache via service worker (already a Vite-friendly pattern).
- One realtime channel per group page, unsubscribed on unmount.

---

## Rollout order

1. Migration (`share_map`, `route_snapshot_path`, `walk_live_pings` + RLS + realtime + `walk-snapshots` bucket).
2. `walk-live-map.tsx` + integration into active walk (replaces sparkline, adds privacy toggle).
3. End-of-walk snapshot generation + journal display.
4. Share card + Web Share API.
5. Group live map card + ping fan-out.
6. Event/profile/live-now polish.

Each step ships independently and degrades gracefully if maps fail to load (we keep `RouteSparkline` as the fallback).

---

## Technical notes

- Lazy import: `const Map = React.lazy(() => import("@/components/walk-live-map"))`, wrapped in `<Suspense>` with the existing skeleton.
- Snapshots run on the main thread but during the existing "saving your walk" screen, so latency is hidden.
- `walk_live_pings` cleanup: a tiny `pg_cron`-style scheduled function, or just a `WHERE pinged_at > now() - interval '2 minutes'` filter on the read side — we'll do the latter to avoid extra infra.
- No new secrets needed. No paid services.
