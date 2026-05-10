## Performance pass — obvious wins, nothing destructive

Goal: faster cold-start, lighter Groups page (esp. on rural/slow networks), fewer redundant DB reads, smaller initial JS. No feature changes, no UI changes.

---

### 1. Groups page — the heaviest screen

**Problem found in `useGroupsFeed`:**
- 7 parallel queries on every mount, every visit. No cache, no `staleTime`, no de-dup. Tab-switching back to Groups re-fires all 7.
- `walk_sessions` query for "walkers this week" pulls *every completed walk in the last 7 days across all groups* (could be hundreds of rows on a busy week) just to count distinct users per group.
- `groups` query selects all rows and orders by `member_count` — fine, but no pagination or `cv-auto` on every collection.

**Fixes:**
- Wrap `useGroupsFeed` in TanStack Query with `staleTime: 60_000` and `gcTime: 5min`. Re-entering Groups within a minute = zero network.
- Replace the "walkers this week" client-side aggregation with a Postgres RPC `group_pulse_week()` returning `{group_id, walkers_week}` rows. Falls from O(N walks) to O(N groups) on the wire. (Migration + RPC; falls back to current path if RPC missing.)
- Add `content-visibility: auto` (`cv-auto` class is already defined) wrappers to `MoodsCollection`, `NicheCollection`, `PulseRail` — only `CityGallery` and Niches have it today. Skips layout/paint for off-screen sections.
- Memoize `chipCount` (currently recomputed every render × 5 chips).

### 2. Initial bundle — code-split heavy routes

Currently only 3 lazy imports (maps). Heavier wins available:
- Lazy-load `walk.active.$id.tsx` deps that aren't needed on home: `WalkLiveMap` already lazy ✓, but `GuidedPlayer`, `WalkTalkDock`, `ListenerPool`, `facilitator-prompts` should be `lazy()` inside the format modules so Solo walks don't pay for W&T/Guided code.
- Lazy `welcome-dialog`, `end-walk-flow`, `guide-picker`, `walk-notes-sheet` on `/` — all are only opened on user action but currently in the home chunk.
- Lazy `MoodCloud` / `WeightBar` (mood selection only renders when sheet opens).

### 3. Image & asset hygiene

- `heroImg` (`@/assets/walk-hero.jpg`) is imported eagerly on `/`. Add `loading="eager"` + `fetchpriority="high"` only on the LCP element; ensure all other `<img>` use `loading="lazy"` + `decoding="async"`. Spot-check Groups grids — `group-routes-mosaic` already has `loading="lazy"` ✓; `city-gallery` covers should too.
- `GROUP_COVERS` blur LQIPs are inlined as base64 in `src/data/group-covers.ts` — confirm the file isn't ballooning the main chunk; if >50 KB, split into a dynamic import loaded by `CityGallery` only.

### 4. Supabase query slimming

- `walk.active.$id.tsx` line 120: `.select("*")` on `walk_sessions` — replace with the explicit columns the screen reads. Same for `events.$slug.tsx` and `guide-picker.tsx`.
- `index.tsx` lines 82-85 fire 3 sequential-ish `walk_sessions` queries on mount — collapse to one `.select("id,started_at,duration_seconds,status,reflection_note")` query and derive all three pieces client-side. Saves 2 round-trips on every Home load for signed-in users.

### 5. Realtime / interval discipline

- `useLiveCount` and the placeholder rotator both run `setInterval` on the Groups header. Confirm they pause when `document.visibilityState === "hidden"` (WalkLiveMap already does this — apply same pattern). Saves battery + network on backgrounded tabs.

### 6. Router-level

- Set `defaultPreloadStaleTime: 0` in the router (TanStack Query best-practice) and add `staleTime` per route loader where data is reused (e.g. groups list).
- Add `defaultPreload: "intent"` so hovering/touching a `<Link>` warms the next chunk.

---

### Out of scope (this pass)
- No visual/UX changes
- No new features, no data-model changes beyond the optional `group_pulse_week` RPC
- No PWA/service-worker changes (separate conversation)
- No image re-encoding (covers are already webp)

### Rollout order (safe → bigger)
1. Router defaults + memoize `chipCount` + `cv-auto` wrappers (5 min, zero risk)
2. Collapse Home `walk_sessions` queries + `.select("*")` slimming (10 min)
3. Lazy-load sheets/dialogs on `/` and walk format modules (15 min)
4. TanStack Query around `useGroupsFeed` with `staleTime` (15 min)
5. `group_pulse_week` RPC + migration, with graceful fallback (20 min)

Reply "go" and I'll ship 1–4. Item 5 (the RPC) I'll do as a separate step so you can review the SQL.