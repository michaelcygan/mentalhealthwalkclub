## A "world-class 2026" pass — tighten, don't expand

The app already has the right primitives: walks, moods, Walk & Talk pods, Friend Walks (live + scheduled + audience), groups, journal, facilitator queue. Most of what's left to make this feel best-in-class is **compression** — fewer screens, more living surface — and **mobile depth** (haptics, motion-aware UI, OS share/install, system-native widgets we already have hooks for).

Below is what I'd do, organized by leverage. Almost every item reuses code we've already shipped.

---

### 1. The Walk tab (`/`) — turn the home into a single living surface

Today: hero greeting → big "Start a walk" → mode pills → upcoming → live strip → weekly ring. Good, but linear and a little cardy. Make it **one breathing canvas**.

- **Adaptive hero** that gently parallaxes on scroll (uses `useScrollDirection` we already have) and breathes in sync with the start button at rest. Time-of-day gradient stays.
- **One-tap quick-start**: long-press the big "Start a walk" CTA = skip mood/intention with last-used mood, single haptic confirm. Tap = current 3-step flow. Reuses `haptics.soft/tap`.
- **Mood chips become the "arriving" row** that lives directly under the title, not below the CTA. Tapping a chip already routes into step 1 — keep it, but animate the CTA's label to "walk it out" as the chip lights, so the action follows the feeling.
- **Collapse `LiveNowStrip`, `UpcomingFriendWalks`, weekly ring into a horizontal "now" rail** under the fold (snap-scroll, mobile-native), with a subtle gradient edge mask. Each card is a single tap → existing destination. Recovers ~40% vertical space on mobile.
- **Pull-to-refresh** on `/`, `/groups`, `/events` — wires into existing supabase fetches; no new state.

### 2. The bottom tab bar — already good, push it further

- **Simple tap on the center "Walk" FAB** opens the new-walk mode sheet directly (today it requires a long-press; tap currently navigates to `/`). Long-press is removed entirely. Single, obvious gesture.
- **Live ring around the FAB** when the user is in an active walk OR has a Friend Walk live. Reuse the `current_participant_count` poll already there — paint it as a thin animated ring (CSS conic-gradient, ~10 lines).
- **Auto-hide on scroll-down** stays as-is.

### 3. Active walk screen — the most-used, most-visible surface

Where 2026 polish lands hardest.

- **Live route ribbon**: existing `RouteSparkline` becomes a true ambient backdrop — full-bleed at low opacity, animated draw as new points come in (we already `routeTick`). Today it's a 32px strip; let it own the hero.
- **Stat dial instead of 4 mini stats**: keep the four (mi, steps, pace, cadence) but rotate them on a 5s interval as a single big readout, with the others as muted satellites. Same data, ten times the calm. On hold, all four expand. Pure CSS + state; ~30 lines.
- **Audio reactivity**: in Walk & Talk or Friend Walk, the breathing scale of the timer slaves to room loudness (audio transport already in `src/lib/audio/`). Visible "the room is alive" signal without a meter.
- **Haptic milestones**: 5/10/20/30 min and first mile already toast — also fire `haptics.soft()` so phones in pockets register. Trivial.
- **Wake-lock + screen-dim mode**: after 60s without interaction, dim non-essential UI to 35% opacity (timer, GPS dot, end button stay full). Saves OLED, looks gorgeous. Tap anywhere → undim.

### 4. Friend Walk surfaces — fold into the existing primitives

We just shipped a lot here. Now make it feel native, not bolted on.

- **`FriendWalkShareCard` → use Web Share API first** with a generated share image (`og:image` per code). Fallback to copy-link. Adds <20 lines, removes one of the two buttons we currently render.
- **Inline `AudienceBar` reactions into the active walk hero** when host. No new component — render the existing one in the hero footer slot. Hosts feel the room without leaving the timer.
- **`MyFriendWalks` + `UpcomingFriendWalks` are the same data** — collapse into one `useFriendWalks()` hook (server function already returns it) and render two views. Removes one component file.
- **Schedule sheet → use native `<input type="datetime-local">` on mobile** (it's iOS-tier in 2026). Drop the custom picker controls; keep the rest of the sheet.

### 5. Groups & Events — mostly visual

- **Groups list as a "mood-sorted" grid** rather than a flat list: re-rank by recent activity + the user's current `mood_before` so the most relevant affinity floats up. Pure client-side sort over data we already fetch.
- **Group detail: hero pulse strip** using existing `GroupPulse` component but stretched edge-to-edge with a soft mood-color wash derived from members' recent moods. Signals already come from `group-signals.functions.ts`.
- **Events: map preview thumbnail** with a static tile (no map library) using lat/lng we already store — single `<img>` from a tile service URL. Spatial recognition without dependencies.

### 6. Journal — the quietest tab, most room to grow on mobile

- **Vertical timeline w/ ambient day dividers** (sunrise/midday/dusk hint colors based on `started_at`). Pure CSS.
- **Long-press a journal entry → quick share as image** (Web Share API + `<canvas>` rendered from the entry text + mood + date). One component, ~80 lines, becomes a viral surface.
- **Mood arc**: a 30-day mood-score sparkline at the top (we already have `mood_after_score`). Reuse `RouteSparkline` with a different data source — no new component.

### 7. Cross-cutting: 2026 mobile capability

The small things that make people say "this feels like an app."

- **PWA install prompt** in the FAB sheet ("add to home screen") — gated to one-time per install. ~20 lines.
- **Background haptics across CTAs** consistently (`haptics.tap` on every primary button — currently inconsistent).
- **`navigator.share` everywhere we currently copy-to-clipboard** with copy as fallback. Friend Walk, journal, events.
- **`prefers-reduced-motion`** is honored — keep it that way; new animations route through the existing media query block in `styles.css`.
- **`color-scheme: light dark`** + audit dark tokens. Some surfaces (mode pills, hero on `/`) use bespoke gradients that don't switch cleanly. Move them to tokens (`--gradient-dawn`, `--gradient-dusk`) in `styles.css` so dark mode "just works."
- **Token-layer polish**: introduce `--shadow-pressed` and `--blur-glass` and apply across cards/sheets to give the whole app a layered glass feel without per-component edits.

### 8. Code-shape cleanups (free wins, no behavior change)

- **`useFriendWalks()` hook** consolidates `MyFriendWalks` + `UpcomingFriendWalks` data fetching; both components shrink to ~30 lines each.
- **Extract `<HeroGradient />`** used by index hero, profile header, active walk hero — currently inlined three times.
- **One `useLiveCount(roomType?)` hook** for the FAB badge, the live strip, and the friend walk share card. Replaces three independent intervals.
- **Move all `setInterval` polls to a single `useInterval(ms, fn)` hook** that pauses when `document.visibilityState === "hidden"` — saves battery on mobile and removes ~6 ad-hoc effects.

---

### What this does NOT do
- No new tables, no migrations, no new server functions.
- No new external dependencies (no map library, no animation library — CSS + the framer-free patterns we already use).
- No new tabs, no new top-level routes. Surfaces compress, don't expand.

### Rough order of attack
1. Token + hook cleanups (`useFriendWalks`, `useLiveCount`, `useInterval`, new shadow/blur/gradient tokens). Foundation for everything else.
2. Active walk hero rework (route ribbon, stat dial, audio-reactive breathe, dim mode).
3. Home tab compression + adaptive CTA + horizontal "now" rail.
4. FAB simple-tap + live ring.
5. Web Share API + PWA install + haptic pass.
6. Journal timeline + share-as-image.
7. Groups/events visual polish.
