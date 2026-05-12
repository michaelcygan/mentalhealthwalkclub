## Podcast UX pass

Four scoped fixes based on the screenshots.

### 1. Make the podcast picker scrollable

In `src/components/walk-composer/walk-composer.tsx`, the `pickGuide` branch wraps `<GuidePicker>` in a non-scrolling `<div className="px-4 pb-6">`. The outer `DrawerContent` is capped at `max-h-[92vh]`, so once the list exceeds the drawer height it gets clipped (no scroll, no bottom CTA reachable).

Fix: give that branch the same scroll affordance the main composer uses — `className="overflow-y-auto px-4 pb-8"` plus a flex column on `DrawerContent` so the header stays pinned and the body scrolls. Also make sure `PodcastBrowser`'s sticky-ish category chip row still works inside the scroll container.

### 2. Feed-first browsing (fix "all of one podcast")

Today `PodcastBrowser` queries the 30 highest `walk_fit_score` episodes in a category, which collapses into one show (e.g. all 10% Happier). Restructure into two levels:

- **Level 1 — Shows grid.** Within the selected category, render the distinct active feeds as square cover tiles (2-col grid on mobile), showing feed image + title + publisher. Source: `podcast_feeds` filtered by `category` and `is_active`.
- **Level 2 — Episodes for chosen show.** Tapping a show tile drills into a list of that feed's most recent ~20 episodes (current row layout, but constrained to one feed). A small back chevron returns to the shows grid. Selecting an episode behaves exactly like today (calls `onChoose` → composer/sheet handles persistence).
- Optional small "Recent across shows" row above the grid (one latest episode per feed, max 6) for quick discovery — keep it lightweight and only if it doesn't push the grid below the fold.

This makes discovery feel like a podcast app instead of a single-show feed, and naturally diversifies what users see.

### 3. Fix clipped thumbnails

In the episode row inside `PodcastBrowser`, the cover wrapper is `h-16 w-16 rounded-xl gradient-forest` with the `<img>` using `object-cover`. The 10% Happier square gets cropped because the cover already has its own padding/text baked in. Switch the image to `object-contain` on a neutral (or feed-tinted) background, and add `aspect-square` to the new shows grid tiles so feed art is shown intact. Apply the same to the in-walk player's mini cover if it shares the same pattern.

### 4. Auto-play podcast when the walk starts

In `src/components/guided-player.tsx`, playback only begins on tap (`begin()`). For podcast walks we want it to start with the walk and remain pausable from the existing walk Pause button.

- Add an `autoStart?: boolean` prop. When true and `track` is loaded and `paused` is false, call `begin()` once on mount inside a `useEffect` (guarded by `started`).
- Wire it up: in `GuidedModule` pass `autoStart` only on the podcast branch (the voice-guide branch keeps the explicit "tap to begin" since some are generative ambient pads users may want to defer).
- The existing `paused` effect already syncs the audio element with the walk-level Pause button, so the global Pause will keep working unchanged.
- Browser autoplay note: the walk start click on the composer's "Begin walking" CTA is the same user gesture chain, so `audio.play()` should be permitted. If a browser still blocks it, surface a one-tap "Tap to start audio" affordance inside the player (already effectively the current Play button) — no extra UI needed.

### Out of scope

- Voice-guide content (user is adding ambient music separately).
- Mini-player / cross-page persistence.
- Search, queue, downloads, resume across walks.

### Files touched

- `src/components/walk-composer/walk-composer.tsx` — scroll wrapper for pickGuide branch.
- `src/components/guide-picker.tsx` — restructure `PodcastBrowser` into shows grid + episode drill-down; image fit fixes.
- `src/components/active-walk/podcast-picker-sheet.tsx` — inherits the new browser; verify scroll inside drawer.
- `src/components/active-walk/format-modules/guided-module.tsx` — pass `autoStart` for podcast playback.
- `src/components/guided-player.tsx` — add `autoStart` prop + effect; thumbnail fit if relevant.

No DB or server changes.
