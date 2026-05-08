## Walk Club — World-Class Pass (2026)

Goal: take what already works and make it feel inevitable. No new tables, no new big features — re-use existing primitives (walks, audio rooms, facilitator visits, groups, events, badges, signals, mood, reflections) and unlock more flow with smaller, sharper UI.

Principle: *less surface, more depth.* Every screen earns its space. Mobile-first, gesture-first, calm-by-default.

---

### 1. The Home Tab becomes a "Now" surface

Today `/` is a stack of cards. Make it a single, breathing dashboard tuned to the moment of opening the app.

- **Time-aware hero** — one ambient gradient that shifts dawn / day / dusk / night using existing CSS tokens. One sentence ("a kind morning to walk"), one primary action that adapts: solo · join live · join scheduled.
- **Live-now strip** becomes horizontally scroll-snapped pods (`snap-x snap-mandatory`) with avatar stacks pulled from existing `audio_room_participants` — tap to drop in. Hides itself when empty (re-uses existing query).
- **Weekly ring + mood cloud** collapse into one compact "this week" row (ring left, mood dots right). Tap → expands into a sheet with the existing components (no new code, just composition).
- **Reflection drift** moves below the fold as a quiet, single-line journal entry preview.

Net change: trim ~60 lines on `/` by composing existing components into a tighter layout. Adds a single `useTimeOfDay()` hook.

---

### 2. Walk & Talk dock → mobile-native call surface

The dock is great. Push it to feel like FaceTime + Calm.

- **Drag-to-expand**: bottom dock becomes a `Drawer` (already in shadcn) with a snap-point at peek (current dock) and full ("on the trail" full-screen state). Swipe down to peek.
- **Active-speaker ring**: re-use the existing per-participant audio level we already pipe through `use-audio-room` to glow the current speaker's avatar (CSS animation only, no new state).
- **Haptics**: 10ms `navigator.vibrate` on join / mute / facilitator arrives. Tiny helper in `src/lib/haptics.ts`.
- **Live captions toggle (browser-native)**: a 1-line button using `webkitSpeechRecognition` for personal accessibility — no server cost, falls back gracefully. Off by default.
- **Pinned context**: while in a pod, a sticky thin bar at the top of every screen (`<NowPlayingBar/>`) shows "you're walking with 3 · 12:04" so users can browse Groups/Journal without losing the call. Re-uses existing dock state.

Net change: refactor dock into a Drawer (replaces ~80 lines, adds ~30). Adds `now-playing-bar.tsx` (~40 lines), `haptics.ts` (~10 lines).

---

### 3. Bottom nav → adaptive command bar

Five static tabs is fine. Make the center tab dynamic.

- The middle slot is contextual: when no walk → big **Walk** FAB (forest disc, slight elevation, haptic). During a walk → mic mute toggle. While a Walk & Talk is live somewhere → pulsing "Live" with count. For facilitators on shift → "Next pod ↗".
- Long-press on **Walk** opens a radial-style action sheet (Drawer): Solo · Guided · Walk & Talk · Local Walk. Reuses existing routes.
- Hide the bar on scroll-down, show on scroll-up (single `useScrollDirection` hook). Modern, more vertical room on mobile.

Net change: ~50 lines in `__root.tsx`, one new hook.

---

### 4. Guided audio + ambient pad — finally fused

Right now `guided-player`, `audio/ambient-pad`, and `guided-tracks` live in parallel. Unify behind a single `<AudioStage/>` primitive that:

- Shows the current ambient layer (track or generative pad) as a calm visualizer (CSS conic-gradient driven by the existing analyser node — no canvas).
- Cross-fades between tracks (already supported by `mesh-transport`).
- Powers solo guided walks AND the "no one's here yet" state of a Walk & Talk.

Net change: collapses two components into one; ~40-line reduction overall.

---

### 5. Facilitator surface gets two power-ups (no schema changes)

- **Glanceable queue**: in the "searching" state, show 3 ghost cards of the *next likely pods* (highest score) so facilitators feel routed, not idle. Pulled from the same `nextPodForFacilitator` query (already exists), just returning top-N.
- **Whisper prompts**: the existing `prompt-drawer` becomes a dismissible toast that softly surfaces *one* prompt every 90s while in-pod, instead of a manual drawer. Reuses `facilitatorPrompts`.
- **Haptic at 60s remaining + 0**: gentle wrap-up cue.

Net change: small; ~30 lines, removes the manual drawer toggle.

---

### 6. Journal becomes a memory ribbon

Today journal is a list. Make it horizontally scroll-snapped "cards of a week" — each card a compact mini-spread (mood arc · steps · one line of reflection · badge earned). Vertical list still available behind a toggle.

