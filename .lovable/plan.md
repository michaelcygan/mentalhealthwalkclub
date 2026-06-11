## Goal

Let the pill player expand into a full now-playing sheet, then collapse back to the pill. Add the small set of utility controls that earn their place: scrub, skip ±15s, queue, mute/volume, link out.

## Interaction

- Tap the pill anywhere outside the play/close buttons → expand.
- Expanded view slides up from the pill as a bottom sheet (≈85% viewport height, rounded top, drag handle).
- Collapse via: drag handle pull-down, chevron-down button, tap on scrim, or swipe down.
- Pill stays a single tap target (play/pause + close still work); chevron-up affordance hints at expand.
- Honors `prefers-reduced-motion` (fade instead of slide).
- Hidden on the same routes as today (`/auth`, `/welcome`, `/w/*`).

## Expanded layout (top → bottom)

```text
┌─────────────────────────────┐
│         ── drag ──          │
│  ⌄  Now playing       ⋯     │  ← collapse + overflow (link out)
│                             │
│      ┌──────────────┐       │
│      │  cover art   │       │  ← big square, CoverThumb fallback
│      └──────────────┘       │
│                             │
│  Episode title (serif)      │
│  Publisher · 32 min         │
│                             │
│  ──────●───────────────     │  ← scrubber, draggable
│  1:24                 31:08 │
│                             │
│   ⟲15    ▶/⏸ (64px)   ⟳15  │
│                             │
│  🔊 ──●──────              │  ← volume (desktop) / mute toggle (mobile)
│                             │
│  Up next                    │
│  ┌──┐ Track title           │
│  │  │ Publisher · 24 min  ✕ │
│  └──┘                       │
│  …                          │
└─────────────────────────────┘
```

## Utility features (only what earns its keep)

1. **Scrubber** — draggable progress bar with current/remaining time. Already have `position` / `duration` / `seek` in `PlayerProvider`.
2. **Skip ±15s** — standard podcast affordance.
3. **Play/pause** — large primary control.
4. **Queue ("Up next")** — list of upcoming tracks with reorder-by-remove and a clear-all. Tap a queued item to jump to it.
5. **Mute / volume** — toggle mute; show a slider on desktop only (mobile uses system volume).
6. **Open source** — overflow menu with "Open episode page" (uses existing `link`) and "Stop playback".

Deliberately **not** adding (avoid bloat): playback speed, sleep timer, AirPlay/Cast picker, sharing, lyrics/transcript, favoriting. We can revisit if users ask.

## Queue model

Extend `PlayerProvider` with a small queue API — keeps state in one place so the dock, the expanded sheet, and tile click handlers all read/write the same thing.

- `queue: PlayableTrack[]` — upcoming tracks (does not include `current`).
- `enqueue(track)` — appends; toast "Added to queue".
- `playNext(track)` — inserts at index 0.
- `removeFromQueue(id)` / `clearQueue()`.
- `skipNext()` — advances to `queue[0]`, shifts the queue.
- Auto-advance on `ended`: if queue has items, `skipNext()`; otherwise stop.

Wire `enqueue` / `playNext` into a small "⋯" menu on every Tile (long-press or kebab) so users can build a queue from `/listen`. **In scope for this turn:** the menu on `HitsRail` cards, `/listen` Tiles, search results, and the home `PodcastRail`. Ambient and blog items skip the queue menu (ambient uses its own loop; blog opens externally).

## Files

- `src/lib/player-context.tsx` — add `queue`, `enqueue`, `playNext`, `removeFromQueue`, `clearQueue`, `skipNext`; wire `ended` → auto-advance.
- `src/components/now-playing-dock.tsx` — pill becomes a button that toggles the expanded sheet; keep play/close as nested buttons with `stopPropagation`; add chevron-up affordance.
- `src/components/now-playing-sheet.tsx` *(new)* — expanded sheet built on shadcn `Sheet` (side="bottom") with drag handle, cover, title, scrubber, transport, volume, queue list, overflow menu.
- `src/components/listen/tile-actions.tsx` *(new, small)* — kebab menu (`DropdownMenu`) with "Play now / Play next / Add to queue / Open source".
- Touch points to add the kebab: `src/routes/_authenticated/listen.tsx` (Tile), `src/components/listen/hits-rail.tsx`, `src/components/listen/search-results.tsx`, `src/components/home/podcast-rail.tsx`.

## Technical notes

- The scrubber uses shadcn `Slider`; on drag-end call `seek(value)`. Throttle position updates while dragging so the thumb doesn't fight `timeupdate`.
- Sheet uses `Sheet` from `@/components/ui/sheet` with `side="bottom"`, custom max-height, and a visible grab handle. On mobile, anchored above the tab bar via the existing safe-area inset math.
- Queue persists in memory only (matches current player scope — no resume-position work yet, per earlier out-of-scope call).
- `MediaSession` already wired for play/pause; extend to `previoustrack` (skip −15s) and `nexttrack` (skipNext).

## Out of scope

- Resume position per episode, cross-device queue sync, sleep timer, playback speed, sharing, AirPlay/Cast.
