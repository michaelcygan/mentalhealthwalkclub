# Listen & Read — Launch Audit

## What I found

**1. No actual podcast/audio player exists.**
`NowPlayingDock` only handles *ambient* loops (via `useAmbient`). Podcast episodes and guided walks have no playback path at all — tapping a card does nothing useful.

**2. Tiles aren't clickable on `/listen`.**
The "Podcasts for walking", "Ambient mixes", "Guided walks", "Trending", and "Recently added" rails render `<Tile>` as a plain `<div>`. No `onClick`, no `<Link>`. Same for `SearchResults` rows (only the external-link icon is tappable; the row itself isn't).

**3. The home `PodcastRail` link is wrong.**
It uses `to="/listen/$id" params={{ id: ep.id }}` — that route is the **playlist detail** page, so it tries to load a playlist with the episode's UUID and silently fails.

**4. "Backyard" cover not loading.**
"Backyard" is a row in `listen_collections` whose `cover_url` is broken/empty. `CollectionsRail` renders the image with no fallback, so it's an empty box.

**5. Composer (journal FAB) hidden on `/listen`.**
The reflection composer FAB only mounts on `/` and `/journal`. It should remain available app-wide (subject to the Plus paywall for photo journaling we already shipped).

**6. Cross-platform behavior is inconsistent.**
Tiles in `home/podcast-rail`, `listen/collections-rail`, `listen/hits-rail`, `listen/search-results`, and the `/listen` `Tile` component each handle (or don't handle) clicks differently. There's no single "play this" affordance.

---

## Plan

### A. Build a real audio player (global, persistent)
- Add `PlayerProvider` (`src/lib/player-context.tsx`) with a single `HTMLAudioElement` ref, `play(track)`, `pause`, `toggle`, `seek`, plus state `{ current, playing, loading, position, duration }`. Tracks are `{ id, kind: 'podcast'|'guided'|'ambient', title, subtitle, cover, audio_url, link? }`.
- Mount once in `__root.tsx`.
- Extend `NowPlayingDock` to render the **audio** track when one is loaded (title, cover, play/pause, close). Ambient remains separately handled (mute/stop). When both exist, audio takes priority in the dock; ambient ducks/pauses while audio plays.
- Cleanup on unmount; `canplay` → loading false; `error` → toast + clear.

### B. Make every content card clickable
For each surface, the **tile itself** is the tap target:
- **Podcast** → `player.play({ kind:'podcast', audio_url, ... })`. If no `audio_url`, open the external `link` in a new tab as fallback.
- **Guided walk** → same as podcast.
- **Ambient mix** → `ambient.play(track)` (existing).
- **Article (blog)** → open `link` in new tab.
- **Collection** → navigate to `/listen/collection/$slug`.

Files touched:
- `src/routes/_authenticated/listen.tsx` — `Tile` becomes a button/link with a `kind` + payload.
- `src/components/listen/hits-rail.tsx`, `collections-rail.tsx`, `search-results.tsx`, `today-pick.tsx` — wire each row through the same dispatcher.
- `src/components/home/podcast-rail.tsx` — fix wrong `Link` target; use the player instead.
- `src/components/listen/read-rail.tsx` — confirm article cards open `link`.

### C. Fix "Backyard" cover
- `CollectionsRail` and `Tile` get a graceful image fallback: emoji/gradient block with the collection name initials, plus `onError` to hide broken `<img>`. This makes any missing/broken `cover_url` look intentional instead of empty.
- (Optional) flag missing covers in the admin Collections view so you can fill them in.

### D. Keep the composer available on Listen & Read
- Lift the reflection composer FAB to a shared mount (e.g. inside `_authenticated/route.tsx`) so it appears on `/listen`, `/discover`, `/journal`, `/` — anywhere inside the authenticated shell except routes that already own the bottom-right corner (walk flow, auth, welcome). Existing Plus paywall on photo journaling stays intact.

### E. Sweep for consistency
- Single helper `playOrOpen(item)` used by every rail so behavior is identical everywhere.
- Add `aria-label`s and keyboard focus styles to the new tile buttons.
- Skip tiles whose backing row has no `audio_url` AND no `link` (don't render dead cards).

---

## Technical notes

- `PlayerProvider` uses one `<audio>` element to avoid overlapping playback (matches the pattern in the stack-overflow note).
- The dock stays mobile-only (`md:hidden`) for now; a desktop mini-player can come later.
- No DB or RLS changes. No new server functions. All client-side.
- Podcast `audio_url` already exists on `podcast_episodes`; if any rows are missing it, the tile falls back to the external `link`.

---

## Out of scope (call out if you want it next)
- Background/lock-screen playback metadata (MediaSession API) — easy follow-up.
- Resume position per episode (needs a small `listening_progress` table).
- Queue/up-next from playlists driving the player.

Ready to implement on approval.
