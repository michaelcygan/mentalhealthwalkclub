## Groups, leveled up — alive without forcing social

The group page becomes a **living room, not a directory**. No member lists, no profile browsing, no chat. Instead: ambient signals of life, anonymized milestones, and two tiny private gestures (welcome, kudos) that batch into a quiet inbox.

### Principle

- Walks are the meeting. Everything else is a candle in the window.
- Default to anonymized aggregates; named beats only with opt-in via badge sharing.
- Every social action is **one tap, asynchronous, private, and batched** — never a chat thread, never a public wall.

---

## New page structure (`/groups/$slug`)

```text
┌──────────────────────────────────────────────┐
│  ← All groups                                │
│                                              │
│  [ Ambient gradient hero ]                   │
│   theme · 1,284 walkers                      │
│   Sunday Reset                               │
│   short description                          │
│                                              │
│   ◐ 42 walking this week  ·  next: in 3h    │
│   [ Walk now ]   [ Schedule ]  (host only)   │
└──────────────────────────────────────────────┘

┌── Pulse ─────────────────────────────────────┐
│  This week, together                         │
│  ── 84 walks · 19h 22m · 7 new members      │
│  (animated counters, no names)              │
└──────────────────────────────────────────────┘

┌── Welcome strip (if N≥1 new this week) ─────┐
│  7 walkers joined this week.                 │
│         [ Send a quiet welcome → ]           │
│   (one tap = batched signal to all 7)        │
└──────────────────────────────────────────────┘

┌── Milestones ────────────────────────────────┐
│  Quiet wins, last 14 days                    │
│   • Someone earned "Walked it through"      │
│     [ ♡ Send congrats ]                      │
│   • Someone hit 10 walks                     │
│     [ ♡ Send congrats ]                      │
│   • Three people earned "Sunday Reset"      │
│     [ ♡ Send congrats to all ]               │
└──────────────────────────────────────────────┘

┌── Upcoming walks ────────────────────────────┐
│  (existing list, tightened cards)            │
└──────────────────────────────────────────────┘

┌── Live now (if any) ─────────────────────────┐
│  small audio-room chips                      │
└──────────────────────────────────────────────┘

[Bottom mobile-sticky CTA: Walk now]
```

Removed: "Recently walked here" name list (privacy).

---

## Behavior

**Welcome (batched).** New member's row in `group_memberships` is the source. Show count of joined-this-week. One tap from any existing member sends a `welcome` signal to *each* of those new members from the sender. Sender sees: "Welcomed 7 walkers." Recipient sees a single line in their inbox: *"3 people in Sunday Reset welcomed you."* (Aggregated per group per 24h.) No names of senders shown to recipient — this is by design; it's a candle, not a handshake.

**Kudos.** Each milestone card represents a `user_badges` row earned in the last 14 days inside this group's walks (i.e., walks with `group_id = this`). Names are hidden by default. Tap ♡ → sends a `kudos` signal to that recipient. Recipient inbox aggregates: *"4 people congratulated you on Walked it through."*

**Inbox.** Tiny bell on `__root.tsx` mobile header (or in profile route — TBD smallest change). Shows unread count. Sheet/drawer with reverse-chronological aggregated lines. Tap = mark read. No replies, no threads.

**Privacy guarantees.**
- Recipient never learns sender identity.
- Sender never learns recipient identity for milestones (we surface "3 people earned X" — sender just sends "to whoever they are").
- No lists of who walked, joined, or earned anything — only counts.
- Opt-out per user via existing `user_preferences` (add boolean `allow_group_signals`, default true).

---

## Data — one tiny new table, nothing else

```sql
create table public.group_signals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  sender_user_id uuid not null,
  recipient_user_id uuid not null,
  kind text not null,           -- 'welcome' | 'kudos'
  badge_id uuid,                -- nullable, set for kudos
  created_at timestamptz not null default now(),
  read_at timestamptz
);
-- indexes on (recipient_user_id, read_at) and (group_id, kind, created_at)
-- RLS: sender can insert as self; recipient can select+update (read_at) own rows.
-- Unique partial index to dedupe spam: (sender_user_id, recipient_user_id, kind, badge_id) within 24h via trigger.
```

Add one column: `user_preferences.allow_group_signals boolean default true`.

Everything else reuses existing tables: `walk_sessions`, `user_badges`, `group_memberships`, `audio_rooms`, `events`.

---

## Code surface (small, focused)

- **Edit** `src/routes/groups.$slug.tsx` — replace recent-walks block with Pulse + Welcome + Milestones sections; mobile sticky CTA. ~180 LOC total.
- **New** `src/components/group-pulse.tsx` — animated counters (CSS `@property` count-up, no library).
- **New** `src/components/milestone-row.tsx` — anonymized badge row + ♡ button.
- **New** `src/server/group-signals.functions.ts` — `sendWelcome(groupId)`, `sendKudos(badgeRowId)`, `getInbox()`, `markRead(ids[])`. All `requireSupabaseAuth`. Server-side aggregation + 24h dedupe.
- **New** `src/components/inbox-bell.tsx` — bell + sheet, mounted in `__root.tsx` header (auth-only).
- **One migration** for `group_signals` + `allow_group_signals` column + RLS.

No changes to: `groups.tsx` list, `events.*`, `audio.functions.ts`, `walk-talk-dock`, schema for existing tables.

---

## Mobile-first details

- Sticky bottom CTA bar (`Walk now` / `Schedule`) — uses safe-area-inset; appears only when scrolled past hero.
- Pulse counters animate once on viewport-enter using `IntersectionObserver`, then settle.
- Milestone rows use long-press (200ms) for "send congrats to all who earned this badge this week" — short tap = single.
- Inbox sheet is bottom drawer (`<Drawer>` already in shadcn) with snap points.
- Theme gradient hero already exists — extend with subtle `radial-gradient` "breathing" animation (2.5s ease-in-out, `prefers-reduced-motion` respected).

---

## Why this is "2026 best in class"

- **Ambient social** instead of feed-driven. No likes count, no follower graph, no notifications begging for return engagement.
- **Aggregated by default**, named only when the user opts in by *earning a badge*.
- **One-tap warmth.** Welcomes and kudos take a single intent; the system handles fan-out and dedupe.
- **Inbox is finite.** Nothing to scroll forever. Read = gone.
- **Schema discipline.** One table, one column. Reuses badges as the milestone substrate. No chat infra debt.

---

## Out of scope (intentionally)

- No chat, threads, replies, or DMs.
- No member directory or profile browsing inside groups.
- No push notifications (inbox is pull-based — can layer later).
- No emoji reactions beyond ♡.
- No leaderboards.

---

## Questions before building

1. Inbox bell location — mounted in `__root.tsx` header (visible everywhere) or only on `/profile` and `/groups/*`?
2. Should milestone congrats reveal **how many** people congratulated you, or just *"someone congratulated you"*? (Count feels warmer; absence is more anonymous.)
3. For welcomes: surface to brand-new joiners *"7 walkers said welcome"* in their Groups tab next to the joined group, or only inside the inbox?
