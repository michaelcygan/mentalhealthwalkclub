# Groups Tab — Merchandising Pass

The tab now holds ~125 groups. Today everything renders as the same medium card in vertically stacked theme buckets. With this much inventory, that's a wall. Goal: turn it into a **scannable, shoppable surface** where the right group finds the right walker in under five seconds, and where the long tail is browsable without infinite scroll.

No new tables, no new RPCs, no new dependencies. All work happens in `groups-tab.tsx`, a slimmer `group-card.tsx`, and 2–3 small new presentational components.

## The new shape

Single hero header (title + search + chips, unchanged ergonomics, tightened visuals) followed by a **module feed** — like the Home tab now is. Each module merchandises differently so the page has rhythm.

```text
┌─────────────────────────────────────────┐
│ Groups · search · filter chips          │
├─────────────────────────────────────────┤
│ ⚡ Pulse  ← live + starting-soon strip   │  (existing, keep)
├─────────────────────────────────────────┤
│ Your groups · 3·4 grid of mini-tiles    │  (compact, all yours visible)
├─────────────────────────────────────────┤
│ Picked for you · 3-up snap carousel     │  (city + theme match)
├─────────────────────────────────────────┤
│ 🌆 Near you · {City}  · horizontal rail │  (NEW — surfaces metro chapters)
├─────────────────────────────────────────┤
│ 🔥 Trending this week · rail            │  (NEW — most walkers_week)
├─────────────────────────────────────────┤
│ ✨ Vibes (theme galleries)              │  (NEW collection layer)
│   Quiet support · Rituals · …           │
│   Each = pill row → tap → sheet w/ all  │
├─────────────────────────────────────────┤
│ 🌍 Browse by city · gallery grid        │  (NEW — small location tiles)
├─────────────────────────────────────────┤
│ Niches you might love · masonry         │  (NEW — viral group merch)
└─────────────────────────────────────────┘
```

## Card variants (one component, three sizes)

`GroupCard` gets a `variant` prop with three new looks (the existing `pulse` pill stays):

- **`tile`** (current 2-up) — promoted spots only (For You, hero modules)
- **`mini`** — h-16 row with avatar dot, name, member count, join button. Used in *Your groups* (4-up grid on mobile, 6-up md) and rails.
- **`rail`** — 220px snap card: theme-tinted top band, name, one stat (e.g. "42 this week"), tiny join icon-button. Used in horizontal carousels.
- **`gallery`** — square-ish 1:1 with big serif name and city/theme caption. Used in "Browse by city" and "Niches" masonry.

All four reuse the same theme tint map and join-toggle wiring already in `GroupCard`. No new data fetched.

## New collection: "Vibes"

The current theme buckets (`THEME_GROUPS`) become **collections** instead of long lists. Each Vibe renders as:

- A thin horizontal **rail** (3 hero cards)
- A "See all 18 →" pill that opens a **bottom sheet** (mobile) / dialog (desktop) with the full filtered list inside.
- Sheet body reuses `mini` cards in a single column with sticky search inside the sheet.

This is the magic move: collapses ~80 niche/lifestyle/chapter groups into 5 tappable galleries that look curated. Old "Everything else" bucket is removed — it's now the long tail inside each sheet.

## New collection: "Browse by city"

Auto-built from `groups` rows where `theme = 'chapter'` and `city is not null`. Renders as a **gallery grid** (3-col mobile, 5-col desktop) of compact city tiles: city name big in serif, country flag glyph, member count small. Tapping a tile opens the same sheet pattern, scoped to that city/region.

Adds a "More cities" affordance at the end opening a full alphabetical sheet.

## New "Near you" rail

If `myCity` is set, surface the matching chapter as the **first card**, then 3-4 nearby chapters by `country` + `state`. If no `myCity`, this module hides (no empty state — preserve quiet).

## Trending rail

Sorts groups by `pulse.walkersWeek` desc, top 8. Already in the `useGroupsFeed` data — no new query. Empty if nothing has activity (skip module).

## Filter chip changes

Chips stay sticky at the top, but when ANY chip is active OR search has text, the whole module feed collapses into a single flat results grid (`tile` cards) with a count: "24 groups". Removes confusion about why galleries change. Clear chip → modules return.

## Visual / motion

- Theme tint becomes a **soft top edge band** on rail/gallery cards instead of a full gradient — less heavy at small sizes, more legible.
- Section eyebrows get tiny lucide icons (Radio, Sparkles, MapPin, Flame, Globe) for orientation at a glance.
- All horizontal rails: `snap-x snap-mandatory`, edge-bleed (`-mx-4 px-4`), 16px gap, `overscroll-x-contain`, scroll-shadow gradient on right edge so users know there's more.
- Long-press on any card opens a quick "preview" sheet (group description + Join + Walk now) — same data already loaded. No navigation cost. Tap still navigates.
- Pull-to-refresh on the tab (use existing `usePullToRefresh`) re-runs `refresh()`.
- Reduced-motion respected throughout.

## Empty / sparse states

When a section has 0 cards, it disappears entirely (don't show empty rails). Tab is never blank because Vibes + Browse by city always have content given the seeded inventory.

## Files touched

- **`src/components/groups-tab.tsx`** — rewrite layout into module feed (~250 lines, replaces current 230).
- **`src/components/group-card.tsx`** — add `mini | rail | gallery` variants (~80 lines added).
- **`src/components/groups/vibe-collection.tsx`** *(new, ~70 lines)* — rail + "See all" sheet wrapper.
- **`src/components/groups/city-gallery.tsx`** *(new, ~50 lines)* — chapter gallery + sheet.
- No hook changes. No DB changes. No new routes.

## What does NOT change

- `useGroupsFeed` (same query, same pulse map).
- `/groups/$slug` detail page.
- Join/leave logic, auth prompt, GroupPulse strip.
- Search behavior — still client-side, still fast.

## Net effect

A merchandising layer on top of unchanged data: ~125 groups go from a wall of identical tiles to a hero feed with **2 rails, 2 galleries, 5 vibes**, where any group is reachable in ≤2 taps and the surface looks like something shipped in 2026, not 2019.
