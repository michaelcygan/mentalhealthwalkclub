## Wave 6 — MHWC Radio + First-Party Blog CMS

With retirement done, Wave 6 turns the two "content" surfaces we kept into real, first-party product. Radio replaces the podcast rail as the app's ambient companion, and Blog becomes an editable SEO surface owned by us — not an RSS aggregator.

### Part A — MHWC Radio (Cloudflare R2)

**Goal:** a small, curated set of ambient "stations" that stream from our own storage and play anywhere in the app (home dock, solo/group walk, background).

- Storage: Cloudflare R2 bucket `mhwc-radio` with per-station folders (`stations/forest/`, `stations/rain/`, `stations/city-dusk/`, …), each containing 1–N `.mp3`/`.m4a` tracks + a `manifest.json` (title, artist, license, duration).
- DB: `radio_stations` (slug, title, subtitle, cover_url, is_active, sort) + `radio_tracks` (station_id, storage_key, title, duration_s, sort). Public read, admin write. GRANTs + RLS included.
- Server: `src/lib/radio.functions.ts` — `listStations()`, `getStation(slug)`, `signTrackUrl(track_id)` (short-lived signed R2 URL so we don't expose the bucket).
- Player: fold Radio into the existing universal `NowPlayingDock` — new source type `"radio"` alongside ambient/podcast. Shuffle within a station, auto-advance, remember last station per user in localStorage.
- Surfaces:
  - Home: single "Radio" rail (replaces the retired podcast/listen rails) with station cards.
  - Solo/group walk media panel: "Radio" tab picks a station instead of a podcast.
- Admin: `/admin/radio` — CRUD stations, upload tracks straight to R2 via a signed-PUT server fn, reorder, toggle active.
- Retire the ambient-video backdrop as the *audio* source of truth; keep the video visual, but audio comes from Radio.

**Secrets needed (I'll request via add_secret when we start):** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE` (optional CDN).

### Part B — First-party Blog CMS

**Goal:** `/blog` is our SEO front door. Real posts, real editor, no RSS.

- DB: extend `blog_posts` for first-party use — `author_id`, `slug` (unique), `status` (`draft`|`published`), `body_md`, `body_html`, `cover_url`, `seo_title`, `seo_description`, `published_at`. Keep `reader_html` columns for any legacy rows, but new posts don't use them. Drop the `blog_feeds` FK requirement on new inserts.
- Routes:
  - `/blog` — public index, SEO head, paginated list of published posts.
  - `/blog/$slug` — public post page, JSON-LD `Article`, canonical, OG image = `cover_url`.
  - `/admin/blog` — list + "New post".
  - `/admin/blog/$id` — editor: title, slug (auto from title, editable), cover upload (Supabase Storage `blog-covers` bucket), Markdown body with live preview, SEO title/description, publish toggle.
- Server: `src/lib/blog-cms.functions.ts` — `listPublished`, `getBySlug`, `adminList`, `adminUpsert`, `adminDelete`, `adminPublish`. Markdown → HTML server-side (`marked` + `sanitize-html`) so the client renders trusted HTML.
- Retire the in-app "reader view" for external URLs (`/read/$postId`) — redirect to `/blog` since external ingestion is gone.
- Sitemap: add `/blog` + each published slug to the existing sitemap route.

### Deliverable order

1. Radio DB migration + GRANTs/RLS + admin CRUD server fns.
2. R2 signed-URL helpers (server-only) + admin upload flow.
3. `NowPlayingDock` radio source + home Radio rail + walk media panel Radio tab.
4. Blog CMS DB migration (extend `blog_posts`, add `blog-covers` storage bucket).
5. `/admin/blog` list + editor with Markdown + cover upload.
6. Public `/blog` + `/blog/$slug` with SEO/JSON-LD + sitemap entries.
7. Redirect `/read/*` → `/blog`; grep sweep; typecheck.

### Not in this wave

- Comments/reactions on blog posts.
- Multi-author permissions beyond "admin can edit anything".
- Radio scheduling / live streams (stations are shuffled track lists in V1).
- Wave 7: final launch QA pass (perf, a11y, SEO audit, empty-state polish).

### Question before I start

Radio needs Cloudflare R2 credentials. Do you already have an R2 bucket + API token, or should I walk you through creating one before Wave 6 begins?
