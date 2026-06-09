## Goal

Surface scheduled walks on the Home page so a user who has RSVP'd (or is hosting) sees them immediately, alongside a small dose of friend activity for walks worth joining.

## What lands on Home

A new `UpcomingRail` block, placed directly under `TodayIsland` (top of the feed, above `BestWindow`):

1. **Your next walks** — events where you are host or have RSVP'd `going`, `starts_at >= now()`, ordered soonest first, up to 3.
   - Card shows: cover, title, "Today 5:00 PM" / "Thu, Jun 11", venue, "You're going" or "You're hosting" pill, plus `going_count` if > 1.
   - Tap → `/w/{slug}`.
2. **Friends going this week** — up to 3 upcoming public/link_only events where ≥1 mutual-follow friend RSVP'd `going`, within next 7 days, excluding events you're already on. Shows friend avatar stack + "Maya + 2 going".
   - Tap → `/w/{slug}`. Single "I'm in" quick-RSVP via existing `quickRsvpEvent`.
3. **Empty state** — if no personal RSVPs and no friend activity, the whole rail hides (no clutter on Home). If only friend activity exists, render just that subsection.

Headline: "Upcoming" with subcopy "Walks you're on + friends going this week".

## Technical Details

- **New server fn** `getHomeUpcoming` in `src/lib/discover.functions.ts` (auth-protected). Returns `{ mine: UpcomingMine[]; friends: FriendsGoingEvent[] }`.
  - `mine`: query `events` joined with `event_rsvps` filtered by `user_id = auth.uid() AND status='going'` UNION events where `host_user_id = auth.uid()`, `starts_at >= now()`, `status='published'`, limit 3.
  - `friends`: reuse the logic in `discoverFriendsGoing` but narrow the window to next 7 days and exclude events already in `mine`. Cap at 3.
- **New component** `src/components/home/upcoming-rail.tsx` — renders both subsections with existing card styling tokens (cream card, forest accents). Reuses `RsvpPill` for quick "I'm in".
- **Home wiring** in `src/routes/index.tsx`: insert `<UpcomingRail />` between `<TodayIsland />` and `<BestWindow />`. Component self-hides when both lists are empty (returns `null`), so the layout stays clean for new users.
- **Data fetching**: `useQuery` against the new server fn with a 60s `staleTime`; invalidate on `quickRsvpEvent` success so the rail updates after RSVP.

## Out of Scope

- No changes to `/discover` (the "This week near you" section there stays).
- No notifications, push, or calendar export from this rail.
- No new RSVP states or copy overhaul.
- No design-token or layout changes outside the new component.

## Verify

- As a user with a future RSVP: rail shows it first with correct time/venue.
- As a user with no RSVPs but a friend RSVP'd this week: rail shows only the friends subsection.
- As a brand-new user with neither: rail does not render and Home looks identical to today.
- Quick-RSVP from the friends subsection moves the event into `mine` on next refetch.
