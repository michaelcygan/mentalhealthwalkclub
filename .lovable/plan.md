# Three changes

## 1. Add Mental Illness Happy Hour to podcast feeds

Insert a row into `podcast_feeds` and trigger an initial sync:
- `rss_url`: `https://mentalpod.com/feed/podcast/`
- `title`: `Mental Illness Happy Hour`
- `publisher`: `Paul Gilmartin`
- `is_active`: `true`

Done via a data insert; the existing sync cron will keep it fresh, and we'll kick off one immediate sync so episodes appear right away.

## 2. Shows grid on the homepage (under the Listen carousel)

New section rendered inside `ListenAndRead` on the `listen` tab, directly under the recent-episodes carousel.

- New server fn `listPodcastShows()` in `src/lib/podcasts.functions.ts` — returns active feeds (`id, title, publisher, image_url, episode_count`) ordered by most recent episode.
- New component `src/components/home/shows-grid.tsx` — a 3-column grid of square cover tiles with title underneath. On tap → navigates to `/listen?tab=listen&q=<show title>` so the existing Listen page filters/searches to that show (per your answer: "filter the Listen page to that show").
- Header: small "Shows" label with an "All →" link to `/listen`.

## 3. In-app reader view for articles

Replace the `target="_blank"` external links in `ReadRail`, `BlogRail`, and `SavedReadsList` with a route that opens a parsed reader view inside the app.

### New route: `/read/$postId`
- Layout: top bar with ← back, publisher name, and an "Open original ↗" link (preserves attribution + lets power users escape to the live page).
- Body: article title, byline/date, hero image, parsed article content rendered as clean prose (`prose` Tailwind classes), max-width readable column.
- Footer: small "From {publisher}" line + "Open original" button.

### Parsing (server-side, Worker-safe)
New server fn `getReadableArticle({ post_id })` in `src/lib/blogs.functions.ts`:
1. Load the post row (cached `reader_html`, `reader_excerpt`, `reader_byline`, `reader_parsed_at` if present).
2. If not parsed (or stale > 30 days), fetch the article URL server-side, then use `@mozilla/readability` + `linkedom` (both pure-JS, Worker-compatible — no Node-only deps) to extract clean article HTML. Sanitize with `dompurify` + linkedom's window.
3. Persist the parsed result back to the row for future loads (1 parse per article, then served from cache).
4. Return `{ title, byline, published_at, hero_image, content_html, source_url, publisher }`.

### Schema additions (migration)
Add nullable columns to `blog_posts`:
- `reader_html text`
- `reader_excerpt text`
- `reader_byline text`
- `reader_parsed_at timestamptz`

No new RLS needed (reads go through the server fn using the admin client; writes only happen there).

### Fallback
If Readability returns nothing usable (rare — paywalls, JS-rendered pages), the route shows the title/summary/hero + a prominent "Open original" CTA. No silent failures.

## Technical details

- `@mozilla/readability` + `linkedom` are both pure JS and run in the Cloudflare Worker runtime — confirmed Worker-compatible (no `jsdom`, no native deps).
- Saved Reads + Read rail tiles change from `<a href={link} target="_blank">` to `<Link to="/read/$postId" params={{ postId: p.id }}>`. The bookmark toggle behavior is unchanged.
- Show navigation uses a search-param redirect to `/listen` — no new route file, no schema change.
- Mental Illness Happy Hour insert is a one-shot data change; if duplicate `rss_url`, the insert is a no-op via `ON CONFLICT DO NOTHING`.

## Files

**New**
- `src/components/home/shows-grid.tsx`
- `src/routes/_authenticated/read.$postId.tsx`
- Migration: add reader columns to `blog_posts`

**Edited**
- `src/lib/podcasts.functions.ts` — add `listPodcastShows()`
- `src/lib/blogs.functions.ts` — add `getReadableArticle()` server fn
- `src/lib/blogs.server.ts` — readability helper
- `src/components/home/listen-and-read.tsx` — render `<ShowsGrid />` under `<PodcastRail />`
- `src/components/listen/read-rail.tsx` — link to internal reader
- `src/components/listen/saved-reads-list.tsx` — link to internal reader
- `src/components/home/blog-rail.tsx` — link to internal reader
- Data: insert Mental Illness Happy Hour row + trigger initial sync

## Out of scope (v1)
- Comments / inline highlights / save-progress in reader view.
- Reader view for podcasts (these already open in the in-app player).
- A dedicated `/listen/show/$feedId` page — your answer was to filter the Listen page instead, which we'll honor.
