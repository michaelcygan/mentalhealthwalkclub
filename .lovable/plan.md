## 1. Refresh the show header in the podcast picker

In `src/components/guide-picker.tsx` (the `PodcastBrowser` component), the "active feed" view currently renders the show as a row that looks visually identical to an episode row. Replace it with a compact, show-styled header inspired by a podcast detail page — but kept vertically short so the episode list is still the focus:

- Larger square cover (~64–72px) with subtle rounded corners and a soft shadow.
- Show title in the serif display face, one line, slightly larger weight.
- Publisher + episode count (e.g. "TED · 24 episodes") on a single muted line.
- A 1–2 line clamped description pulled from `podcast_feeds.description`.
- Keep the "‹ All shows" affordance immediately above; nothing else gets bigger.
- Episode rows below stay exactly as they are today.

Layout sketch:

```text
‹ All shows
┌─────────────────────────────────────┐
│ ▢▢   TED Health                     │
│ ▢▢   TED · 24 episodes              │
│ ▢▢   Short show description, two    │
│      lines max, muted text.         │
└─────────────────────────────────────┘
Silence and stillness… (episode)
What are allergies… (episode)
…
```

No data model changes — `description` is already selected on `podcast_feeds`. We just need to render it and tighten the visual hierarchy so the header reads as "show", and the rows below read as "pick one".

## 2. Make the post-podcast-pick → walk transition feel instant

Today, after the user taps an episode, this happens serially:

1. `beginWalk` inserts a `walk_sessions` row (network round-trip).
2. Router navigates to `/walk/active/$id`.
3. The route fetches the session row.
4. `WalkRuntime` then notices `podcastEpisodeId`, fetches `podcast_episodes` metadata.
5. Only then is the `<audio>` element pointed at `audio_url` and buffering begins.

Result: 3 sequential round-trips before audio is even buffering, plus a blank `LoadingScreen`.

The fix is to start everything we already know about in parallel the moment the user taps the episode, and to warm the runtime so it doesn't have to re-discover the episode.

### Changes

- **`use-walk-composer.tsx → beginWalk`**
  - When `track.podcast_episode_id` is set, start three things in parallel via `Promise.all`:
    a. `supabase.from("walk_sessions").insert(...)`
    b. A "warm" of the runtime: pass the already-known episode metadata (`title`, `audio_url`, `duration_seconds`, `cover_url`, host) directly into `WalkRuntime` via a new `primePodcast(meta)` method, so step 4 above becomes a no-op.
    c. A best-effort `<link rel="preload" as="audio" href={audio_url} fetchpriority="high">` injection (and `new Audio(url).load()` fallback) so the CDN handshake starts before navigation.
  - Only navigate after the insert resolves (we need the id), but the audio is already buffering by then.

- **`src/lib/walk-runtime.tsx`**
  - Add `primePodcast(meta)` that sets `podcast` state immediately and creates the `HTMLAudioElement` with the `audio_url` so playback can begin as soon as the route mounts.
  - In the existing `useEffect` that loads podcast metadata, short-circuit when `podcast?.episodeId === epId` (already true today) — just make sure the primed state matches.
  - Set `audio.preload = "auto"` (currently likely "metadata") for podcast episodes so buffering is aggressive.

- **`src/routes/walk.active.$id.tsx`**
  - Drop the full-screen `LoadingScreen` for podcast walks when the runtime already has a primed `podcast` and `active` matches `id`. Render the `ActiveWalkShell` skeleton immediately with the episode card; the GPS/session row finishing in the background is invisible to the user.
  - Keep `LoadingScreen` for the non-primed case (deep links, refresh).

- **(Optional, low risk)** Add `prefetch` on hover/long-press of an episode in `PodcastBrowser` — issue a `HEAD` to `audio_url` so the CDN edge is warm by the time the user taps. Skip if it adds complexity.

### Expected outcome

From the user's tap on an episode to audible audio:
- before: insert (round-trip) → navigate → fetch session → fetch episode → audio load → play (~1.5–3s perceived).
- after: insert + audio buffering happen concurrently; the active walk screen mounts with the episode card already populated. Perceived delay drops to roughly the insert latency (~200–500ms), and audio is ready to play almost immediately.

## Files to touch

- `src/components/guide-picker.tsx` — show-header redesign in `PodcastBrowser`.
- `src/components/walk-composer/use-walk-composer.tsx` — parallel insert + prime + preload in `beginWalk`.
- `src/lib/walk-runtime.tsx` — `primePodcast(meta)` API, eager `audio.preload = "auto"`.
- `src/routes/walk.active.$id.tsx` — skip `LoadingScreen` when runtime is primed.

No DB migrations, no schema changes, no new dependencies.