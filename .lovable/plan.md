
# Walk & Talk · Level-Up Pass

A focused pass on the active-walk loop. No new tables, no new dependencies, no new APIs. Everything below leans on what already exists: `MeshAudioTransport`, `AmbientPad`, `WalkTalkDock`, `audio_rooms` realtime, `walk_sessions`, geolocation, the design tokens in `styles.css`.

The goal: when someone taps **Start a walk**, the next 30 minutes should feel like the most thoughtful, mobile-native audio product they've used this year.

---

## 1. The active walk becomes one immersive surface

Today the screen is three stacked cards (gradient header → path card → dock → buttons). On a 390px viewport that means tap-scroll-tap. We collapse it into a single full-bleed canvas with a sticky bottom dock — the WhatsApp-call / Strava-record feel.

```text
┌────────────────────────────┐
│  gradient-forest, full-bleed
│  safety · timer · haptic dot
│
│  06:42 (breathing)
│  1.2 mi · 1,540 steps · 16'12"
│
│  ─ path sparkline (inline,
│     overlaid on gradient,
│     low-opacity) ─
│
│         (alone ripple OR
│          avatar constellation,
│          centered, large)
│
├────────────────────────────┤  ← sticky dock, glass
│ 🎙 hold to talk    ⏸  ⏹    │
└────────────────────────────┘
```

Concretely in `walk.active.$id.tsx`:
- One outer `<section>` with `min-h-[calc(100dvh-…)]` and the existing `gradient-forest`.
- Header (intention + safety) shrinks on scroll using `sticky top-0 backdrop-blur` — no new lib, just CSS.
- Stats row collapses into a single line under the timer when `walk_type === "audio"` so the room takes the spotlight.
- Sparkline rendered as an SVG overlay at `opacity-25` behind the avatars instead of in its own card. Same `RouteSparkline` component, just sized full-width.
- Pause/End move into a sticky bottom dock with `safe-area-inset-bottom` padding (currently we ignore the iOS home indicator).

This is mostly CSS reshuffling in one route file (~80 lines edited, ~0 added).

---

## 2. The dock becomes the cockpit

Right now the dock has Mute / Skip / Leave. We turn it into a real audio cockpit while keeping the same component file:

- **Push-to-talk** (long-press on the mic button, mobile-first). Default state is muted; pressing-and-holding broadcasts. This is the single biggest unlock for "pick up a phone and walk" — it means users join silent rooms without anxiety. Implemented as `onPointerDown/Up` calling existing `setMuted(false/true)`. No transport change.
- **Toggle for hands-free mode** (current behavior) for users who want it. State stored in `localStorage`.
- **Haptic taps** on join chime, on a walker arriving, and on push-to-talk press — `navigator.vibrate(8)` / `vibrate([6,40,6])`. Free, mobile-only, silently no-ops on desktop.
- **Avatar constellation**: replace the wrap-row of avatars with a circular arrangement around the timer. Uses `transform: rotate()` math, ~15 lines. Speaking ring becomes an outward pulse synced to amplitude. Reuses the existing `speaking` boolean from `MeshAudioTransport`.
- **Skip becomes a swipe**: `Skip` button gets a small "← swipe" affordance using a `Sheet` or simple touch handler — feels less like leaving, more like changing channels.

---

## 3. Smarter alone-state choreography

The ambient pad already exists. We use it more deliberately:

- **Time-of-day theming**: pad's base frequencies and LFO speed shift by the same `timeOfDayBucket` the matcher uses. Morning = brighter (A minor), night = lower (D minor). Two extra lines in `ambient-pad.ts` accepting `{ key }`.
- **Heartbeat tell when someone joins**: existing `playJoinChime` + `vibrate([6,40,6])` + a 600ms `animate-in fade-in` on the new walker's avatar. Already 90% built — we just wire the chime to the participant-count delta instead of the alone→not-alone delta, so it fires for every arrival, not just the first.
- **"Stay with the silence" affordance**: after 30s alone, instead of jumping straight to ambient pad at 60s, show a single line: *"Want company or quiet?"* with two pills — Quiet (delays pad indefinitely) / Music (starts now). Tiny addition, big mood-respect.

---

## 4. Live presence beyond the room

Two micro-features that use the existing realtime channel and `walk_sessions` table — no new schema:

