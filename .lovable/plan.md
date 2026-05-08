# Groups Pass 5 — Living icons, drifting Pulse, photos everywhere

Three additive layers. No schema or data hook changes; same perf budget.

## 1. Icon micro-motion (global)

Add four new keyframes in `src/styles.css`, sibling to the existing `live-pulse` and `heart-beat`:

- `pin-drop` — for `MapPin` (Drop pin): 1.6s loop, `translateY -2px → 0` with a tiny squish at the bottom, ease-out-back; ~6s pause between cycles via `cubic-bezier` plateau.
- `sparkle-twinkle` — for `Sparkles`: 2.4s loop, opacity 1 → 0.55 → 1 plus `rotate(-6deg → 6deg)` and `scale(1 → 1.08)`; staggered with `animation-delay` on instances.
- `headphones-bob` — for `Headphones`: 2.8s loop, `translateY 0 → -1.5px` with subtle `rotate(-2deg)` — feels like a head nod, not a bounce.
- `compass-spin` — for `Compass`: 8s loop, `rotate(0 → 360deg)`, ease-in-out, with a 5s plateau every cycle (looks like it's "finding north" then drifting).
- `moon-glow` — for `Moon`: 3.2s loop, `filter: drop-shadow(0 0 0 →  4px hsl(var(--forest)/0.45))` plus opacity 0.85 → 1.

All wrapped in `@media (prefers-reduced-motion: reduce) { animation: none; }`. Each becomes a utility class (`.pin-drop`, `.sparkle-twinkle`, `.headphones-bob`, `.compass-spin`, `.moon-glow`) so we can sprinkle without touching component layout.

Apply in:
- `groups-tab.tsx` chip icons (`MapPin`, `Sparkles`, `Headphones`) — only when chip is **inactive** (active state stays calm, like the Live icon convention).
- Vibe collection eyebrow icons (`Sparkles`, `Moon`, `Compass`).
- Niches section eyebrow `Sparkles`.
- City Gallery `Globe` eyebrow → already covered by existing `compass-spin` reuse on `Compass`; Globe gets a one-shot `eyebrow-rise` only.
- `groups.$slug.tsx` cover band & header icons where these appear (audit during implementation: any `MapPin`, `Headphones`, `Moon`, `Compass`, `Sparkles`).

Keep amplitudes tiny — the rule is "you notice it on the second look, not the first."

## 2. Pulse strip — slow auto-drift with smart ranking

Refactor the Pulse strip in `groups-tab.tsx` into a new `<PulseRail>` component (`src/components/groups/pulse-rail.tsx`) so the logic stays contained:

**Motion**
- Continuous horizontal scroll at ~22 px/sec via `requestAnimationFrame`, advancing `scrollLeft`.
- Track is duplicated once in the DOM (`items + items`) so when `scrollLeft` reaches half the track width, we wrap to 0 — seamless infinite loop.
- Pause when:
  - `:hover` on the rail
  - `pointermove`/`touchstart` (with 1.5s cooldown after last interaction)
  - `document.visibilitychange` → hidden
  - `prefers-reduced-motion: reduce` → never animates; behaves as a normal scroller
- Edge fades reuse existing `fade-edge-x` so the loop seam is invisible.

**Ranking** — compose the rail items from three pools, then interleave so participation needs aren't ghettoized:
1. **Live now** (live > 0), sorted by participants desc.
2. **Needs participants** — upcoming walks where `nextStart` is within 90 min and the audio room has < 3 participants (or `pulse.walkersWeek == 0` for that group). These get a subtle `needsCompany` flag passed to `GroupCard pulse` variant — small "Needs walkers" eyebrow chip on the card.
3. **Trending** — high `walkersWeek`, no live session.

Interleave pattern: `live, needs, trending, live, needs, trending, …`. Cap at 12 items (24 in the looped track). If a pool is empty, fall through to the next.

**GroupCard `pulse` variant** — add tiny "Needs walkers" eyebrow when `pulse.needsCompany` is truthy. Existing pulse styling otherwise untouched.

## 3. Photos for the remaining cities

Currently 8 cities have real photo sets; the other ~68 fall back to procedural CSS gradients. Generate photo sets for the **next 24 highest-priority chapters** in this pass — a multi-pass effort, this batch covers the visible-most metros.

**Priority list (24)** — chosen by member-count weight + visual variety + global coverage:
- US: Brooklyn, DC, Philly, Atlanta, Austin, Denver, Portland, Phoenix, San Diego, Twin Cities, Nashville, New Orleans, Detroit, Houston, Dallas, Vegas
- Canada: Toronto, Vancouver, Montreal
- Europe: Paris, Berlin, Amsterdam, Dublin
- APAC: Sydney

**Pipeline** — extend `scripts/compress-covers.mjs`:
- Input: source JPGs placed in `/dev-server/public/city-covers/<slug>/<state>.jpg` for `dawn|day|golden|night`.
- For this pass, generate sources via `imagegen--generate_image` with the `fast` tier at 768×960 (4:5), prompt template:
  > "<City landmark or skyline>, photographed at <state>, bright optimistic palette, no people in foreground, no text, no logos, photorealistic, wide shot, soft natural light"
  with state-specific lighting cues ("warm pink dawn light", "midday clear sky", "golden hour amber sun low", "blue-hour with city lights, deep navy sky").
- Each landmark choice is hand-picked per city (e.g., Toronto = CN Tower across Lake Ontario; Paris = Seine + Eiffel from Trocadéro; Sydney = Opera House from Mrs Macquarie's; Austin = downtown from Lady Bird Lake).
- Compression: same `sharp.resize(480, 600).webp({ quality: 60, effort: 6 })` → ~30 KB each. 24 cities × 4 states = 96 files ≈ 2.9 MB total. Plus 24-px LQIPs base64-inlined into `city-covers.ts` (≈ 250 B each).
- Auto-append entries to `src/data/city-covers.ts` from the script's output.

After this pass, `CITY_COVERS` (real photos) has 32 cities; `CITY_PROCEDURAL` (gradients) covers the long tail. `CityTile` already prefers photo over procedural — no component change needed.

**Performance guardrails**
- Total added bundle weight: ~3 MB across `public/city-covers/**` (already lazy-loaded by `<img loading="lazy">`).
- LQIPs add ~6 KB to `city-covers.ts` — fine.
- No new runtime work; Ken-Burns already pause-on-offscreen.

## Files

**New**
- `src/components/groups/pulse-rail.tsx`

**Edited**
- `src/styles.css` — 5 new keyframes + utility classes
- `src/components/groups-tab.tsx` — replace inline pulse strip with `<PulseRail>`, sprinkle icon classes
- `src/components/groups/vibe-collection.tsx` — eyebrow icon classes
- `src/components/group-card.tsx` — `pulse` variant: tiny "Needs walkers" eyebrow when flagged
- `src/routes/groups.$slug.tsx` — icon classes where Compass/Moon/Headphones/MapPin appear
- `src/components/groups/city-gallery.tsx` — Globe eyebrow stays static; one-shot rise only
- `scripts/compress-covers.mjs` — generation + LQIP + auto-emit `city-covers.ts` block
- `src/data/city-covers.ts` — 24 new entries appended

**Untouched**
- All hooks, server functions, RLS, schema, routing, audio, ghost walks
- Procedural city tile path remains the long-tail fallback

## Out of scope (next pass)
- Photo sets for the remaining ~44 chapters
- User-submitted photo flow + photo-credit overlay (deferred per earlier note)
- Per-tile parallax on Pulse cards
