# Curated Podcasts in the Guided Walk Flow

A lightweight podcast layer that slots into the **existing** guided walk flow as a new category. No new players, no new mini-bar — it reuses `GuidedPlayer`, the `live-activity-pill`, and the active-walk screen the app already has. Admin curates feeds; episodes stream from source.

## Scope

**In:** podcast category in guide picker, episode browse + play, RSS sync (server), admin CRUD for feeds + episodes, attribution + safety disclaimer, mood-tag matching.

**Out:** in-app browser, ElevenLabs TTS, blog RSS, downloads/caching of audio, transcripts, comments, ratings, separate global mini-player.

## User flow (from existing composer)

1. User opens composer → picks **Guided** → existing `GuidePicker` opens.
2. New 5th category chip alongside Ambient / Breath / Voice / Music: **Podcast**.
3. Sub-row of podcast categories appears (Calm Down, Think Clearly, Feel Connected, Walk With Hope, Body & Brain, Relationships) — horizontally scrollable, same chip style.
4. List of episodes renders using the **same card component** as guided tracks (cover, title, host = podcast name, duration, mood "fits" pill).
5. Tap an episode → behaves exactly like choosing a guided track today: walk starts, navigates to active walk, episode streams in `GuidedPlayer`.
6. During the walk, the existing `live-activity-pill` already covers minimized state. No new player surface needed.

The user never sees a separate "podcast tab" — it's just one more flavor of guided audio.

## Data model (new tables)

```text
podcast_feeds
  id, rss_url (unique), title, publisher, description, image_url,
  category (calm_down|think_clearly|feel_connected|walk_with_hope|body_brain|relationships),
  credibility (institutional|academic|public_media|science|lifestyle),
  is_active, last_synced_at, last_sync_error, created_at, updated_at

podcast_episodes
  id, feed_id (fk), guid (unique per feed), title, description,
  audio_url, episode_url, image_url, duration_seconds,
  published_at, mood_tags text[], walk_fit_score int (1-5),
  is_active, is_featured, created_at, updated_at
  index: (feed_id, published_at desc), (is_active, walk_fit_score desc)
```

RLS: SELECT for authenticated where `is_active=true`; admin full access via `has_role(uid, 'admin')`. Service-role bypass for sync job.

**Extend `walk_sessions`**: add nullable `podcast_episode_id uuid` (separate from `guided_track_id`) so badges/analytics can distinguish without overloading existing column.

## Reusing `GuidedPlayer` (the key simplification)

Rather than build a podcast player, normalize an episode into the shape `GuidedPlayer` already accepts. Two options — pick one in implementation:

- **A (preferred, zero new player):** Treat `guided_tracks` as the play surface. The picker passes a synthesized `GuidedTrack` object (`audio_url` = enclosure, `title`, `host` = publisher, `duration_seconds`, `cover_url`) directly into the existing `onChoose(track)` callback. Persist the real `podcast_episode_id` on the walk session; `guided_track_id` stays null. `GuidedPlayer` already handles `audio_url` playback, mediaSession metadata, mute, progress.
- B: Add a thin `<PodcastPlayer episodeId={...}/>` that wraps `<audio>` with the same UI shell — only if A leaks abstractions.

A keeps net-new player code at ~0 LOC.

## RSS sync

Server route `src/routes/api/public/hooks/sync-podcast-feeds.ts` (signed, like existing hook routes):
- For each `is_active=true` feed: fetch RSS, parse with a tiny pure-JS parser (no Node-only deps — use `fast-xml-parser`, Worker-safe), upsert episodes by `(feed_id, guid)`, update `last_synced_at`.
- Admin "Sync now" button calls a `createServerFn` (admin-gated) that runs the same logic for one feed.
- pg_cron schedule: every 6h (user can wire up later).

CORS / streaming: enclosure URLs are streamed by the browser `<Audio>` element directly from publisher CDN. We never proxy.

## Admin UI

New tab in `/admin` next to Music: **Podcasts**.

- `/admin/podcasts` — feed list: add feed (paste RSS URL → auto-fill title/publisher/image from first sync), category dropdown, credibility dropdown, active toggle, last synced, "Sync now", row click → episode list.
- `/admin/podcasts/$feedId` — episodes list: title, published date, duration, active toggle, featured toggle, mood-tag multiselect, walk-fit 1–5 slider, source link.

Reuse existing admin shell (`src/routes/admin.tsx`) — just add a Link chip.

Seed feeds (insert via migration as inactive drafts; admin activates):
APA Speaking of Psychology, NPR Life Kit, NPR Life Kit: Health, TED Health, Hidden Brain, The Happiness Lab, 10% Happier, Huberman Lab, On Being, the goop podcast.

## Picker changes (`guide-picker.tsx`)

- Add `{ k: "podcast", label: "Podcast", icon: Podcast }` to `CATS`.
- When `cat === "podcast"`: render podcast category sub-chips, then fetch episodes from `podcast_episodes` joined on `podcast_feeds` filtered by sub-category, sort by `walk_fit_score desc, published_at desc`, limit 30.
- Mood "fits" pill: episode matches if `mood_tags` includes the user's `feeling`.
- Each card shows publisher + small credibility pill (e.g. "APA · Institutional").
- Footer disclaimer (one line, muted): *"Curated audio for reflection — not a substitute for professional care."*

## Safety / attribution

- Always show publisher name on card and in player.
- Always render `episode_url` as a small "source" link in the player overlay.
- Never modify or rehost audio.
- Disclaimer line in podcast picker view (above).

## Files

**New (4)**
- `supabase/migrations/<ts>_podcasts.sql` — tables, RLS, seed feeds, `walk_sessions.podcast_episode_id` column.
- `src/lib/podcasts.functions.ts` — `syncPodcastFeed`, `listPodcastEpisodes` (admin-gated for sync).
- `src/routes/api/public/hooks/sync-podcast-feeds.ts` — signed cron endpoint.
- `src/routes/admin.podcasts.tsx` + `src/routes/admin.podcasts.$feedId.tsx` — admin UI.

**Edited (4)**
- `src/components/guide-picker.tsx` — add Podcast category + sub-chips + episode rendering.
- `src/components/walk-composer/use-walk-composer.tsx` — pass `podcast_episode_id` through to `walk_sessions` insert.
- `src/components/guided-player.tsx` — accept optional `sourceUrl` + publisher props for the source link (or branch on prop presence; ~5 LOC).
- `src/routes/admin.tsx` — add Podcasts nav chip.

**Deps:** `bun add fast-xml-parser` (Worker-safe, pure JS).

## Acceptance criteria

- Admin adds an RSS URL, clicks Sync, sees episodes populate.
- User selects Guided → Podcast → category → episode → walk starts → audio plays via existing `GuidedPlayer`.
- `live-activity-pill` shows the active walk minimized; tap returns to player.
- Publisher + source link visible in player.
- Disabling a feed in admin instantly hides its episodes from users.
- Mood "fits" pill appears when episode tags overlap user feeling.
- Disclaimer line visible in podcast picker.

## Out of scope (explicit)

Home, Groups, friend walk, billing, ElevenLabs, blog RSS, in-app browser, episode reviews, downloads, transcripts, custom mini-player.
