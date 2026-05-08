## Pass 9 — Moods polish: per-group thumbs, smoother fades, contained scroll

Three concrete fixes plus a tight polish pass over the surface.

### 1. Per-group thumbnails (less sharing)

Today every group in a mood pulls from the same 3 theme images, so neighbors look identical. Switch to **group-specific covers**, falling back to theme covers only when none exist.

- **Reuse what's already here.** 26 mood-eligible groups already have 3 photos each in `public/niche-covers/{slug}/` (audiobook-walkers, founders-walk, hot-girl-walk, sunrise-club, etc.) — wire those in directly via the existing `NICHE_COVERS` registry. No new generation for these.
- **Generate covers for the 22 groups missing them.** 2 images per group (not 3) to keep weight down, abstract on-brand style matching the current mood palette. List:
  - anxiety: `anxiety`
  - burnout: `after-work-wind-down`, `burnout`
  - connection: `long-distance-friends`, `new-friends`, `new-parents`, `small-town-walkers`, `sober-walkers`, `the-commons`
  - grief: `breakup-recovery`, `grief`, `postpartum`
  - quiet: `coastal-walkers`, `creative-block`, `desert-walkers`, `mountain-town-walkers`, `neurodivergent`, `quiet`, `rural-walkers`, `snow-walkers`
  - reset: `city-block-walkers`, `morning-light`, `suburban-loop`, `sunday-reset`
  → ~44 webps under `public/group-covers/{slug}/{1,2}.webp`.
- **New `scripts/compress-group-covers.mjs`** mirrors the niche script and emits `src/data/group-covers.ts` with `{ count, blur[] }` + `groupCoverUrl()`.
- **`MoodThumb` resolution order**: `GROUP_COVERS[slug]` → `NICHE_COVERS[slug]` → `MOOD_COVERS[theme]` → solid band. Component takes `slug` + `theme` and picks the best source.

### 2. Smoother fade (no first-load clunk)

Current `mood-fade` runs `opacity 0 → 1 → 0` on every image with negative `animation-delay`, but until the `<img>` actually decodes the slot is empty, so the first cycle visibly pops in. Fixes:

- Render the **first image as the steady base layer** (no animation, opacity 1). Only images 2..N animate on top with a ping-pong fade. The base is always visible, so initial load shows a complete circle instantly.
- Use **`fetchpriority="high"` on slide #1**, `loading="lazy"` on the rest, and only mount slides 2..N once the base image's `onLoad` has fired (small `useState`). Eliminates the empty/blur flash.
- Replace the linear opacity keyframe with a **smoother curve** (5% hold → ease-in 25% → hold 40% → ease-out 25% → hold 5%) so fades feel like breathing, not blinking.
- Increase cycle to `count * 7s` (slower) and stagger `animation-delay` more gently. Pause via IntersectionObserver stays.
- Honour `prefers-reduced-motion` → only the base image renders.

### 3. Scroll containment (no page-bleed)

The list already has `overscroll-behavior: contain` and `max-h-[19rem]`, but the page still scrolls when you hit either edge on iOS Safari because the inner list isn't actually overflowing on first render in some viewports, and `proximity` snap doesn't lock the boundary.

- Switch container to a fixed `h-[19.5rem]` (not `max-h`) so it always overflows when there are 5+ items, guaranteeing the scroll context owns the gesture.
- Add `touch-action: pan-y` and keep `overscroll-behavior: contain` — together these stop scroll-chaining on iOS.
- Add a small `onTouchMove` guard that only `stopPropagation()` when the inner list can scroll in the gesture direction (prevents accidental locking when list is short).
- Keep the soft top/bottom mask but tighten the gradient stops (8% → 92%) so the mask doesn't visually clip the first/last card.
- Add subtle `↓ scroll` affordance fade-in at the bottom edge when more content is below (CSS only, hides on scroll-end via IntersectionObserver sentinel).

### 4. General polish pass over the Moods surface

Small refinements while we're here:

- Tab row: when you switch tab, the new list should **enter from the top, not all-at-once fade**. Replace `niche-grid-fade` with a 240ms slide-up + fade on the `<ul>`.
- Card `mini` variant: bump the thumb from 32px → 40px now that it carries real photos, tighten left padding, and add a 1px inner shadow on the circle for depth.
- Active chip: add the `count` badge to inactive chips too (it already is) — but lighten the active badge from `bg-white/20` to `bg-white/25` for legibility.
- "See all N" button: only show when `sorted.length > 4` (currently always shows even when the list is fully visible).
- Remove `card-in` stagger on items past index 3 (they're below the fold, animation just adds jank when user scrolls down).

### Files

- **New**: ~44 `public/group-covers/{slug}/{1,2}.webp`, `scripts/compress-group-covers.mjs`, `src/data/group-covers.ts`
- **Edited**: `src/components/groups/mood-thumb.tsx` (resolution order, base-image pattern, load gate), `src/components/groups/moods-collection.tsx` (fixed height, scroll guard, conditional See all, tab transition), `src/components/group-card.tsx` (40px thumb, padding), `src/styles.css` (smoother `mood-fade` curve, mask stops, list slide-in keyframe)

### Out of scope
- New mood themes or category bucketing.
- Backend/data changes.
- Touching Niches, Cities, Today, or Pulse surfaces.
