# Groups: level-up pass

A focused pass on the Groups detail sheet (and a few list-side touches) that adds the missing scheduling actions, deepens "alive without forced social," and tightens space — almost entirely by composing primitives already in the codebase (`events`, `audio_rooms`, `walk_sessions`, `group_signals`, `GroupPulse`, `useAuthPrompt`).

## 1. Scheduling lives inside "Upcoming walks"

Replace the host-only desktop "Schedule a walk" CTA in the header with a small, member-accessible **scheduling row** at the top of the Upcoming walks section:

```
Upcoming walks                        [+ In person] [+ Audio circle]
```

- **+ In person** → `Link` to `/events/new?group={id}&mode=irl`. Only shown when `group.city` is set (city groups). City is prefilled in the form via `?group=`.
- **+ Audio circle** → `Link` to `/events/new?group={id}&mode=audio`. Always available.
- Both are pill buttons (icon + label), `border-border bg-card hover:border-forest/40`, sized small so they read as inline actions, not heroics. Mobile: stack into a 2-up row directly under the section title.
- Empty-state copy upgrades from "No upcoming walks tagged with this group yet." to: "Nothing on the calendar. **Start one** — others can quietly join." with the same two pill buttons centered below.
- Permission: any signed-in member can schedule (matches existing `events_insert_own` RLS — `host_user_id = auth.uid()`). Wrap in `requireAuth`.

Add nothing new to `events.new.tsx`; it already accepts `?group=&mode=` and persists `group_id`.

## 2. "Live now" gets one quiet upgrade

Open audio rooms already render as pills. Add a single primary affordance: the pill becomes a `Link` to `/audio/$id` (or current open-room route — verify in `audio-room-panel.tsx`). No extra metadata, no host names. Tapping it = "drop in." Keeps the "no forced social" tone — joining is one tap and silent (existing audio room flow).

If no live rooms but a member wants to start one casually (not scheduled), add a faint third row beneath Live now when empty: "**Open a circle now** — others nearby can drop in." → creates an `audio_rooms` row with `group_id`, `host_user_id=user.id`, `room_type='open'`, `status='open'`, then routes into it. Uses the same insert RLS that already exists.

## 3. Detail sheet: tighten and modernize

Current sheet is good but reads like a stacked page. Targeted polish:

- **Header** — keep gradient + walker count. Move the Walk-with-this-group button into a slim, full-width sticky **action bar at the top of the sheet body** (not the very top — under the header), shaped like the mobile bottom-pill but inline. Two slots: `[ Walk now ] [ Schedule ▾ ]` where Schedule opens a tiny popover with the two scheduling pills (radix `Popover` already in the project via shadcn). On md+ this collapses into the header inline (as today). Removes one vertical section.

- **GroupPulse** — keep stats, but reduce vertical weight: drop card padding from `p-5` to `p-4`, remove the eyebrow ("This week, together") and instead pin it as a thin label inside the card's top-right corner in muted micro-caps. Saves ~32px.

- **Quiet wins (milestones)** — collapse to a single horizontally scrollable row of badge chips on mobile (`overflow-x-auto`, snap), keeping the kudos affordance. On md+, keep the stacked list. This is where the section feels heaviest today.

- **New welcome strip** — when `newMembers > 0` AND user is a member, current strip is fine. When user is **not** a member, replace it with a soft join nudge: "{N} walkers joined this week." + Join button (reuses `toggleJoin` from the list — lift into a shared `useGroupActions` hook, see §6). Same shape, different verb.

## 4. "Alive without forcing social" — one new ambient signal

Add a single, anonymous ambient line at the top of the sheet (between header and pulse), only if non-zero:

> "**3 walking right now · 12 today**"

- "Walking right now" = `walk_sessions` with `group_id = g.id AND status='active'`.
- "Today" = same with `status='completed' AND started_at >= today`.
- Renders as one line of muted text with a single soft pulsing forest dot. No names, no avatars. This is the "presence without performance" beat.
- One extra `Promise.all` query in the existing `useEffect` — no new files.

Subscribe to realtime (one channel) for `walk_sessions` filtered to this group so the number updates live. The existing client supports it; cost is ~6 lines.

Enable realtime via migration:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.walk_sessions;
```

## 5. List-side tightening

The Groups tab list is already strong. Two small wins:

- **Pulse strip** card hover/active: add `transition-transform hover:-translate-y-0.5 active:translate-y-0` for tactile feel. CSS-only.
- **Chip row** on mobile: add `snap-x snap-mandatory` and `snap-start` per chip so quick filtering feels native.
- **Empty state** when no groups joined yet: replace generic empty card with a one-line whisper: "You haven't joined any. Tap a card — leaving is just as easy."

## 6. Code consolidation

Lift the join/leave logic (currently duplicated potential between list and any future detail join) into `src/hooks/use-group-actions.ts`:

```ts
export function useGroupActions() {
  // returns { toggleJoin(group), startSoloWalk(group), openCircle(group) }
  // wraps requireAuth, supabase calls, and toast
}
```

Refactor `groups-tab.tsx` and `groups.$slug.tsx` to use it. Net code: small reduction, single source of truth.

## Out of scope

- No new tables, no new columns, no new server functions.
- No DMs, no public reactions, no chat. Privacy stance preserved.
- No changes to event creation form internals — only deep-linking into it with `?group=&mode=`.
- No changes to the bottom nav, theme tokens, or auth flow.

## Files touched

- `src/routes/groups.$slug.tsx` — scheduling row, ambient presence line, top action bar with popover, realtime subscription, milestone scroller, member-aware welcome strip.
- `src/components/group-pulse.tsx` — padding/eyebrow tweak (~6 lines).
- `src/components/groups-tab.tsx` — chip snap, pulse-card hover, empty whisper.
- `src/hooks/use-group-actions.ts` — new, ~40 lines.
- One migration line to enable realtime on `walk_sessions`.

Estimated net new code: ~120 lines added, ~40 removed.