- Pull-to-refresh feels handled by browser, but add a subtle `overscroll-behavior: contain` and a snap to "today."
- Long-press a card → share-as-image (uses `html-to-image` only if requested — otherwise the Web Share API with a text summary, zero new deps).

Net change: rewrite of one page (~150 lines), no schema changes.

---

### 7. Groups tab → "where you'd belong"

- Replace today's flat list with a single **For You** rail (top 3 groups based on existing location + theme overlap, no new data) and an **All groups** grid below. The matching is a one-line scoring function over fields we already store (`city`, `country`, `theme`, `preferred_themes`).
- Each group card shows a live pulse dot if anyone from that group is currently in a Walk & Talk (re-uses `audio_rooms` with `group_id`).
- Tap-and-hold a card → quick-join sheet with a one-tap "Walk with this group right now" (creates a spontaneous room scoped to the group — already supported).

Net change: ~80 lines, no new tables.

---

### 8. Mobile capability menu — quietly powerful

One `src/lib/device.ts` exposing safe wrappers; everything else taps in:

- `vibrate(pattern)` — haptics on join, mute, badge earned, walk end.
- `share(payload)` — Web Share API for "share my walk" / event invite / group invite (replaces 3 ad-hoc copy-link buttons).
- `wakeLock()` — keep screen on during active walk. Released on end. Single hook in `walk.active.$id.tsx`.
- `requestPermission()` for notifications — only asked on first explicit "remind me" click (no top-of-funnel friction).
- Pull-to-refresh → use `overscroll-behavior` + a tiny `useRefresh()` hook tied to `react-query` invalidation where present (no new deps).
- Install prompt (PWA): listen for `beforeinstallprompt`, surface as a one-time gentle banner after the 3rd walk completes. Manifest already implied.

Net change: one ~80-line `device.ts` enables six features with one-liners across the app.

---

### 9. Visual language tightening

Without rewriting the design system:

- **Type**: lock the serif (`Fraunces`) to display only; bump headings to `tracking-tight`; ensure body uses `Inter` consistently. Audit ~10 files where serif crept into UI labels.
- **Cards**: standardize on three radii (`rounded-2xl` content, `rounded-3xl` heroes, `rounded-full` pills). Currently mixed.
- **Color**: introduce two semantic tokens already implied — `--surface-elevated` and `--surface-warm` (pre-blended, no new oklch math) and replace ad-hoc gradients in 6 files.
- **Motion**: add a `prefers-reduced-motion` guard around the breathing/pulse animations. Adds ~5 lines, big inclusivity win.
- **Iconography**: keep Lucide; just standardize stroke width (1.8 default, 2.4 active) — already partially done in nav.

Net change: token additions in `styles.css` and ~12 small file edits.

---

### 10. SEO & shareability (root-level only)

- Per-route `head()` already mostly there; tighten `og:title`/`og:description` on `events.$slug.tsx`, `groups.$slug.tsx`, and `welcome.tsx` so a Walk & Talk link previews beautifully when shared in DMs (the dominant share path).
- Add a tiny dynamic OG image route that composes existing tokens (text + gradient) — only if we keep it server-rendered and free.

Net change: 4 files, 2-line edits each. OG image is optional; only if cheap.

---

### What we are explicitly *not* adding

- No new tables, no new edge functions, no new external services.
- No notifications backend (browser-only opt-in remind-me).
- No video. No chat. No DMs. The product is voice + presence.
- No AI features beyond what already exists in `lovable-ai`. (We can wire AI prompts for the facilitator drawer in a *separate* small pass.)

---

### Sequencing (each step is shippable on its own)

```text
Step 1   Now-surface Home  (composition only, biggest perceived win)
Step 2   AudioStage unification + visualizer
Step 3   Walk & Talk dock → Drawer + active speaker + NowPlayingBar
Step 4   device.ts (haptics, share, wake-lock) wired into 5 spots
Step 5   Adaptive bottom command bar
Step 6   Facilitator: queue preview + whisper prompts
Step 7   Journal memory ribbon
Step 8   Groups "for you" rail + live pulse
Step 9   Visual tightening + reduced-motion
Step 10  SEO/share polish
```

Estimated net code change across the whole pass: roughly **−400 lines after composition, +600 sharper lines** = small footprint, big leap in feel.

### Why this makes it world-class

- Everything we add is presence-aware, gesture-aware, and momentary — the qualities premium 2026 mobile apps share (Linear Mobile, Granola, Arc Search, Calm).
- We don't compete by adding features; we win by removing seams between features that already exist.
- The facilitator/walker/audio system becomes a single fabric with one consistent live-bar, one consistent sheet pattern, one consistent haptic vocabulary.

Want me to start at **Step 1 (Now-surface Home)** and **Step 4 (device.ts)** in parallel? Those two unlock the most perceived quality with the least code.