- **"Two others starting nearby"** banner during the matching phase. Reads `walk_sessions` where `status='active'` and `started_at > now() - 2 min`. Filtered by `audio` walk-type. Subscribes via the existing realtime pattern in `live-now-strip.tsx`. Makes the matching state feel populated even before the room fills.
- **Continuity ring**: in the in-room view, show a tiny "12 min walking · 0.8 mi" under each remote walker's avatar, pulled from their `walk_sessions` row. Makes the room feel embodied — you know the person you're talking to has been on their feet for 20 minutes.

Both reuse `supabase.channel('public:walk_sessions')` already in the codebase.

---

## 5. Mobile capabilities we're under-using

- **Wake Lock API** (free, web-standard): keep the screen on during an audio walk so the dock stays visible. `navigator.wakeLock.request('screen')` gated to audio walks. ~10 lines, released on unmount.
- **Media Session API**: set `navigator.mediaSession.metadata` with the room title and `setActionHandler('togglemicrophone')`. Then the iOS/Android lock-screen and Bluetooth headphone button can mute/unmute the room. This is the single most "premium" mobile touch — it makes the app a proper audio citizen.
- **Visibility-aware ambient pad**: when the tab backgrounds (user pockets phone, common for walking) the pad already keeps playing via Web Audio — but we duck it 50% to save battery. `document.visibilitychange` → `pad.duck()`.
- **Safe-area insets**: dock uses `pb-[env(safe-area-inset-bottom)]`. Currently we don't.
- **Larger tap targets in the dock**: bump to `h-14` and use `touch-manipulation` to kill 300ms tap delay.

---

## 6. Tightening existing code

While we're in there:

- **`walk.active.$id.tsx`**: extract the reflection flow (currently 60 lines of nested ternaries) into `<EndWalkFlow />` so the active screen file stays readable. Net code: ~0 (move, not add).
- **`walk-talk-dock.tsx`**: collapse the four `phase` returns into one render with conditional regions — saves ~30 lines and eliminates duplicate gradient containers.
- **Match retry**: today if `matchOrCreateAudioRoom` fails the user is dropped to "waiting-to-walk" forever. Add a soft 3-attempt retry with 1s/3s/8s backoff, then a clear "tap to retry" pill. ~12 lines.
- **Persist mute preference**: read `localStorage.walkAndTalk.handsFree` on mount so users who like push-to-talk always get it.

---

## What stays the same (deliberately)

- Matching logic (already loneliest-first, already correct).
- WebRTC mesh transport.
- Auto-close empty rooms trigger.
- Reflection flow content/copy.
- Safety sheet.
- All schemas and server functions.

---

## File budget

| File | Change | Approx LoC |
|---|---|---|
| `src/routes/walk.active.$id.tsx` | Reflow to immersive layout, extract EndWalkFlow, wake-lock, media-session, safe-area | +40 / −60 net |
| `src/components/walk-talk-dock.tsx` | Push-to-talk, constellation, haptics, retry, swipe-skip, collapse phases | +60 / −40 net |
| `src/lib/audio/ambient-pad.ts` | Time-of-day key param, visibility-aware duck | +20 |
| `src/components/end-walk-flow.tsx` (new, extracted) | Pure UI extraction | +120 (moved) |
| `src/components/nearby-starting.tsx` (new, tiny) | Realtime banner during matching | +35 |

**Net new code: ~120 lines.** Most of the heft is moving the reflection flow into its own file.

---

## Build order

1. Extract `EndWalkFlow` (zero behavior change, pure refactor).
2. Reflow active-walk layout to full-bleed + sticky dock + safe-area.
3. Push-to-talk + hands-free toggle + haptics.
4. Wake Lock + Media Session + visibility-aware pad.
5. Avatar constellation + per-walker continuity ring.
6. Time-of-day pad keys.
7. Nearby-starting banner during matching.
8. Match retry with backoff.

Each step is independently shippable; nothing in step N depends on step N+1.

---

## Out of scope (on purpose)

- Voice transcription / saved snippets.
- Friend system from rooms.
- Group walks scheduled in advance (already a separate feature).
- Native app shell — everything proposed is web-standard and works in Mobile Safari today.

Once you approve, I'll execute in the order above and stop after each phase if you want a pause.
