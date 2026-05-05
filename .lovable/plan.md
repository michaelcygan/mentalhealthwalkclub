# Plan: Free, Keyless Audio Walks (Mesh WebRTC, 8-Person Cap)

Build live audio rooms for active walks using browser-native WebRTC + Supabase Realtime for signaling + Google's public STUN. No third-party API keys. Cap each room at 8 participants (matches existing `audio_rooms.max_participants` default). Wrap everything behind a swappable transport interface so a future LiveKit/Daily upgrade is a one-file change.

## What changes

### 1. Transport abstraction (future-proofing)
New file `src/lib/audio/types.ts` defines an `AudioTransport` interface:
- `join(roomId, userId)` / `leave()`
- `setMuted(boolean)`
- `onParticipantsChange(cb)` — emits `{ userId, muted, speaking }[]`
- `onError(cb)`

New file `src/lib/audio/mesh-transport.ts` implements it using:
- `RTCPeerConnection` per remote peer (mesh topology)
- Supabase Realtime channel `audio-room:{roomId}` for SDP offer/answer + ICE candidate exchange (ephemeral broadcasts, no DB writes)
- Google STUN: `stun:stun.l.google.com:19302`, `stun:stun1.l.google.com:19302`
- Web Audio `AnalyserNode` on each remote stream for speaking-indicator volume detection
- Hidden `<audio autoplay>` element per remote peer

When time comes to swap, add `livekit-transport.ts` implementing the same interface; `useAudioRoom` picks via env flag.

### 2. Hook
New file `src/lib/audio/use-audio-room.ts`:
- `useAudioRoom(roomId)` returns `{ participants, isMuted, toggleMute, leave, status, error }`
- Instantiates the mesh transport, manages mic permission, cleans up on unmount
- Refuses to join unless caller passes a `walkSessionId` with `status='active'` (enforces "must be walking" gate)

### 3. Server-side participant capacity guard
New `src/server/audio.functions.ts` with `joinAudioRoom({ roomId, walkSessionId })`:
- Uses `requireSupabaseAuth`
- Verifies user's walk session is `active`
- Counts current `audio_room_participants` where `status='active'` for the room
- Rejects if count >= `audio_rooms.max_participants` (currently 8)
- Inserts `audio_room_participants` row (the existing `tg_audio_room_participant_count` trigger updates the count)
- Returns OK; client then connects via mesh transport

`leaveAudioRoom` updates the participant row to `status='left'`, `left_at=now()`.

### 4. UI integration
Update `src/routes/walk.active.$id.tsx` (existing audio walk surface):
- When walk type is `audio` or `irl_event` and `audio_room_id` exists, render `<AudioRoomPanel roomId={audio_room_id} walkSessionId={id} />`
- New component `src/components/audio-room-panel.tsx`:
  - Shows participant chips with avatar, display name, mute icon, animated speaking ring
  - Big mute/unmute button
  - "Leave audio (keep walking)" button — exits the room but doesn't end the walk
  - Capacity indicator: "5 of 8 walking together"
  - Empty/loading/error states; mic-permission denied state with retry

### 5. Database
No schema changes required — `audio_rooms` (max_participants default 8) and `audio_room_participants` already model this. We will:
- Confirm `max_participants` default stays 8 (matches your ask of 7–8)
- Add a small migration to set `audio_rooms.max_participants` to 8 for any existing rows (sample data) so the cap is consistent

### 6. Out of scope (deliberately)
- TURN server (mesh works for ~80% of NATs without TURN; we accept this tradeoff for keyless/free; analytics will show if it becomes a problem)
- Recording, transcription
- Server-side moderation/kick (host can still report via existing `safety_reports`)
- LiveKit/Daily implementation (interface is ready; swap when analytics justify it)

## Technical details

```text
Browser A                Supabase Realtime              Browser B
   │   ── offer (SDP) ──────►│────────── offer ─────────►│
   │◄─── answer (SDP) ───────│◄───────── answer ─────────│
   │   ── ICE candidates ───►│────────── ICE ───────────►│
   │                                                     │
   │═══════ direct WebRTC audio (P2P, via STUN) ════════│
```

Files created:
- `src/lib/audio/types.ts`
- `src/lib/audio/mesh-transport.ts`
- `src/lib/audio/use-audio-room.ts`
- `src/server/audio.functions.ts`
- `src/components/audio-room-panel.tsx`
- One migration to normalize `max_participants = 8`

Files edited:
- `src/routes/walk.active.$id.tsx` (mount the panel for audio walks)

## Why this matches your goals

- **Keyless & free**: zero third-party accounts, zero API keys, zero monthly cost.
- **8-person cap**: enforced server-side, matches existing schema default. Bumping to 10 later is a one-line DB change.
- **Swap path**: when admin analytics show connection failures or you outgrow 8, add `livekit-transport.ts` (same interface), add `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET` secrets, change one import in `use-audio-room.ts`. UI, RLS, gates, participant tracking — all unchanged.
- **Walk-gated**: server function rejects joins without an active walk session, so audio rooms can't become a "sit on phone" feature.
