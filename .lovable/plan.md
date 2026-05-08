# Groups Tab — World-Class Polish (Pass 1 of N)

Three pillars: **time-aware city imagery**, **refined motion**, **strict perf budget**. Multi-pass — this pass ships the foundation + top cities; later passes expand coverage and add user submissions.

---

## 1. Time-of-day city imagery

### Style
**Bright, optimistic, hopeful.** Parks, skylines, waterfronts, leafy streets — never moody, never empty. Shot at the named hour of day so the page literally tracks the sun across the world.

### Day-state model (per city, per viewer)
Each city has up to **4 cover variants**: `dawn`, `day`, `golden`, `night`. The variant shown is computed from the **city's local time**, not the viewer's — so a New Yorker browsing at noon sees Tokyo glowing at midnight while London is golden, giving genuine sense of place.

```text
00:00–05:30 → night
05:30–07:30 → dawn
07:30–17:00 → day
17:00–19:30 → golden
19:30–24:00 → night
```

City → IANA timezone resolved via a small static map (`src/data/city-tz.ts`, ~80 entries covering all chapters). Hour computed client-side with `Intl.DateTimeFormat(tz)` — no server work, no extra requests.

### Pipeline (build script, dev-only)
`scripts/fetch-city-covers.ts`:

1. For each of the top **24 chapter cities** (this pass), fetch 4 hand-picked Unsplash photos (one per day-state) — Unsplash License = free commercial, no attribution required.
2. Pipe through `sharp`:
   - Resize **480×600** (aspect-[4/5], matches gallery tile).
   - **WebP, q60, effort 6** → ~18–28 KB each.
   - Emit a 24×30 base64 LQIP blur (~400 B) inlined in the manifest.
3. Output → `public/city-covers/{slug}/{state}.webp` + generated `src/data/city-covers.ts` mapping `{slug → {tz, variants: {dawn, day, golden, night}, blur}}`.

**Pass 1 weight:** 24 cities × 4 variants × ~24 KB = **~2.3 MB on disk**, but only the visible 9 tiles × 1 variant = **~220 KB** above the fold. Lazy + IntersectionObserver for the rest.

### Future passes (queued, not now)
- Expand 24 → 80 cities (same script, more curation).
- Per-city user submissions with credit overlay (your future feature — slot reserved in schema via nullable `cover_credit` column added now).
- Weather-aware variant (rain/snow overlay).
- Seasonal variants (autumn foliage in Boston, cherry blossoms in Tokyo).

### Schema
Migration adds to `groups`:
- `cover_set TEXT NULL` — slug into `city-covers` manifest (matches group slug for now).
- `cover_credit TEXT NULL` — reserved for user submissions later.

Backfilled for the 24 seeded cities.

### Render
- New `<CityTile>` component (extracted from `GroupCard` gallery variant).
- Picks variant from `city-covers.ts` by current local hour, re-checks every 5 min via a single shared `useCityHour(tz)` hook (cached per tz).
- `<img loading="lazy" decoding="async">` over a `background-image: url({blur})` CSS layer → instant paint, no flash.
- Bottom gradient overlay for label legibility, top-right shows tiny **sun/moon glyph** indicating local time-of-day (subtle, 12px).
- Cities **without** a cover_set fall back to the existing themed gradient + monogram — graceful, never broken.

---

## 2. Motion — alive, not busy

CSS-only. **No framer-motion.** `prefers-reduced-motion` disables everything except opacity transitions.

### a. Entrance choreography
- Section eyebrow + title: 200ms fade-up on scroll-into-view (one-shot, IntersectionObserver).
- Card rails & gallery: **staggered** fade-up (40ms per item, capped at first 6) via CSS `animation-delay`.

### b. City tiles — slow Ken Burns
14s `scale(1) → scale(1.06)` loop on the image, **only while in viewport**. Pauses off-screen via class toggle → near-zero CPU when scrolled past.

### c. Time-of-day glyph drift
The little sun/moon glyph has a 6s ambient float (translate ±2px). Sells "alive" without distracting.

### d. Live pulse refinement
Current "Live" dot becomes a **double-ring pulse**: solid ember dot + outer ring `scale(1)→scale(1.8)` + fade, 2s loop. Renders only when `pulse.live > 0`.

### e. Join button micro-interaction
On tap: 120ms `scale(0.96)` + 240ms radial ember glow behind the button. CSS only.

### f. Rail polish
`scroll-behavior: smooth`, existing edge-fade gradient preserved, drag cursor on desktop.

### g. Search focus
Soft 6s hue-drift on the focus ring (3° max within forest tones) — barely perceptible signal of life.

---

## 3. Performance discipline

| Risk | Mitigation |
|---|---|
| Image weight | WebP q60, 480×600, lazy + LQIP blur, ~220 KB above fold |
| Layout shift | Fixed `aspect-[4/5]` on every tile slot |
| Animation cost | Pure CSS transforms/opacity; `will-change` only on actively-animating elements; IntersectionObserver pauses off-screen |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` disables Ken Burns, pulse ring, drift, glow |
| Bundle size | No new runtime deps. `sharp` is dev-only. `city-covers.ts` is ~3 KB gzipped |
| Re-renders | `useCityHour(tz)` ticks every 5 min, memoized per tz; cover lookup is a static `Map` |
| TZ DB | Hand-curated `city-tz.ts` for chapters only, ~80 entries; no `moment-timezone` needed |

---

## Files

**New**
- `scripts/fetch-city-covers.ts` — dev-only build script (sharp + curated photo URLs)
- `src/data/city-tz.ts` — `{ slug → IANA tz }` for chapter cities
- `src/data/city-covers.ts` — generated manifest `{slug → {tz, variants, blur}}`
- `public/city-covers/{slug}/{dawn,day,golden,night}.webp` — 24 cities × 4 = 96 images
- `src/components/groups/city-tile.tsx` — gallery tile w/ time-aware image, LQIP, Ken Burns, glyph
- `src/hooks/use-city-hour.ts` — shared per-tz hour ticker

**Modified**
- `src/components/group-card.tsx` — gallery variant delegates to `<CityTile>`; live double-ring pulse; join ember spark
- `src/components/groups/city-gallery.tsx` — staggered entrance, smooth scroll
- `src/components/groups/vibe-collection.tsx` — staggered rail entrance
- `src/components/groups-tab.tsx` — section header fade-up
- `src/styles.css` — keyframes: `card-in`, `pulse-ring`, `ken-burns`, `ember-spark`, `glyph-float`, `hue-drift`; reduced-motion guards
- Migration: add `cover_set TEXT`, `cover_credit TEXT` to `groups`; backfill 24 cities

**Untouched** — `useGroupsFeed`, ghost-walk system, RLS, audio rooms, all backend logic.

---

## What's intentionally deferred (future passes)

- User-submitted covers + credit overlay
- Cities 25–80
- Weather-state and seasonal variants
- Per-tile parallax on scroll
- Vibe-collection card imagery (typography-led for now — covers shine where they matter most: places)