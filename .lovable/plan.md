# Groups — Pass 6: Niches reimagined + 2026 polish

Two main moves: (1) shrink and segment **Find your tribe** while giving every niche real photographic life through staggered crossfading slideshows, and (2) layer in cutting-edge details that make the whole page feel alive without ever shouting.

## 1. "Find your tribe" — segmented & dense

**Current state:** 26 niches as huge 2-col emoji tiles dump ~13 rows of vertical real estate. They dominate the page and feel taller than the city tiles above them.

**New layout (`src/components/groups/niche-collection.tsx`)**:

- A single section: eyebrow + serif title + sub. Below it, a thin pill-tab strip:
  - `All · Time of day · With others · Phone-free · Work & life · Mood`
- Tile sizing tightened from 2/3/4-col to **3/4/6-col** (`grid-cols-3 sm:grid-cols-4 md:grid-cols-6`), with smaller padding. Cuts vertical footprint roughly in half.
- Inactive tabs are crossfaded out with a 200ms fade so the niches feel like a single living surface rather than a jumpy filter.
- A subtle **auto-drift horizontal scroll** kicks in only when the active tab has more than fits the row(s); pauses on hover/touch (reuse PulseRail's rAF pattern). Default tab is "All" with vertical wrap.
- **Tab classification map** (deterministic, by slug):
  - Time: 5am, sunrise, sunset, night-owls, lunchbreak, shift, rainy
  - With others: dog-parents, stroller, empty-nesters, solo-travelers, caregivers, healthcare, teachers, founders
  - Phone-free: doomscroll, phone-free, silent, walk-and-pray, gratitude
  - Audio: one-podcast, audiobook
  - Mood: rage, hot-girl, gratitude

## 2. Niche tiles get photos — staggered crossfade slideshow

Each niche gets **4 thematically-tuned photos** that crossfade on a slow, randomized cadence so the page reads like a quietly breathing wall of imagery (not a flashing ad).

**Asset pipeline:**
- New folder: `public/niche-covers/<slug>/{1..4}.webp`, plus `lqip` blur entries.
- Generate via `imagegen` (fast tier) at 768×768, with prompts engineered per niche (e.g. dog-parents → "soft morning light, two friends walking dogs through brownstone street, candid, film grain, no faces visible"). Faceless / from-behind / atmospheric framing across the board to keep tone calm and inclusive.
- Compress with a sibling of `scripts/compress-covers.mjs` → `scripts/compress-niches.mjs`. WebP q60, generate base64 LQIP for blur-up.
- Registry: `src/data/niche-covers.ts` exporting `NICHE_COVERS: Record<slug, { blur: string[]; count: number }>` and a `nicheUrl(slug, i)` helper.

**Slideshow component (`src/components/groups/niche-tile.tsx`)**:
- Replaces the emoji-only `variant="niche"` rendering inside `GroupCard` (or wrapped in the niche collection directly).
- 4 stacked `<img>` layers with `opacity-0/100` + `transition-opacity duration-[1400ms]`.
- Crossfade interval **6–9s, randomized per tile**, plus a per-tile **start delay (0–4s)** so neighbors never flip at the same instant. Zero coordinated rhythm = the elegant "slowly refreshing tiles" feel the user described.
- IntersectionObserver pauses the timer when the tile leaves the viewport and on `prefers-reduced-motion` (then it just shows photo #1).
- `document.visibilityState !== 'visible'` also pauses (saves CPU on backgrounded tabs).
- LQIP blur as background; first photo `loading="eager"`, rest `loading="lazy"` + `decoding="async"`.
- Foreground content stays: emoji glyph (smaller, top-left, soft white pill), bottom gradient, serif name, live/week count. Joined check pill top-right.

## 3. 2026 cutting-edge polish

Small, deliberate moves — no novelty for novelty's sake.

- **Spring-feel chip taps**: replace `tap-press` on the chip row with a CSS view-transition-friendly scale+blur micro-bounce; respects reduced-motion.
- **Scroll-linked eyebrow reveal**: section eyebrows (NICHES, TRENDING, etc.) animate in via `animation-timeline: view()` where supported, falling back to existing `card-in`. ~6 lines in `styles.css`, progressively enhanced.
- **Color-aware live dot**: the live pulse ring picks up `--forest` via `color-mix` so it threads consistently in light/dark.
- **Section spacers**: tighten `space-y-7` → `space-y-6` and add a hairline divider only between Niches and CityGallery (others rely on eyebrow rhythm). Cuts ~80px of dead air.
- **CityGallery featured count**: bump from 9 → 10 on md+ to fill the row evenly; tighten gap from 2 → 1.5.
- **Header micro-stat ticker**: the "X walking right now" number gets a subtle 600ms count-up when it changes (rAF, no library), so the page feels live without distracting.
- **Pulse rail respects pointer-coarse**: on touch, swap auto-drift speed from 18px/s → 12px/s — feels less anxious on phones.
- **Prefetch on hover**: niche/city/rail cards call `router.preloadRoute({ to: '/groups/$slug', params })` on `pointerenter`. Detail sheet snaps open instantly.
- **`content-visibility: auto`** on the four large below-the-fold sections (Trending, Vibes, Niches, CityGallery). Free paint perf, especially on low-end Android.
- **Focus ring polish**: unify to `focus-visible:outline-forest/50` everywhere (audit GroupCard variants — currently consistent, but the new NicheTile must match).

## Technical notes

- Niche photo generation runs as a one-time script. Budget: 26 slugs × 4 = 104 images, ~1.4MB total after WebP. Acceptable.
- Slideshow timer uses a single `setTimeout` per tile (not `setInterval`) so jitter accumulates differently per tile and the offset stays organic across hours.
- Tab state lives in `useState` inside the new niche component — no URL sync (these are browse helpers, not deep links).
- No DB / RLS / auth changes. No new packages. No edge functions.

## Files touched

**New**
- `src/components/groups/niche-collection.tsx` (tabs + grid + auto-drift)
- `src/components/groups/niche-tile.tsx` (crossfading photo tile)
- `src/data/niche-covers.ts` (registry + LQIP)
- `scripts/compress-niches.mjs` (sharp pipeline)
- 104 × `public/niche-covers/<slug>/<n>.webp`

**Edited**
- `src/components/groups-tab.tsx` — swap inline niche grid for `<NicheCollection>`; tighten spacing; header count-up.
- `src/components/group-card.tsx` — niche variant delegates to `NicheTile` when covers exist.
- `src/styles.css` — view-timeline eyebrow, refined tap-press, niche crossfade keyframe (defensive fallback).

## Out of scope
- Niche detail page redesign (its hero would benefit from these photos too — flag for next pass).
- Any backend / data shape changes.
