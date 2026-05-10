# Item 7 — Unify the On-Walk Screen

Goal: every walk format (Solo, Walk & Talk, Local/friend, Guided) lives inside **one** consistent shell, so the screen feels designed instead of improvised. Same chrome, same timer, same map, same action bar — only the **middle module** changes per format.

This pass also fixes the Pause-clipped-by-tab-bar bug, the busy hero, and the inconsistent meta row.

---

## 1. The shell (target structure)

```text
┌─ MetaRow ────────────────────────────────────┐
│ format chip · weather · safety               │  ← always present, quiet
├─ Hero ───────────────────────────────────────┤
│            00:24                             │
│       elapsed · GPS live                     │  ← timer + status only
├─ StatTrio ───────────────────────────────────┤
│   miles    ·    steps    ·    pace           │  ← always 3 stats (no rotator)
├─ FormatModule (swappable slot) ──────────────┤
│  Solo:   intention card + saved prompts      │
│  W&T:    audio dock + listener pool          │
│  Local:  RSVP roster + ETA                   │
│  Guided: prompt + timer ring                 │
├─ Map (collapsible) ──────────────────────────┤
│  WalkLiveMap                                 │
├─ Utility row ────────────────────────────────┤
│  notes · ambient pill                        │
├─ Sticky ActionBar (always above tab bar) ────┤
│  [ Pause ]              [ Hold to end ]      │
└──────────────────────────────────────────────┘
```

The current screen jams the intention, weather, safety, manual-start, motion-permission, and a 4-stat rotator into the green hero. The new hero is just timer + GPS — everything else moves into its proper row.

---

## 2. New / changed files

**New `src/components/active-walk/` directory:**
- `active-walk-shell.tsx` — the layout container. Owns hero, meta row, stat trio, map section, action bar. Accepts a `formatModule` ReactNode slot + props (elapsed, paused, stats, gps, intention, weather coords, safety session id, onPause, onEnd).
- `walk-meta-row.tsx` — format chip + WalkWeatherChip + SafetyButton (extracted from current route).
- `walk-hero-timer.tsx` — big `fmt(elapsed)` + GPS dot/label + breathe animation.
- `walk-stat-trio.tsx` — 3 fixed stats (miles, steps, pace). No rotator. Cadence drops to a tooltip on long-press of pace, since cadence on mobile is a power-user stat.
- `walk-action-bar.tsx` — sticky bar with Pause + LongPressEnd. Owns its own safe-area padding so it never sits under `MobileTabBar`. Tab bar already auto-hides on `/walk/active/*` (done in batch 1), but the action bar still respects `env(safe-area-inset-bottom)`.
- `format-modules/solo-module.tsx` — intention card, manual-start affordance, saved prompts list.
- `format-modules/walk-talk-module.tsx` — wraps `WalkTalkDock` + `ListenerPool` (when friend room) + invite share button.
- `format-modules/guided-module.tsx` — wraps `GuidedPlayer` with a small "current prompt" header.
- `format-modules/local-module.tsx` — placeholder for Local walks (RSVP roster). Today there's no Local-specific UI; this slot reserves the pattern.

**Edited:**
- `src/routes/walk.active.$id.tsx` — slim down to: data fetching, geolocation, persistence, end-walk handler. Render `<ActiveWalkShell …>` with the right `formatModule` based on `session.walk_type` / `friendRoom` / `guided_track_id`. ~400 lines → ~250.

No other files change. No DB, no schema, no routes.

---

## 3. Format → module mapping

```ts
function pickModule(session, friendRoom) {
  if (session.walk_type === "audio")            return <WalkTalkModule … />; // W&T
  if (session.guided_track_id)                  return <GuidedModule … />;
  if (friendRoom)                               return <WalkTalkModule … />; // friend = audio room
  if (session.group_id && session.privacy === "public") return <LocalModule … />;
  return <SoloModule … />;
}
```

Solo is the default — every walk has an intention + (optional) saved prompts, so the Solo module is also the **base** that other modules extend.

---

## 4. Hero simplification

Current hero crams 6 things into the green band. New hero:
- Line 1 (meta row, *above* the green band, neutral background): format chip · weather · safety.
- Inside the green band: timer + "elapsed · GPS live".
- That's it. Intention moves into the Solo module card. Manual-start and motion-permission move into a single **"setup nudges"** strip *below* the hero, only visible when relevant.

Rationale: the hero was doing too much. A timer + status line is what every running/walking app converges on because it's the one thing the user glances at mid-walk.

---

## 5. Stat trio (fixed, not rotating)

Replace the auto-cycling 4-stat dial with three fixed stats: **miles · steps · pace**. The rotator was clever but the user shouldn't have to wait 5s to see their distance. Cadence is rarely useful in real time and gets demoted (long-press pace to peek).

All three render in a single row, equal width, large tabular nums, same typographic weight — a proper "stat shelf" pattern.

---

## 6. Action bar (the bug fix)

Today the sticky dock uses `sticky bottom-0 … md:static`. On mobile it sits flush with the bottom and the `MobileTabBar` was overlapping it (the screenshot the user circled). Batch 1 hid the tab bar on this route, but the action bar still needs:
- `position: sticky; bottom: 0` (mobile)
- `padding-bottom: max(env(safe-area-inset-bottom), 12px)`
- A subtle top border + `glass` blur so the map underneath stays visible
- 56px tap targets (already done)
- "hold to end" hint moves *inside* the End button (subtitle text) so it doesn't add a separate row

Result: action bar is always reachable, never clipped, and reads as one element, not two stacked controls + a caption.

---

## 7. Calm/dim mode kept, scoped properly

Move the 60s-idle dimmer into `active-walk-shell.tsx`. Dim everything except hero timer + action bar. Currently dim is applied to many sub-elements with separate classes; centralizing it in the shell means modules don't need to know about it.

---

## 8. Order of work inside this pass

1. Build the shell + meta row + hero + stat trio + action bar (presentation only, no logic moved).
2. Extract Solo / Walk-Talk / Guided modules from current route.
3. Swap the route to render `<ActiveWalkShell formatModule={…} />`.
4. Smoke test each format: Solo, W&T (with and without friend room), Guided.
5. Verify Pause + End buttons are above safe-area on iOS notch + tab bar removed.

---

## 9. Out of scope

- No new walk type. Local module is a stub for now (no Local-specific data model exists yet).
- No changes to `WalkLiveMap`, `EndWalkFlow`, `GuidedPlayer`, `WalkTalkDock`, `ListenerPool` — these get *wrapped*, not rewritten.
- No new analytics events.
- No copy changes beyond removing the rotator caption.

Reply "go" and I'll build it.
