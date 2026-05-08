# Groups — Pass 7: density, surface consolidation, mobile-native

The page works. It just sprawls. We have **4 Vibe sections** + **Yours / For you / Near you / Trending** = 8 stacked horizontal rails, each with its own eyebrow, title, blurb, "See all" button, and a row of 220px cards where mobile sees ~2 at a time. That's the screenshot's core problem: enormous chrome-to-content ratio.

Two structural collapses, one new mode, and a tight set of mobile-native primitives — almost entirely reusing existing components.

## 1. Collapse "Today for you" — fold 4 sections into 1 stacked surface

**New: `src/components/groups/today-panel.tsx`** (replaces inline Yours / For you / Near you / Trending blocks in `groups-tab.tsx`).

A single section titled **"Today"** with a **segmented control** (sister of NicheCollection's tabs):

`Yours · For you · Near you · Trending`

- Tabs only render if their bucket is non-empty; default is whichever has the most weight (Yours > For you > Near > Trending).
- Body is the existing `variant="rail"` carousel — but rail cards get tightened from `w-[220px]` → `w-[176px]` and gain a **route sparkline thumbnail** (reuses `route-sparkline.tsx`) + tiny weather glyph when relevant. Same primitive, denser surface.
- A small "See all →" link beside the segmented control opens the existing VibeCollection-style bottom sheet for the active tab.
- **Net win:** 4 sections × (eyebrow + h2 + carousel ≈ 180px) → 1 section ≈ 220px. ~500px reclaimed, no info lost.

## 2. Collapse the 4 Vibe sections into 1 "Moods" surface

**New: `src/components/groups/moods-collection.tsx`** — same shape as `NicheCollection`, replacing the four `<VibeCollection />` calls in `groups-tab.tsx`.

- One section: eyebrow `MOODS` + serif title "By how it feels" + segmented strip:  
  `When it's heavy · Daily resets · Slow & silent · With others`
- Body: a 2-col grid of **horizontal mini cards** (reuse `variant="mini"`) so mobile shows 6+ groups at a glance instead of 2 rail cards. Density ~3×.
- Active tab persists in `useState` (no URL sync). Tab swap uses the same 200ms crossfade (`niche-grid-fade` keyframe already exists).
- Keeps the 4-vibe taxonomy intact in a single section instead of four. **Saves ~700px** on mobile.

## 3. New mode: **Map view toggle** at the header

A two-pill segmented in the sticky filter row: `Feed · Map`. (Reuses existing `group-live-map.tsx` primitive — already in-repo.)

- Map mode renders a single full-width `GroupLiveMap` showing every group with `live > 0` or `nextStart < 90 min` as pins, sized by `walkersWeek`. Tap a pin → bottom-sheet `GroupCard` (mini variant) with Join + Open.
- Feed mode = current page.
- State is local; toggle pill uses the same `chip-spring` micro-bounce.
- Lets the user *spatially* browse what's happening — a 2026-feel move that costs ~30 lines because the map and pulse data already exist.

## 4. Mobile-native primitives (small, surgical)

A new helper `src/lib/mobile.ts` exporting:

```ts
export const haptic = (ms = 8) => navigator.vibrate?.(ms);
export const share = (data: ShareData) => navigator.share?.(data) ?? Promise.reject();
```

Wired in:
- **Haptic on Join/Leave** — `useGroupActions.toggleJoin` triggers an 8ms tick on success. iOS Safari ignores `vibrate` (no penalty), Android responds.
- **Native share** on group cards — long-press a card on touch (≥500ms via `pointerdown`/`pointerup` + timeout) opens `navigator.share` with `{ title, text, url: /groups/<slug> }`. Falls back to copy-link toast.
- **Long-press peek** — same long-press on niche/rail cards (when not sharing) opens a tiny popover sheet (reuse `Sheet` side="bottom" snap) showing description + Join/Open. Avoids navigation for browse-y taps.
- **Pull-to-refresh** — `use-pull-to-refresh.ts` already exists; wire into `groups-tab.tsx` calling `refresh()` from `useGroupsFeed`. Visible chevron + haptic on threshold.
- **Scroll-driven section eyebrows** — already partially in via `eyebrow-rise`; extend to all section eyebrows with `animation-timeline: view()` (progressive enhancement, ~6 lines in `styles.css`).

## 5. Header & search — tighter, more alive

- Header collapses to a single line on scroll (`use-scroll-direction.ts` is already in-repo): "Groups · {totalWalkers} · {liveDisplay} live" with the search bar staying sticky. Saves ~80px once scrolled.
- Search bar gains an inline **"Try:" rotator** showing one of `quiet · sunrise · dog parents · phone-free · {myCity}` every 4s as a placeholder hint when the input is empty. Reduces decision paralysis; zero net height.
- Filter chips get a leading **count badge** when active (`Live now · 3`) so users see what they've narrowed to without re-reading.

## 6. Rail card upgrade — same primitive, more signal

Edit `variant="rail"` in `group-card.tsx`:
- Width: `w-[220px]` → `w-[176px]`.
- Add a 38px-tall thumbnail strip at the top: route sparkline if available, else theme-tinted gradient with the city/niche emoji floating bottom-right.
- Keep the join button — but make the whole card a single tap target with a separate Join chip (12px tall, top-right).
- Live ring ticks visually at 1.2s intervals (`city-pulse-ring` exists).

## 7. 2026 polish (tiny moves, big feel)

- **View Transitions API** on tab swaps in TodayPanel/MoodsCollection/NicheCollection — wraps `setTab` in `document.startViewTransition` when supported. Section content morphs instead of flickers.
- **`color-mix`** for live ring opacity by tab age — older tabs fade their ring tone slightly.
- **`@container` queries** on the MoodsCollection grid → switches to 3-col on tablets without a media query.
- **`scroll-snap-stop: always`** on the Pulse rail so swipes settle on the next pill, not coast past it.
- **Prefetch on `pointerenter`** already added in NicheTile; extend to TodayPanel rail cards (one-line addition).
- **`text-wrap: balance`** on all serif h2s.

## File map

**New**
- `src/components/groups/today-panel.tsx` — segmented "Today" surface
- `src/components/groups/moods-collection.tsx` — segmented "Moods" surface
- `src/components/groups/groups-map-view.tsx` — wraps existing GroupLiveMap with bottom-sheet card peek
- `src/lib/mobile.ts` — `haptic` + `share` (~10 lines)

**Edited**
- `src/components/groups-tab.tsx` — replace 4 vibes + 4 for-you blocks with the two new surfaces; add Feed/Map toggle; sticky-collapse header; PTR wiring
- `src/components/group-card.tsx` — rail variant tightening + thumbnail; long-press handler in tile/rail
- `src/components/groups/pulse-rail.tsx` — `scroll-snap-stop: always`
- `src/hooks/use-group-actions.ts` — haptic on join/leave success
- `src/styles.css` — view-timeline eyebrow extension, container query helper

## Out of scope
- Backend / RLS / data shape changes
- Group detail route (already polished this pass)
- New imagery (we have niche + city covers already)
- Removing primitives — every change reuses existing variants/components

## Net effect on the screenshot's pain
Two side-by-side rail cards per section × 4 sections becomes **one segmented surface with 6+ visible cards**. Page length on mobile drops by an estimated 35–40%, and the surfaces that remain feel intentional rather than repetitive.
