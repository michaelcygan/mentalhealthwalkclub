## Scaling Friend Walks for large audiences

Right now a Friend Walk is a tight 4-speaker room with a small listener pool, all auth-required. If a celebrity or influencer drops a link to their followers, two things break: the audio mesh can't carry hundreds of listeners, and forcing signup at the door kills the viral moment.

This plan splits the room into **speakers (mesh audio)** + **listeners (broadcast-only)**, opens listening to logged-out guests, and gates "ask to speak" behind a fast inline signup.

---

### 1. Two-tier room model

```text
                ┌───────── Friend Walk ─────────┐
                │                                │
  Speakers (≤4) │  full-mesh audio, can talk     │  ← signed in
  ─────────────────────────────────────────────  │
  Lobby (≤~50) │  signed-in listeners,           │  ← signed in
                │  can raise hand → promoted      │
  ─────────────────────────────────────────────  │
  Audience     │  broadcast-only, no mic ever    │  ← guest OR signed in
                │  reactions, count, captions     │
                └────────────────────────────────┘
```

- **Speakers** stay on the existing WebRTC mesh (cap 4, unchanged).
- **Lobby** is a bounded, named pool (default 50). These are the people the host can promote. Same realtime UI as today's listener pool, just paginated.
- **Audience** is unbounded. They receive a one-way audio stream and can send lightweight reactions (❤️ 👏 🌿) and see the live transcript/captions if enabled. They cannot raise a hand without signing in.

We don't need a third-party SFU on day one. Phase the rollout:
- **Phase A (this pass):** keep mesh for speakers. For the audience, broadcast via a server-fanned **MediaRecorder → HLS-style chunks** or just a **read-only Realtime channel of "who's speaking + reactions + captions"** — i.e. presence + waveform, no audio yet. This unlocks scale without an SFU.
- **Phase B (follow-up, flagged):** add a real audio broadcast leg using LiveKit / Cloudflare Calls SFU when a room crosses an `audience_threshold` (e.g. > 20). Triggered server-side; speakers don't notice.

Phase B is scoped but not built in this pass — we add the seams (room mode, capacity fields, transport abstraction) so it slots in cleanly.

---

### 2. Logged-out listening, gated speaking

Behavior on `/w/:code`:

| State | Listen | React | Raise hand | Speak |
|---|---|---|---|---|
| Guest (logged out) | ✅ | ✅ (rate-limited, anon id in cookie) | ❌ → opens signup | ❌ |
| Signed-in listener | ✅ | ✅ | ✅ → enters lobby | ❌ until promoted |
| Promoted speaker | ✅ | ✅ | n/a | ✅ |
| Host | ✅ | ✅ | n/a | ✅ + promote/kick |

- Tapping **"Ask to speak"** as a guest opens a **bottom-sheet quick signup** (email + display name + password, or Google) inline — no full-page redirect, no leaving the walk. On success they land back in the same room as a lobby member and the raise-hand request fires automatically.
- Guests get a stable anonymous `guest_id` (cookie) so reactions and presence work, and so we can rate-limit / shadow-ban abusers without an account.

---

### 3. Safety for big rooms

- **Host controls:** mute speaker, demote to lobby, remove from room, lock room (no new joiners), pause reactions.
- **Reaction rate limit:** max N per guest per 10s, server-enforced.
- **Word filter on raised-hand "intro" text** (optional 1-line "why you want to speak").
- **Auto-kick on report threshold:** 3 reports from distinct signed-in users in 60s → auto-removed, host notified.
- **Block list** already exists (`blocks` table) — apply it to reactions and lobby visibility.

---

### 4. What changes in the app

**Database (one migration):**
- `audio_rooms`: add `audience_mode` (`closed` | `lobby` | `broadcast`), `lobby_capacity` (default 50), `audience_count` (rollup), `allow_guest_listeners` (bool, default true for friend walks), `reactions_enabled` (bool, default true), `is_locked` (bool).
- New table `room_audience_presence` (ephemeral): `room_id`, `guest_id` (text) **or** `user_id`, `last_seen_at`. Used for live count + rate limiting; pruned by a cron.
- New table `room_reactions`: `room_id`, `actor_id` (guest or user), `kind`, `created_at`. RLS allows insert by anyone for friend rooms with `reactions_enabled`, select by participants.
- Extend `participant_role` enum with `lobby` (distinct from `listener`, which becomes legacy/alias).

**Server functions (`friend-walk.functions.ts`):**
- `joinAsAudience({ code, guestId? })` — no auth required; returns a read-only realtime channel name + room snapshot.
- `sendReaction({ roomId, kind })` — works for guest + user, rate-limited.
- `requestToSpeak()` — auth required; if called while guest, server function 401 → client opens signup sheet.
- `lockRoom`, `kickParticipant`, `muteSpeaker` — host only.
- Update `joinFriendWalk` to route into lobby (not auto-speaker) once speakers ≥ 4 OR audience_mode = `broadcast`.

**Client:**
- `/w/:code` becomes a **public route** (no auth gate). Renders three zones: stage (speakers), lobby strip (signed-in only), audience bar (count + reactions).
- New `<QuickSignupSheet />` invoked from "Ask to speak" / "Join the walk" CTAs. Uses existing `AuthForm` in compact mode.
- New `<AudienceBar />` with floating reaction emojis and live count.
- New `<HostControls />` drawer for the host (lock, mute, kick).
- Update `share-card.tsx` to optionally render "🎙 LIVE • {audience_count} listening" when broadcast mode is on.
- Abstract audio transport in `src/lib/audio/` so Phase B (SFU) can swap in without touching components.

**Routing:**
- `/w/:code` already exists — relax its auth requirement, add SSR-safe guest path.

---

### 5. Open questions for you

I'll ask these inline before building so we don't over-scope.

### Technical notes (for reference)

- Mesh stays ≤4 speakers — anything more requires an SFU and we don't ship that today.
- Guest identity is a signed cookie (`guest_id`), not anonymous Supabase auth (you've asked us never to use anon signups).
- All large-audience features are gated behind `room_type = 'friend'` so open rooms / events are unaffected.
- The Phase B SFU swap is a transport-level change; the role model (speaker / lobby / audience) does not change between phases.