## Pass 8 — Moods polish + locations audit

### 1. Mood list: scrollable, ~4 visible

Currently `MoodsCollection` slices to 6 in a 2-col grid, with a separate "See all" sheet. On 390px the user sees ~3 rows comfortably and the rest pushes the page long.

Change to a **single-column, vertically scrollable list** capped to a fixed height that shows ~4 rows, then scrolls in-place:

- Replace the 2-col grid with a 1-col list inside a `max-h-[19rem] overflow-y-auto` container with `scroll-snap-type: y proximity`, `overscroll-behavior: contain`, soft top/bottom mask (`mask-image: linear-gradient(...)`), and `no-scrollbar`.
- Render **all** groups in the active mood (no slice). The sheet "See all" stays available as a fullscreen browse, but is no longer required to discover the list.
- Each item is the existing `variant="mini"` card (no new variant), with the circle thumbnail upgraded (see §2).
- Tab switch keeps `viewTransition()` so the list cross-fades.

### 2. Mood thumbnails: photo circles with gentle slideshow

Each `mini` card today shows a flat colored square (`themeBand`). Replace with a circular photo that slowly cross-fades through 3 images, similar to niches but slower and offset per card so the whole list breathes.

- **Generate 3 square images per theme** (8 themes × 3 = 24 webps), 384×384, saved to `public/mood-covers/{theme}/{1,2,3}.webp`. Themes: `anxiety, burnout, grief, depression, loneliness, reset, quiet, connection`. Style brief: soft, abstract, on-brand (muted, painterly, no people-faces, no text), each tinted toward the existing themeTint hue so they harmonize with the card.
- **Compress + LQIP**: new `scripts/compress-moods.mjs` (mirror of `compress-niches.mjs`) → writes `src/data/mood-covers.ts` with `{ count, blur[] }` and a `moodUrl(theme, i)` helper.
- **New tiny component** `src/components/groups/mood-thumb.tsx` — a 32px circle that:
  - Renders all 3 images stacked, opacity-cycled via CSS `@keyframes mood-fade` (15s cycle, 5s per slide).
  - Uses `animation-delay: -{hash(group.id) % 15}s` so adjacent cards are out of phase.
  - Pauses via `animation-play-state: paused` when off-screen using IntersectionObserver (same pattern as `CityTile`).
  - Falls back to the existing `themeBand` color if the theme has no covers.
- **Wire into `GroupCard` `mini` variant**: replace the `<span class="...band">` with `<MoodThumb theme={group.theme} groupId={group.id} fallbackBand={band} />`. No other variant touched.
- Respect `prefers-reduced-motion`: drop to a static first image.

### 3. Location coverage audit (read-only)

Verified all chapters:
- ~42 chapters have photo cover sets (`src/data/city-covers.ts`).
- All remaining chapters fall back to procedural sky + silhouette in `CityTile` (`src/data/city-procedural.ts`) — no chapter renders blank.
- Coverage looks complete; recommend **no new image generation** for locations this pass. If you want photo coverage for everything, I can queue a follow-up to generate the ~28 missing cities (4 day-states each = ~112 images, heavier job).

### Files

- **New**: `public/mood-covers/{8 themes}/{1,2,3}.webp` (24 images), `scripts/compress-moods.mjs`, `src/data/mood-covers.ts`, `src/components/groups/mood-thumb.tsx`
- **Edited**: `src/components/groups/moods-collection.tsx` (scrollable list, no slice), `src/components/group-card.tsx` (mini variant uses MoodThumb), `src/styles.css` (`mood-fade` keyframes + scroll mask utility)

### Out of scope
- New mood card variant (reuse `mini`).
- Backend / data model changes.
- Generating photos for the ~28 procedural-only cities (separate ask if wanted).
