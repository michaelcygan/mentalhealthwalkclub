## Goal

Tapping a show tile in the homepage "Shows" grid should keep the user on the homepage and re-load the recent-episodes rail above it with just that show's episodes — no navigation to `/listen`.

## UX

- Show tile tap → no route change.
- Rail header changes from "Listen" to the selected show's title, with a small "× All shows" pill on the right that clears the filter.
- Rail re-fetches and shows that show's most recent episodes (up to 12).
- Selected tile in the grid gets a subtle ring so the active filter is obvious.
- Tab switch to "Read" or clearing the pill resets to the default cross-feed recent feed.
- Smooth scroll the rail into view on selection so the update is visible without manual scrolling.

## Implementation

1. **`src/lib/podcasts.functions.ts`** — extend `recentPodcastEpisodes` input with an optional `feedId` (uuid). When present, filter `podcast_episodes` by `feed_id` and skip the cross-feed dedupe. Bump `limit` cap from 24 → 50 so a single show can show more.

2. **`src/components/home/listen-and-read.tsx`** — own the selection state: `{ feedId, title } | null`. Pass it into `PodcastRail` and `ShowsGrid`. Clearing happens via the rail header pill or when the user switches to the Read tab.

3. **`src/components/home/podcast-rail.tsx`** — accept `selectedFeed` + `onClear` props. Re-fetch when `feedId` changes. Replace the "All →" link with a "× <show> · Clear" pill when a feed is selected; otherwise keep the existing "All →" link to `/listen`. Use a `ref` + `scrollIntoView({ behavior: "smooth", block: "nearest" })` when a feed becomes selected.

4. **`src/components/home/shows-grid.tsx`** — replace the `navigate()` onClick with an `onSelect(show)` prop callback. Add a ring (`ring-2 ring-forest`) on the tile whose `id === selectedFeedId`.

## Out of scope

- No changes to `/listen` page behavior or to the search-by-title fallback.
- No persistence of the selected show across reloads (it's transient homepage UI state).
- No changes to the Read tab.
