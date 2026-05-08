# Friend Walk — viral, link-gated walk & talk

A user spins up a **Friend Walk** from their profile / FAB. They get a beautiful share card + short link they can drop into Instagram Stories, iMessage, etc. Anyone with the link can hop in. The room stays open as long as the host keeps it live (auto-closes after inactivity). Up to **4 active speakers**; everyone else lands as a **Listener** in a waitlist pool with a one-tap "Ask to speak" / "Join walk" toggle.

This is genuinely viral: every shared link is an invitation that demonstrates the product in 5 seconds.

---

## UX flow

1. **Start** — From the mobile FAB long-press menu, add a "Friend Walk" mode (alongside Solo / Walk & Talk / Guided / Local). Tapping it instantly creates the room and opens the share sheet.
2. **Share card** — A generated 1080×1920 SVG/Canvas graphic with the host's name, avatar, soft gradient, and the short link (`/w/{code}`). One tap → native Web Share API → IG / iMessage / WhatsApp. Fallback: copy link + download image.
3. **Join via link** — `/w/{code}` resolves to the active room. Auth-gated (sign in or quick magic-link). Joiner picks **Speak** or **Listen** at the door.
4. **In-room** — Same `walk-talk-dock` UI, with two new affordances:
   - **Speakers rail** (≤4 avatars, glow on speaking) — existing dock.
   - **Listener pool** — horizontal avatar strip below, with count ("+7 listening"). Each listener has a "Raise hand" toggle. When a speaker leaves, the oldest raised hand auto-promotes (or host taps to admit).
5. **Persistence** — Room stays "open" while ≥1 participant is present. Empty for >5 min → auto-close. Host can re-open the same code within 24h (link stays alive in their Story).
6. **End** — Host taps "End Friend Walk" → all participants get a soft "thanks for walking" toast + CTA to start their own.

---

## Technical plan (lean, reuses everything)

### Data
Reuse `audio_rooms` — add 3 columns via migration:
- `room_type` already exists; add value `'friend'`.
- `share_code text unique` — short 8-char nanoid for the URL.
- `host_user_id` already exists.
- `max_speakers int default 4` (rename of `max_participants` semantics for friend rooms; no schema change needed, just reuse `max_participants`).
- `listener_mode boolean default true` — when true, participants beyond `max_participants` join as listeners.

Reuse `audio_room_participants` — add 1 column:
- `participant_role text default 'speaker'` — `'speaker' | 'listener' | 'raised_hand'`.

RLS stays the same (room is selectable by anyone authenticated; the link itself is the "permission" — knowing the code = invited).

### Routes
- `src/routes/w.$code.tsx` — short public landing → resolves code → redirects to `/walk/active/{walk_session_id}` after creating a participant row. Includes a "Speak or Listen" door step.
- Reuse `src/routes/walk.active.$id.tsx` — branch UI when `room_type='friend'` to show listener pool.

### Components
- `src/components/friend-walk/share-card.tsx` — Canvas-rendered 1080×1920 PNG with host avatar, name, gradient, short link, and a soft "Tap to walk with me" caption. Uses `share()` from `lib/device.ts`.
- `src/components/friend-walk/listener-pool.tsx` — Horizontal scroll of listener avatars with "Raise hand" toggle and host-side admit.
- Extend `src/components/mobile-tab-bar.tsx` radial menu with "Friend Walk" option.

### Server functions
- `src/lib/friend-walk.functions.ts`:
  - `createFriendWalk()` — inserts `audio_rooms` with `room_type='friend'`, generates `share_code`, creates host's `walk_session`, returns `{ code, walkId }`.
  - `joinFriendWalk({ code, asListener })` — resolves code → upserts participant with role → returns `walkId`.
  - `raiseHand({ roomId })` / `admitListener({ roomId, userId })`.

### Realtime
Reuse the existing `audio_room_participants` realtime channel. Listener-pool component subscribes to inserts/updates filtered by `audio_room_id`.

### Auto-close
A lightweight check inside `tg_audio_room_participant_count` already closes rooms when count hits 0. For friend rooms add a 5-min grace via the existing `rotate-pods` cron route or a new `close-stale-friend-rooms` cron.

---

## Files to create / edit

**New**
- `supabase/migrations/...` — add `share_code` + `participant_role` columns, unique index on `share_code`.
- `src/lib/friend-walk.functions.ts` — server fns.
- `src/routes/w.$code.tsx` — short link landing.
- `src/components/friend-walk/share-card.tsx` — canvas share image + share sheet.
- `src/components/friend-walk/listener-pool.tsx` — listener UI.

**Edited**
- `src/components/mobile-tab-bar.tsx` — add "Friend Walk" radial option.
- `src/routes/walk.active.$id.tsx` — render listener pool + share button when `room_type='friend'`.
- `src/routes/api/public/hooks/rotate-pods.ts` — add stale friend-room sweep (or new cron).

---

## Why this is the right viral loop
- **Zero friction**: one tap to create, one tap to share, one tap to join.
- **Demonstrates product in the share itself**: the graphic shows the host's face mid-walk — every story is an ad.
- **Low-pressure**: listeners can lurk, lowering join anxiety.
- **Genuine social behavior**: "I'm walking, come walk with me" is a real thing people say.

Shall I build it?
