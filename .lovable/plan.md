## Overview

Extend the existing Radio system so a single station can mix uploaded audio, direct audio URLs, and podcast episodes selected from RSS feeds, with continuous playback, ordered/shuffle modes, per-item repeat, and a safe resume-last-station preference. Reuse the existing player, RSS parser, and podcast sync — no new player, no new parser, no ads.

I'll run `npm run lint` and `npm run build` after every wave and fix issues before continuing. If I can't finish in one pass, I'll stop only at a clean wave boundary.

## Waves

**Wave 0 — Audit.** Read current stations, tracks, feeds, RLS, storage buckets, player behavior. Confirm DnD Kit availability (install `@dnd-kit/core` + `sortable` if not present). No data changes.

**Wave 1 — Schema (migration).** Extend `radio_tracks`:
- `source_type text NOT NULL DEFAULT 'upload' CHECK (source_type IN ('upload','external_url','podcast_episode'))`
- `external_url text NULL`, `podcast_episode_id uuid NULL REFERENCES podcast_episodes(id) ON DELETE SET NULL`
- `repeat_count int NOT NULL DEFAULT 1 CHECK (repeat_count BETWEEN 1 AND 20)`
- Make `storage_key` nullable
- CHECK constraint enforcing exactly-one-valid-source per row
- Partial unique index on `(station_id, podcast_episode_id) WHERE podcast_episode_id IS NOT NULL`
- Backfill existing rows to `source_type='upload'`, `repeat_count=1`

Extend `radio_stations`: `playback_mode ('ordered'|'shuffle') default 'shuffle'`, `loop_enabled bool default true`, `is_default bool default false` + partial unique index for a single active default.

Extend `podcast_feeds`: `radio_enabled bool default false` (independent of existing `is_active` public visibility).

**Wave 2 — Podcast source management (admin).** Restore `admin.podcasts` as a Radio-scoped subview under `/admin/radio` (tabs: Stations | Podcast sources). Server fns: `adminListRadioFeeds`, `adminAddPodcastFeed(rssUrl)` (reuses existing parser + sync, sets `radio_enabled=true`), `adminSyncFeed(id)`, `adminSetRadioEnabled`, `adminRemoveFeedSource` (blocks hard delete if episodes referenced by any track — soft-disable + explain). Server-side URL safety: HTTPS-only, reject localhost/loopback/private ranges/metadata IPs, timeout, size limit, capped redirects.

**Wave 3 — Multi-select episode picker.** Station editor "Add to station" button opens a sheet with three tabs: Upload / Link / Podcast. Podcast tab:
- Show selector (radio-enabled feeds only) + "Add new RSS" inline
- Sync now, last-synced, latest-episode date
- Title filter, "Select all visible", "Add newest 5/10"
- Rows: title, show, published, duration, already-in-station badge, preview
- New server fn `adminAddPodcastEpisodesToStation({stationId, episodeIds[]})` — validates admin+station, dedupes, excludes existing, filters unplayable, atomic multi-row insert with consecutive sort values, returns `{added, alreadyPresent, unavailable}`.

**Wave 4 — Direct audio links.** "Add audio link" form: URL/title/artist/duration. Server validates HTTPS, blocks unsafe schemes and private ranges, warns on likely-webpage URLs (host allowlist heuristic). Save inserts row with `source_type='external_url'`. Never rehost.

**Wave 5 — Uploads.** Preserve current direct-to-Supabase upload flow; add multi-file selection, per-file progress, cancel/retry. Row insert uses `source_type='upload'`. No app-server proxying.

**Wave 6 — Central resolver.** New server fn `resolveRadioItem({itemId})` returning normalized `{id, stationId, sourceType, title, artist, durationSeconds, audioUrl, sourcePageUrl, imageUrl}`:
- upload → fresh short-lived `radio-tracks` signed URL
- external_url → validated saved URL
- podcast_episode → join `podcast_episodes.audio_url` + `episode_url` + image
Refactor `radio-client.ts` to route every source through this fn.

