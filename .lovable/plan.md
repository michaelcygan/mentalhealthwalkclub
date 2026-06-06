## Audit fixes + finish v1 walk gaps

Going with **Option B**: no email send-out / magic-link work this pass. I'll soften any copy that implies it. Story card is **in scope** as a templated SVG (same engine as the OG route), no AI image generation.

### 1. Bug fixes

- **Realtime crash on /profile** — In `useSubscription` and `WalkBroadcasts`, suffix the channel topic with a per-mount `crypto.randomUUID()` so StrictMode remounts don't collide on the still-joined channel. Keep `removeChannel` cleanup.
- **Dead `/badges` link** — `src/routes/journal.tsx:262`: re-point to `/profile`.
- **Dead `/events/$slug` links** — update `src/routes/_authenticated/discover.tsx:134` and `places.$key.tsx:117` to `to="/w/$code"` with the event slug.
- **Placeholder routes** — `src/routes/events.tsx` becomes a `beforeLoad` redirect to `/walk/new` (keep the `walk_create_intent` sessionStorage); `src/routes/events.$slug.tsx` becomes a redirect to `/w/$code`.
- **Profile `setGroups` no-op** — remove the unused state + setter.
- **Profile double stats** — drop the inline `WalkClubStats` block; instead surface `walks_hosted / walks_attended / current_streak_weeks` from the `profiles` row inside the existing hero grid so there's one source of truth (triggers already maintain those).

### 2. Walk page completeness

- **Attendee avatar wall** on `/w/$code`: new `AttendeeStack` component fed by `getWalkByCode`'s existing `attendees[]`, plus a realtime subscription on `event_rsvps` (using the nonce pattern). Drive `RsvpRow`'s count from the live list instead of optimistic `attendeeCount + 1`.
- **Broadcast reactions** (👍 ❤️ 🌧️): add `reactToBroadcast` server fn (writes to existing `event_broadcast_reactions`); render a reaction row under each broadcast.
- **Host RSVP management**: add `removeRsvp` server fn + a small "remove" affordance on the host-only attendee list.
- **Recap "Plan the next one"**: button on `/w/$code/recap` that links to `/walk/new?from={code}`; `walk.new` reads `from` and prefills place, time-of-day, group/circle from the source event.
- **Copy softening (Option B)**: in `GuestRsvpSheet` replace "We'll send a reminder." with "Your name goes up on the wall — the host will see you're in.", and on the recap page drop any "claim your walks" mention.

### 3. Story card (1080×1920 SVG, templated)

- New route `src/routes/api/public/walk.$code.story.ts` mirroring the OG handler's structure: title, date/time, city, vibe, RSVP count, walking-feet glyph, brand stripe — pure SVG, same palette as OG. No AI imagery.
- Add a "Share to IG Story" button next to the existing Share / Add to calendar row on `/w/$code`; on tap, fetch the SVG, render to a 1080×1920 PNG via an offscreen canvas, then `navigator.share({ files: [...] })` with clipboard fallback.

### 4. Cleanup

- `listBroadcasts`: switch from `supabaseAdmin` to the user-scoped client (RLS already allows attendee reads).
- `getWalkByCode`: trim the column select to fields the page actually renders (drop `region,state,country`).

### Technical notes

- No DB migrations required. All listed features use existing tables.
- New server fns live in `src/lib/walks.functions.ts`; new server route under `src/routes/api/public/`.
- Story PNG conversion happens client-side in the share handler — keeps the server route as cacheable SVG.
- Verification: load `/profile` (no realtime overlay), open a walk, RSVP from a second browser to confirm the avatar wall updates live, hit the story endpoint to confirm SVG renders, click "Plan the next one" from a past walk to confirm prefill.

### Out of scope (explicitly deferred)

- Guest confirmation / reminder / recap emails.
- Magic-link "claim your walks" account merge.
- Open broadcast chat thread.
