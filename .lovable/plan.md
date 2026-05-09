# Groups — Pass 10

Three threads: (1) bring "Find your tribe" in line with the Moods scroll model, (2) give every city tile a slow 3-photo refresh per time-of-day, (3) call out what's still worth doing on Groups.

## 1. "Find your tribe" — scrollable at 4 rows

Today the Niches grid renders all 26 tiles at once and bleeds the page scroll. Mirror the Moods pattern so the section owns the gesture and only 4 rows are visible.

In `src/components/groups/niche-collection.tsx`:
- Wrap the `<ul>` in a fixed-height container sized to exactly 4 rows of tiles + 3 gaps for the active breakpoint (3 cols on mobile, 4 on `sm`, 6 on `md`).
- Add `overflow-y-auto`, `overscroll-behavior: contain`, `touch-action: pan-y`, and reuse `.scroll-soft-mask` for the top/bottom fade.
- Show a "See all N" button (same style as Moods) only when `filtered.length > rowsVisible * cols`. Tapping it opens the existing shared see-all sheet from `groups-tab.tsx` (extend `setSheet({ title, groups })`).
- Keep the per-tab `key={tab}` reset + `list-slide-in` so swapping tabs scrolls back to top with the same animation Moods uses.
- Tighten tile aspect from `aspect-square` to a touch shorter (e.g. `aspect-[1/0.95]`) so 4 rows on a 390px viewport stays under ~70vh.

Acceptance: on the iPhone-sized preview, only 4 rows of niche tiles are visible at rest; scrolling inside the list never scrolls the page; reaching either end stops cleanly.

## 2. City tiles — 3 photos per time state, slow refresh

Goal: every `CityTile` cycles between 3 images for its current `DayState` on the same gentle cadence the niche tiles use, with the existing one as photo #1 and 2 freshly generated alternates.

### Data shape
Update `src/data/city-covers.ts`:
```ts
export interface CityCover {
  tz: string;
  count: Record<DayState, number>;   // usually 3, falls back to 1 if alt missing
  blur: Record<DayState, string[]>;  // LQIPs aligned with count
}
export const coverUrl = (slug: string, state: DayState, i: number) =>
  `/city-covers/${slug}/${state}${i === 0 ? '' : `-${i + 1}`}.webp`;
```
Files on disk:
- `dawn.webp` (existing) → index 0
- `dawn-2.webp`, `dawn-3.webp` → indices 1, 2
- Same for `day`, `golden`, `night`.

### Generation
- New script `scripts/gen-city-alts.mjs`: walks the 43 photo cities × 4 states, calls `imagegen` twice per state with a city/state-specific prompt template ("[city] skyline at dawn, soft pastel sky, cinematic, no text"), saves to `public/city-covers/{slug}/{state}-2.jpg` and `-3.jpg` (skips files that already exist so the run is resumable).
- Extend `scripts/compress-covers.mjs` to also process `-2`/`-3` siblings: emit them as webp, push their LQIPs into `blur[state]`, and write `count[state] = N` into the regenerated `city-covers.ts`.
- Procedural cities (`CITY_PROCEDURAL`) stay as-is — they already animate via Ken Burns.

Total: ~344 new generations + compression. Same pipeline as the Pass 9 group covers, just keyed by `(slug, state)`.

### Render
In `src/components/groups/city-tile.tsx`:
- Lift the niche tile's slow-rotate logic into a tiny shared hook `useSlowRotate(count, { minMs: 7000, maxMs: 11000, jitter: 4000 })` placed in `src/lib/mobile.ts` (already the catch-all for tiny mobile utils).
- Render the base `<img>` as today (image #0, eager, Ken Burns), then mount images #1..N-1 once the base fires `onLoad`, absolutely positioned, with a 1.4s opacity crossfade controlled by the hook's active index.
- Keep the existing `IntersectionObserver` pause and respect `prefers-reduced-motion` (skip rotation, show only image #0).
- When `count[state] === 1`, behavior is identical to today — no alternates, no extra DOM.

Acceptance: on a city tile in view, after ~7–11s the photo cross-fades to a sibling of the same time-of-day; scroll off and back, no flicker; reduced-motion users see only the base photo.

## 3. What's left on Groups to make it world-class

Quick honest pass — pick any subset, not all:

- **City tile time-of-day caption**: small "5:42am · golden" overlay using the data we already compute, fading in for 3s after a rotation.
- **PulseRail readability**: at 390px the auto-drift is fast and the pills are dense. Pause on tap-and-hold + slow the drift by ~25%.
- **TodayPanel hierarchy**: "Yours" and "For you" feel visually equal. Promote "Yours" with a faint band of brand accent at left edge so the eye lands there first.
- **Search empty-state**: today's chips suggest "quiet" / "near you" / "show all". Add one personalized chip when `myThemes.length > 0` ("Try [first theme]").
- **Sticky filter row**: when collapsed, the live counter line sits awkwardly above the search. Move it to the right of the search input as a tiny pill so the row stays one line tall.
- **Group detail sheet**: side="right" on mobile feels like a desktop pattern. Switch to `side="bottom"` with `h-[92vh]` and a drag handle on phones (`useIsMobile`) for a more native feel.
- **Haptics coverage**: chip toggles in `groups-tab.tsx`, mood/niche tab switches, and "See all" sheet opens don't currently call `haptic()` — one-line additions.
- **Skeletons**: the current 4-card skeleton block for `loading` doesn't reflect the new modules. Replace with a tiny set of skeletons matching PulseRail + TodayPanel + Moods.
- **A11y**: the Moods/Niches tab rows are `<button>`s but not in a `role="tablist"`. Add roles + `aria-selected` so screen readers announce them as tabs.
- **Perf**: gate `CityGallery` and `NicheCollection` behind `content-visibility: auto` (cv-auto class is already wired in for some). Also add `fetchpriority="high"` only to the first image in the first viewport-visible tile to avoid LCP regression from the new alternates.

## Out of scope
New backend tables, new modules, copy rewrites of section headers, anything outside the Groups tab.

## Files touched (estimate)
- New: `scripts/gen-city-alts.mjs`; ~258 new `.webp` under `public/city-covers/{slug}/`.
- Edited: `scripts/compress-covers.mjs`, `src/data/city-covers.ts`, `src/components/groups/city-tile.tsx`, `src/components/groups/niche-collection.tsx`, `src/components/groups-tab.tsx` (wire niche see-all into shared sheet), `src/lib/mobile.ts` (small `useSlowRotate` hook), `src/styles.css` (only if a new utility is needed).