**Wave 7 — Sequencing & randomization.** Client-side cycle builder: expand active items by `repeat_count`, then order or shuffle (with best-effort no-adjacent-same-item and no-adjacent-same-show). New cycle on loop. Admin toggles for mode/loop/default. UI shows estimated cycle duration (labelled "Estimated minimum" if any durations missing).

**Wave 8 — Continuous playback + resume.** Introduce `PlayableKind = 'podcast'|'guided'|'radio'` and a `RadioSession` controller layered on the existing player (no second player). Lazy-resolve current + next item only. On ended → advance, resolve, play; on failure → mark failed for this cycle, skip; on cycle end → build next cycle if loop, else stop. Other content types (podcast/guided/other station/sign-out) clear the session. Preference `resume_last_radio_station` stored in `user_preferences` (or local for guests); on app boot with preference on, show one-tap "Resume Radio" banner instead of auto-playing sound. Never persist signed URLs.

**Wave 9 — Station editor UI.** Rebuild `/admin/radio/$id` per spec: station info, playback settings, unified "Add to station" launcher, one drag-and-drop playlist across all source types (`@dnd-kit/sortable`), source badges (Upload/Link/Podcast), inline repeat count, active toggle, preview, edit, delete. Item edit sheet: title/artist overrides, repeat, active; podcast rows show read-only source info + "Open source episode". "Preview station" reuses listener resolver but excludes hidden items and does not consume the admin's Radio usage.

**Wave 10 — Feed sync behavior.** Confirm sync updates episodes but never mutates station membership. "Sync now" available from picker. Data model already supports future auto-add-newest — leave disabled.

**Wave 11 — Health checks + graceful failure.** Admin "Check station" action validates storage existence, URL syntax, podcast episode presence + `audio_url`, no dupe podcast refs, valid repeat counts, at least one active playable. Listener: skip failed items once per cycle, stop safely when nothing plays, single concise error only if station is entirely unplayable; log structured diagnostic to a lightweight `radio_item_health` table (admin-visible).

**Wave 12 — Listener UX.** Station cards show cover/title/subtitle/approx cycle duration and optional source-variety line. Default-station used when "Play Radio" invoked without a prior selection. "Continue listening to [Station]" surface when a remembered station exists. Now Playing shows correct attribution per source; podcast items get a subtle "View source" link (opens in new tab, playback continues).

**Wave 13 — Security pass.** Every admin mutation server-side gated on admin role. RSS/URL fetch guard shared util (`src/lib/url-safety.server.ts`) used by both feed import and link add. Sanitize any RSS-derived HTML displayed to admins (`DOMPurify` if not present — server-side strip via existing patterns). Public resolver responses never leak admin-only fields.

**Wave 14 — QA + build.** Manual and Playwright checks for the scenarios enumerated in the spec (mixed station, ordered/shuffle, loop, repeat, hidden, external failure, signed-URL expiration mid-session, resume flow, autoplay block fallback, entitlement limits, admin preview not consuming allowance). Final `npm run lint` + `npm run build` clean.

## Technical Notes

- Reuse: existing player (`player-context.tsx`), RSS parser (`podcasts.server.ts`), sync (`syncAllActiveFeeds`), `radio-tracks`/`radio-covers` buckets, `increment_radio_usage`.
- `radio_tracks` remains the item table; podcast/link items store null `storage_key`. All player code goes through `resolveRadioItem`.
- Shuffle/loop stays in the client controller — no server writes for randomization.
- Resume preference stores slug + intent only; on resume we always freshly resolve a URL.
- Admins can hard-delete only feeds with zero referenced episodes; otherwise `radio_enabled=false`.
- No advertising surfaces of any kind, per spec.

## Stop / Continue

If I hit budget, natural stop points are end-of-Wave-3 (schema + multi-select shipping), end-of-Wave-6 (resolver ready), or end-of-Wave-9 (editor complete). I'll clearly note remaining waves if I stop.
