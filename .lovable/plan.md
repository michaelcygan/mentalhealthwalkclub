# Listen v3 — search, filters, and admin curation

## Goal

Right now Listen surfaces rails by section, but there's no way to look something up. Users will search by show name, artist, host, topic, or article title — and they'll come back if the page gets better the more they use it. Admins should be able to shape what's surfaced without leaving the page.

## What's new (mobile-first)

```
┌─────────────────────────────────────────────────┐
│ Listen & Read                                   │
│                                                 │
│  ╭─ Today's pick island ─────────────────╮      │
│  ╰───────────────────────────────────────╯      │
│                                                 │
│  🔎  Search shows, artists, articles…   ⌥ ▾    │  ← new search bar + filter sheet
│  [ Calm ][ Focus ][ Sleep ][ Outdoors ] (chips) │  ← mood / category chips
│                                                 │
│  [ Listen ][ Read ][ Yours ]                    │
│  …rails or search results…                      │
│                                                 │
│  Collections                                    │
│  ╭ Sunday reset ╮ ╭ Walk to think ╮ ╭ Rainy ╮   │  ← admin-curated bundles
│                                                 │
│  Trending this week  ·  Recently added          │  ← derived rails
└─────────────────────────────────────────────────┘
```

### 1. Cross-catalog search

A single search field at the top, debounced (~200ms). One server fn `searchListen({ q, kinds, moods })` runs four parallel `ilike` queries (or `websearch_to_tsquery` if we add a tsvector later) and returns a unified `SearchHit[]` shape:

```
{ kind: "podcast"|"ambient"|"guided"|"blog",
  id, title, subtitle, cover, badge?, link?, duration? }
```

Results replace the rails while the query is non-empty, grouped by kind with "Show all" toggles. Empty result shows a "Try fewer words / check spelling" hint plus a `Suggest content` link that opens an admin-receivable form (lands in a tiny `content_requests` table — admins see it in Admin → Blogs).

Fields searched per source:
- `podcast_episodes.title` + parent `podcast_feeds.title/publisher`
- `ambient_tracks.title` + `artist` + `genre`
- `guided_tracks.title` + `host`
- `blog_posts.title` + `summary` + parent `blog_feeds.publisher`

### 2. Filter chips (mood + category)

A horizontal scroll of chips derived from the unique non-null values in `mood_tags` / `category` / `genre` (computed server-side, cached for the session). Selecting chips narrows both rails and search results — they OR within a facet, AND across facets. URL-persisted: `?moods=calm,focus&kinds=podcast,ambient`. Tapping a chip deep-links and survives reloads.

### 3. Smart rails (stickiness loops)

Replaces nothing — appends below the existing rails:
- **Recently added** — last 14 days across podcasts/ambient/guided/blogs.
- **Trending this week** — based on a new tiny `listen_events` table (`user_id, kind, item_id, action: 'open'|'play'|'save'|'queue', at`). Trending = count of distinct users in last 7 days. Fire events client-side on tile tap & on play start; never block UI.
- **Because you saved X** — when a user has ≥3 saved reads or queue items, surface up to 6 items sharing mood tags with their picks. Pure derived, no ML.
- **Collections** — admin-curated bundles (see §4).

### 4. Collections (admin-curated)

New `listen_collections` table (`id, slug, name, blurb, cover_url, is_published, sort_order`) and `listen_collection_items` (`collection_id, kind, item_id, position`). Admin can build mixed-kind bundles like "Sunday reset" or "Rainy day walks". On Listen they render as a snap rail of cover cards; tapping opens `/listen/collection/$slug` with the full list and a "Play all" + "Add all to a playlist" action.

### 5. Inline admin controls

When the signed-in user has the `admin` role (already checked via `has_role`), every tile, search result, and collection card gets a tiny menu:
- ★ Toggle featured / Set rank
- 🧷 Add to collection (mini sheet of existing collections + "New…")
- 🚫 Hide from Listen (sets `is_active = false`)
- ✎ Edit metadata (opens admin route in new tab)

These are surfaced via a single `<AdminTileMenu>` that mounts only when `useIsAdmin()` is true. No mode switch — admins just see extra affordances on the same page.

### 6. Admin home additions

`/admin` gets two new cards (full pages already linked from nav):
- **`/admin/collections`** — CRUD for collections + drag-reorder items, pulls from `searchListen` to add cross-kind items.
- **`/admin/insights`** — read-only: top searched terms (last 30d from a `search_log` table), zero-result queries (the gold for `content_requests` triage), trending items, % of users with ≥1 saved read, conversion from search → play. All deterministic counts.

A new "Suggested content" inbox lands under `/admin/blogs` (compact list of `content_requests` rows with title/url/category/notes, "approve & add feed" CTA when a URL is provided).

