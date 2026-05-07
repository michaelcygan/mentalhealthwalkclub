# Walk & Talk: Always-On Mechanic

## The vision

Walk & Talk should feel like turning on a radio that's already warm. You tap **Start a walk**, you start moving, and within 60 seconds you hear another human walking somewhere in the world — or ambient music until one arrives. Rooms are persistent and only close when the last walker leaves. No browsing. No "join room X." It just happens.

This is the Strava-for-mental-health moment — the single mechanic that makes the app inevitable.

## The flow (user POV)

```text
Tap "Start a walk"
   ↓
"We'll find you a Walk & Talk once you're moving"  (soft pulse)
   ↓  [walks 15m of GPS]
"Matching you with a room…"  (breathing dot)
   ↓  [< 2 seconds]
Audio fades in. Soft chime.
"Say hi to Maya and two others."
   ↓
Walking + talking. Mute / Skip room / End walk in a single dock.
   ↓  [if alone > 60s]
Ambient music fades in under the silence. "Someone will join."
   ↓  [walker arrives]
Music ducks. Soft chime. They hear you, you hear them.
   ↓
Walk ends → audio fades out → reflection flow as today
```

## The matching rule (simple, no ML)

When a user qualifies (walking detected), pick a room in this priority:

1. **Open room with 1 walker** in same time-of-day bucket → fill the lonely room first.
2. **Open room with 2–3 walkers** under capacity (8) → join the warm one.
3. **No suitable room** → spin up a new persistent room titled by time-of-day + theme ("Tuesday morning · open"), seeded with the user's `mood_before` as theme.

Matching is one Supabase query. No new tables.

## Persistence (the new mechanic)

Rooms today are created per-walk. New behavior:
- A room stays `status: 'open'` as long as ≥1 active participant.
- When the last participant leaves OR their walk ends → room transitions to `closed`.
- Implemented by extending `tg_audio_room_participant_count` trigger: when count hits 0, set `status='closed'`.
- This means at any moment, the matcher sees a real, live set of warm rooms.

## Ambient music when alone (free, no API key)

Three options, all free:
- **Local lo-fi loops**: Ship 3–4 short royalty-free CC0 ambient loops (e.g. from Pixabay Music or Free Music Archive) as `.mp3` in `src/assets/audio/`. Pick one based on time-of-day. ~200 KB each, lazy-loaded.
- **Web Audio API generative pad**: ~40 lines of code generates an endless soft pad using oscillators + reverb. Zero bandwidth, infinite, never repeats. Recommended primary.
- Fade in at 30% volume after 60s solo, duck to 5% when a walker joins.

No new APIs. No keys. No cost.

## UI for 2026 (modern, motion-led)

- **Matching state**: full-bleed soft gradient that breathes (CSS `@keyframes`), single line of text fading between "listening for walkers near you…" / "tuning the room…" / single dot pulse. No spinner.
- **In-room dock**: floating glass pill at bottom — avatar stack (speaking ring animates), mute, skip, end. Collapses to just timer when idle, expands on tap. Uses `backdrop-blur` + `bg-card/70`.
- **Speaking visualization**: existing `ring-forest` ring already works — keep it, add subtle scale pulse synced to amplitude.
- **Room transitions**: 600ms `fade-in` + chime when joining, 400ms fade-out on leave. Already have `animate-in fade-in` utilities.
- **Alone indicator**: a single, slow concentric ripple (CSS) on the avatar. Not lonely — meditative.
- **Desktop**: dock floats bottom-center with max-w-md instead of full width; route map and ambient visualizer expand into a side panel.

## What we already have (reuse, don't rebuild)

- `MeshAudioTransport` — WebRTC mesh, speaking detection, mute. Keeps working.
- `audio_rooms` table with `current_participant_count` + trigger.
- `joinAudioRoom` / `leaveAudioRoom` server functions with capacity guards.
- `AudioRoomPanel` component.
- Geolocation + `hasMoved` detector on the active walk screen.
- `live-now-strip` realtime subscription pattern.

## What's new (small surface)

| File | Purpose | ~LoC |
|---|---|---|
| `src/server/audio.functions.ts` (extend) | `matchOrCreateRoom({ walkSessionId, mood })` server fn | +50 |
| Migration: extend `tg_audio_room_participant_count` | Auto-close empty rooms | +10 SQL |
| `src/lib/audio/ambient-pad.ts` | Web Audio generative pad + fade helpers | ~80 |
| `src/components/walk-talk-dock.tsx` | Floating glass dock, replaces inline panel during audio walks | ~150 |
| `src/routes/walk.active.$id.tsx` (edit) | When `walk_type === "audio"` and `hasMoved`, auto-call matcher → mount dock instead of room list | ~40 changed |

No new tables. No new dependencies. No new API keys.

## Edge cases

- **User pauses walk**: leaves room (audio off), keeps walk open, ambient pad goes silent.
- **GPS denied**: fall back to "tap when you're moving" button after 30s — still qualifies.
- **Network drops**: WebRTC mesh handles peer dropouts already; matcher re-runs on reconnect.
- **Empty room → 1 user → leaves**: room auto-closes, next user spins up a fresh one.
- **Capacity (8) protects** mesh CPU/bandwidth; matcher will never overfill.

## Build order (suggested)

1. Migration: auto-close rooms at count 0.
2. `matchOrCreateRoom` server fn.
3. Wire into active walk: auto-match after `hasMoved`.
4. `walk-talk-dock` component (replaces inline list for audio walks).
5. Ambient pad + fade choreography.
6. Polish: matching animation, chime, ripple, desktop layout.

## Out of scope (deliberately)

- Voice transcription / summaries.
- Cross-room "switch room" beyond a single Skip.
- Persistent friendships from rooms (separate future feature).
- Paid TTS/AI voice — Web Audio pad is free and on-brand.
