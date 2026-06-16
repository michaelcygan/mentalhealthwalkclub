# Solo walk: media as a companion, not a "walk type"

Two problems to solve together:

1. **Bug** — a user reported ambient music didn't play on their solo walk.
2. **Design** — making the user pick one audio source up front makes the choice feel like a commitment ("am I a 'podcast walk' person?") and there's no way to change your mind mid-walk. Real walks are messier: start in silence, put a podcast on after 10 minutes, drop into ambient when the podcast ends, try a guided meditation later.

## What changes (UX)

### Pre-walk
- Replace the "What do you want to hear?" required picker with a soft **"Start with… (optional)"** section.
- Options stay the same (Silence / Ambient / Podcast / Playlist), but default is **Silence** and the copy makes clear you can change it any time during the walk.
- Remove the implicit "walk type = audio type" framing.

### Active walk — new Media panel
A persistent card on the active screen (replaces today's read-only "ambient now-playing" strip) with four tabs/segments:

```text
[ Silence ] [ Ambient ] [ Podcast ] [ Playlist / Guided ]
```

- **Silence** — stops whatever is playing. Visual confirmation only.
- **Ambient** — start / stop / skip / volume. Works even if a podcast was playing (it stops the podcast first).
- **Podcast** — quick list of recent / saved podcast episodes; tap to play. Surfaces the current `now-playing-dock` transport (play/pause, ±15s) inline so the user doesn't have to scroll.
- **Playlist / Guided** — pick a saved playlist or a single guided track; loads into the player queue.

Switching tabs gracefully hands off: starting a podcast stops ambient with a 300ms fade (already handled in `player-context.tsx`); starting ambient stops the podcast.

### Post-walk
- No change to save behavior. Whatever was playing last is recorded as `podcast_episode_id` only if a podcast was active at end (otherwise null). The "this was an ambient walk" implication goes away.

## What changes (code)

### Bug fix
In `src/routes/_authenticated/walk.index.tsx`:

- `start()` calls `ambient.start()` immediately after `setStage("active")`. But `ambient.start()` early-returns when `library.length === 0`, and the library load is async (kicked off in `AmbientPlayerProvider` when `user` becomes available). On a fresh load or slow network it can lose the race.
- Fix: in `ambient-context.tsx`, if `start()` is called before the library is ready, queue the intent and start once `library` populates. Alternative (simpler): in `walk.index.tsx`, await library readiness via a small `useEffect` that calls `ambient.start()` once `source.kind === "ambient" && stage === "active" && ambient.hasLibrary && !ambient.current`.
- Also add a user-facing fallback: if ambient is requested and `hasLibrary` is still false after 3s, toast "Ambient mix isn't ready yet — try again in a moment" rather than silently doing nothing.

### New component
`src/components/walk/media-panel.tsx` — the four-tab control described above. Reuses:
- `useAmbient()` for ambient controls
- `usePlayer()` for podcast / playlist / guided transport
- `listMyPlaylists`, `listenCatalog` (already loaded in walk.index)
- A small inline transport (play/pause, ±15s, track title) so users don't need the global dock

### Edits
- `walk.index.tsx`:
  - Demote `AudioSourcePicker` on pre-walk to optional, default `silence`.
  - On `active` stage, render `<MediaPanel />` instead of the current read-only ambient strip.
  - Remove the `useEffect` that auto-plays podcast/playlist from `source` on stage change — initial start still honored, but subsequent changes go through the panel directly.
- `ambient-context.tsx`: queue-then-flush behavior in `start()` (see bug fix).
- `AudioSourcePicker`: unchanged API; still used pre-walk.

### Not changing
- DB schema, `walk_sessions` columns, player/ambient core logic, now-playing dock.
- Guided walks scaffolding stays as-is; the Playlist/Guided tab uses whatever guided tracks already exist in `guided_tracks`.

## Out of scope (call out for v1.5)
- Mixing ambient *under* a podcast (true ducking) — needs a second audio graph.
- Saving "media timeline" per walk for the recap.
- Guided walks as a first-class flow with a curated catalog screen.

## Files touched
- `src/routes/_authenticated/walk.index.tsx` (edit)
- `src/lib/ambient-context.tsx` (edit — race fix)
- `src/components/walk/media-panel.tsx` (new)
- `src/components/audio/audio-source-picker.tsx` (minor copy + optional default)
