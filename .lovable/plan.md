## Goal
Make the app feel world-class without adding much surface area. Every change below leans on entities you already have (`walk_sessions`, `audio_rooms`, `events`, `event_rsvps`, `groups`, `group_memberships`, `user_badges`, `profiles`). No new tables. Mostly UI + a handful of small queries and one tiny migration for a view.

---

## 1. Home (`/`) — turn it into a true "today" hub
Right now logged-in home is a 4-step wizard with a static hero. The hero eats the fold and the wizard hides everything else.

- **Collapse the hero** on logged-in view to a slim greeting strip ("Good evening, Lorenzo · 47 min this week"), reclaiming ~280px above the fold.
- **Replace the 2×2 quick actions with a single primary "Start a walk" CTA + one-tap mode pills** (Solo · Guided · Walk & Talk · Local). One tap → straight into mood step. Cuts the funnel from 4 steps to 2.
- **Add a "Happening now" strip** under the CTA: live `audio_rooms` (status='active') + `events` starting in the next 2 hours. Tap → join/RSVP. This is the single biggest unlock — Walk & Talk and Local Walks are invisible from home today.
- **"Continue where you left off"** card if there's an `active` `walk_sessions` row for the user (recovers dropped sessions).
- **Weekly ring** instead of flat bar: a circular progress matching Apple Fitness aesthetic, plus a 7-dot streak row (one dot per day this week, filled if any walk completed).

## 2. Journal — modernize, make it feel earned
- **Hero stats row** (walks / minutes / miles) becomes a single elegant card with a 12-week sparkline of weekly minutes (compute client-side from the rows we already pull).
- **Mood delta chips**: for each walk, show `mood_before → mood_after` as colored chips with the numeric delta when both scores exist. Adds emotional payoff to logging.
- **Group walks by month** with sticky month headers — much better scanning at 30+ entries.
- **Badges become a horizontal scroll rail** of medallion cards (currently a 2-col grid that competes with the walks list).
- **Empty state** gets a "Take a 5-minute walk" CTA that deep-links into the home flow with `walkType=solo` preselected.

## 3. Groups — from list to discovery
- **Two sections:** "Your groups" (joined, compact chips at top) and "Discover" (cards). Today everything is one undifferentiated grid.
- **Each card shows a live signal:** "3 walks this week" or "1 Walk & Talk live now" (count `walk_sessions` joined via group, or `audio_rooms` with matching `group_id` if present — fall back gracefully).
- **Theme-tinted cards** using the existing `theme` column (anxiety = soft blue, burnout = warm clay, etc.) — gives the page visual rhythm.

## 4. Events / Local Walks
- **Default the city filter** to the user's `profiles.city` on first load (one-line change, big UX win).
- **Group by date** ("This weekend", "Next week", "Later") with a sticky day header — matches how people actually plan.
- **Distance badge** when both event coords and user coords exist ("0.4 mi away") — uses Haversine helper already in `walks.functions.ts`.
- **Map-free preview**: each card gets a small static gradient banner derived from `vibe` so the list scans visually instead of being a wall of text.

## 5. Walk & Talk discoverability
The biggest hidden feature. Today you only find a Walk & Talk room by being in one. Fix:
- Surface live rooms on Home ("Happening now") **and** add a thin "X walking & talking now" pill in the desktop sidebar that links to `/events` with a `?mode=audio` filter. Reuses `audio_rooms` + `audio_room_participants`.

## 6. Profile
- **Profile header card** with avatar circle (initials from `display_name`), city, and a one-line "since {created_at}" — currently just stacked form fields.
- **Inline-edit pattern** instead of always-visible inputs: tap a field to edit. Less visual noise.
- **Goal control**: expose the 90 min/week target as an editable number (already implied by the home progress bar). Stored in `user_preferences`.

## 7. Desktop layout — use the space
On `md+` we have a 240px sidebar and then a 768px max-width column floating in a sea of whitespace. Two changes:
- **Wider main column** (`max-w-5xl`) on Home, Journal, Events, Groups.
- **Two-pane on Journal and Events** at `lg+`: list on the left, selected detail on the right (no route change needed for Journal — local state; Events can keep route-based detail). Feels like Linear/Things instead of a mobile page stretched wide.

## 8. Visual polish (cross-cutting)
- **Section dividers**: replace bare `<h2>` with a small forest-colored eyebrow + serif heading pattern, reused everywhere.
- **Card hover**: subtle lift (`translate-y-[-1px]` + shadow) on all clickable cards — already used on event cards, propagate.
- **Skeleton loaders** for Home/Journal/Events first paint (currently flash empty).
- **Tighter mobile spacing**: reduce `pt-6` to `pt-4` on main, `space-y-6` → `space-y-5` on tabs. Reclaims a full card of vertical space on 390px viewports.

---

## Technical notes

**No new tables.** One optional migration: a SQL view `v_live_signals` joining `audio_rooms` (active) + upcoming `events` (next 2h) so Home can fetch in a single query. Skippable — two parallel queries also fine.

**New / changed files (estimated):**
- `src/routes/index.tsx` — restructure logged-in view (~80 lines net).
- `src/routes/journal.tsx` — sparkline + month grouping + chips (~60 lines).
- `src/routes/groups.tsx` — split sections + live signals (~40 lines).
- `src/routes/events.tsx` — default city + date grouping + distance (~40 lines).
- `src/routes/profile.tsx` — header + inline edit + goal (~50 lines).
- `src/routes/__root.tsx` — wider main column, sidebar live pill (~15 lines).
- `src/components/live-now-strip.tsx` — new, ~50 lines, used on Home and sidebar.
- `src/components/weekly-ring.tsx` — new, ~30 lines SVG, used on Home + Journal.
- `src/components/section-heading.tsx` — new, ~15 lines, reused everywhere.

Net: ~3 small new components, 6 route edits, no schema changes (or one optional view). All reads use rows/columns already returned by current queries; the only new query is `audio_rooms` + upcoming `events` for the Live Now strip.

**Out of scope for this pass** (call out explicitly so we don't sprawl): no maps, no chat, no notifications system, no new tabs, no avatar uploads. These are the next plan if you want them.

---

## Suggested order
1. Home restructure + Live Now strip + Weekly ring (highest perceived impact).
2. Journal modernize (sparkline, month groups, badge rail).
3. Events + Groups polish (city default, date grouping, live signals).
4. Profile header + desktop two-pane on Journal/Events.
5. Cross-cutting polish (skeletons, spacing, hover).

Want me to proceed with all of it, or cherry-pick a subset?