## How this connects to Admin

| Surface | What admin controls |
|---|---|
| Today's pick | Already respects `is_featured` + `featured_rank`. Inline ★ on the island lets admin overwrite the pick from the page itself. |
| Mood/category chips | Auto-derived from real data; admin doesn't curate the chip list, just the items' `mood_tags`/`category`/`genre` (already editable on item detail pages). |
| Collections | Created/edited at `/admin/collections` and inline via "Add to collection" on every tile. |
| Search | Searches active items only; admin "Hide from Listen" pulls items out instantly. |
| Trending | Pure event-count; admin sees the leaderboard in `/admin/insights` but doesn't edit it. |
| Suggested content | Empty-search "Suggest content" form posts into `content_requests`; admin triages from `/admin/blogs`. |
| Saved-for-later & playlists | User-owned, never visible to admin (privacy). |

## Technical details

- **DB migration (one)**
  - `listen_collections` + `listen_collection_items` with RLS: public can SELECT where `is_published=true`; admins (`has_role(auth.uid(),'admin')`) can do everything.
  - `listen_events (id, user_id, kind, item_id, action, created_at)` — RLS: a user can insert their own rows; nobody can read except service_role (admin insights call uses `supabaseAdmin`).
  - `content_requests (id, user_id, title, url, kind, notes, status, created_at)` — RLS: any authenticated user can insert; admins read/update.
  - `search_log (id, user_id, q, result_count, created_at)` — same RLS as `listen_events`.
  - GRANTs per template rule; never edit `auth`/`storage`.

- **New server fns** (`createServerFn`, all `requireSupabaseAuth`)
  - `searchListen({ q, kinds, moods, limit })` — debounced caller, runs the four queries in parallel, also writes to `search_log` (fire-and-forget).
  - `logListenEvent({ kind, item_id, action })`
  - `trendingListen({ window: '7d' })` / `recentlyAddedListen({ days: 14 })` / `becauseYouLiked({ limit })`.
  - Collections: `listCollections`, `getCollection`, `adminUpsertCollection`, `adminAddCollectionItem`, `adminRemoveCollectionItem`, `adminReorderCollectionItems`.
  - Suggestions: `createContentRequest`, `adminListContentRequests`, `adminUpdateContentRequest`.
  - Insights: `adminInsightsOverview` (returns top-terms, zero-result terms, trending items, retention basics).

- **New components**
  - `src/components/listen/search-bar.tsx` (with debounce + filter sheet trigger)
  - `src/components/listen/filter-chips.tsx`
  - `src/components/listen/search-results.tsx` (grouped by kind)
  - `src/components/listen/collections-rail.tsx`
  - `src/components/listen/trending-rail.tsx` + `recently-added-rail.tsx` + `because-you-liked-rail.tsx`
  - `src/components/listen/admin-tile-menu.tsx`
  - `src/components/listen/suggest-content-dialog.tsx`
  - `src/hooks/use-is-admin.ts` (single source of truth for the admin flag)

- **New routes**
  - `src/routes/_authenticated/listen.collection.$slug.tsx`
  - `src/routes/admin.collections.tsx` (+ optional detail `admin.collections.$id.tsx`)
  - `src/routes/admin.insights.tsx`

- **Edited**
  - `src/routes/_authenticated/listen.tsx` — mount search bar + filter chips above the segmented tabs; render `<SearchResults>` when `q` is non-empty (hides rails); always render Collections + Trending + Recently added under the chosen tab; wire `useIsAdmin` to mount `AdminTileMenu` on every Tile.
  - `src/routes/admin.tsx` — add Collections, Insights nav chips.
  - `src/lib/playlists.functions.ts` — extend Tile rows with `mood_tags` so chip filtering works client-side without re-querying.

- **No new deps.** Postgres `ilike` + indexes for now; we can graduate to `tsvector` + `pg_trgm` if/when traffic warrants.

## Out of scope (intentionally)

- Full-text search ranking / typo tolerance (Postgres ILIKE for v3; `pg_trgm` if needed later).
- In-app player upgrades, social sharing of search results.
- Personalized ML recommendations — "Because you liked" stays rule-based.
- Comments/likes on blog posts.
- Editor-defined chip taxonomy — derived from real data so it's always honest.
- Renaming `/listen` to `/library` — still premature.

## One call I want you to make before I build

**Trending & search-log writes:** I want to log play/save/search events to power Trending and the Admin Insights page. These are anonymous in admin view (counts only), but the rows include `user_id` so we can do "Because you liked". Two options:
1. **Per-user rows kept indefinitely** (default; small table, supports personal recs).
2. **Aggregate-only** — counts per item per day, no user_id (cleaner privacy, no personal recs).

Default is (1) with RLS so users can read only their own events. Want me to go that way or switch to (2)?
