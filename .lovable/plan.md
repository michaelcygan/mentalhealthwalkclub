# Groups Polish — Pass 3

The bones are strong. This pass tightens **rhythm, hierarchy, and the detail page hero** — and fixes small things that keep it from feeling truly world-class. No new dependencies, no schema changes, no backend touches.

---

## 1. Tab page — quieter, more confident

### a. Header rework
- Drop the muted-foreground subtitle. Replace with a single live counter line: *"42,318 walkers across 64 cities · 7 walking right now"* (data from existing `groups`/`pulse` — already in memory, no extra query). Fades in when numbers resolve.
- H1 stays serif `text-3xl`. Add subtle 600ms eyebrow fade-up.

### b. Search + chip bar
- Convert the chip row into a **fade-edged scroller** (matching rails) — current row clips abruptly on the right at narrow widths.
- Active chip gets a soft inset shadow (`shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]`) — feels pressed, not just tinted.
- Add 80ms scale-down tap state (`active:scale-[0.97]`).
- Search input: focus ring uses the existing `hue-drift` keyframe (already in CSS) for the 6s slow drift.

### c. Section spacing rhythm
- Current `space-y-7` is uniform → flat. Replace with deliberate cadence:
  - Header → Pulse: `mt-5`
  - Pulse → Yours: `mt-8`
  - Between discover sections: `mt-7`
  - Before City Gallery (the visual climax): `mt-10`
- Add a hairline divider (`<div className="mx-auto h-px w-12 bg-border/60" />`) before City Gallery to mark the shift from "people" to "places".

### d. Pulse strip refinement
- Currently the live pill's `animate-ping` is a single ring. Switch to the new `city-pulse-ring` double-ring (already defined) for consistency with city tiles.
- Add a tiny **time-of-day glyph** to live pills when the group has a `cover_set` (reuses `useCityHour` + `STATE_GLYPH`) — sells the world-map feel even in the pulse strip.
- First pulse pill gets `animation-delay: 0ms`; stagger 50ms each (capped at 6).

### e. Empty filter state
Replace the dashed-border block with a warmer compose:
- Faint forest-tinted card, serif "Nothing matches that yet."
- Suggestion chips below: "Try *quiet*", "Try your city", "Show all" — one-tap to clear.

### f. Vibe collection eyebrow
The current eyebrow icon is 12px; titles compete. Bump eyebrow to a small uppercase **with a leading 8px square** in the theme tint — gives each section a visual chord (anxiety = sky, grief = violet…). Reuses `themeBand` map.

### g. Niches grid
Currently same `gallery` variant as cities → looks identical. Niches deserve their own treatment:
- New `variant="niche"` on `GroupCard`: square tile, **emoji-led** (auto-derived from slug: 🌅 sunrise-club, 🌙 night-owls, 🐕 dog-parents, 👟 hot-girl-walk, 🌧 rainy-day-walkers, 🤫 silent-walking, 📚 audiobook-walkers, ☕ five-am-club, etc. — local map in component).
- Theme-tinted gradient (existing `themeTint`), serif name, tiny live/week sub.
- 70ms staggered entrance.

---

## 2. Detail page — hero & rhythm

### a. Hero
- Add an **ambient cover band** at the top (h-40) when `group.cover_set` is set: same time-aware webp from `CITY_COVERS`, blurred + dim overlay so text legibility is perfect. Falls back gracefully to the existing themed gradient.
- The header card becomes 12px shorter and overlays the cover band with `-mt-12 mx-2 backdrop-blur-md bg-card/80` for a Apple-Music style hero. Pure CSS.
- Move the "X walkers · Y this week" metadata up; reduce `text-3xl` H1 → `text-[28px]` to leave breathing room.

### b. Sticky action bar
- Currently looks identical to background when scrolled. Add a subtle 1px bottom hairline only after `scrollY > 80` (CSS `box-shadow` triggered by adding `data-scrolled` via single rAF listener).
- "Walk now" gets the existing ember-spark glow on tap (already in CSS).

### c. Quiet wins
- Section eyebrow + title cadence to match tab page (uppercase + 8px theme square).
- Cards get the staggered `card-in` entrance.

---

## 3. Motion — one new keyframe, taste only

Add to `src/styles.css`:
- `eyebrow-rise` — 240ms, 8px translateY + opacity 0→1 (used by section headers via IntersectionObserver one-shot, already wired pattern).
- `tap-press` utility — `active:scale-[0.97] transition-transform duration-100`.

All others reuse existing keyframes (`card-in`, `ken-burns`, `glyph-float`, `city-pulse-ring`, `hue-drift`, `ember-spark`). No new framer-motion. Reduced-motion guards already in place.

---

## 4. Performance discipline (unchanged budget)

- Hero cover band reuses an already-loaded webp (no new network).
- Niche emoji map is a static const ~30 entries.
- No changes to data hooks or queries — all derived from existing `useGroupsFeed` + the detail page's existing fetches.
- IntersectionObserver only added once for header eyebrows (single observer, observe → unobserve on first hit).

---

## Files touched

**Modified**
- `src/components/groups-tab.tsx` — header line, spacing rhythm, divider, fade-edge chip scroller, empty-state warmth
- `src/components/group-card.tsx` — new `niche` variant, gallery eyebrow square, pulse pill double-ring + glyph
- `src/components/groups/vibe-collection.tsx` — eyebrow square, staggered entrance
- `src/components/groups/city-gallery.tsx` — hairline divider before, deeper stagger
- `src/routes/groups.$slug.tsx` — ambient cover band hero, sticky-bar shadow on scroll, eyebrow rises
- `src/styles.css` — `eyebrow-rise` keyframe, `tap-press` utility

**Untouched** — schema, hooks, data, ghost-walk, audio, RLS, edge functions, cover script.

---

## Deferred (future passes)

- Per-group cover bands for non-chapter groups (need curated assets).
- Parallax on cover band scroll.
- Member avatar stack on detail hero.
- Live-now mini-map on tab page above Pulse strip.
