# Discover: zero-to-dense-city plan

## Product principle
Use one responsive page system, but let its hierarchy change with available activity. The visual language stays consistent; the content mode adapts:

```text
Zero nearby activity → Build the first connection
Some activity        → Balance personal network + nearby walks
Dense city            → Rank, filter, and reduce noise
```

A static layout would not serve all three states well. The same components can, provided they are conditionally prioritized rather than leaving repeated empty boxes in place.

## 1. Replace stacked empty states with one activation surface
- Detect the true cold-start state from nearby walks, friend activity, circles, and the user’s own recent activity.
- Replace the current sequence of dashed empty boxes with a single purposeful opening module.
- Give two equally weighted actions:
  - **Invite someone** — opens a compact share sheet with **Text**, **Share**, and **Copy link**.
  - **Plan a walk** — opens the existing walk composer.
- Explain the choice plainly: invite someone into the club generally, or create a specific plan and invite them to that.
- Keep secondary discovery below this surface so the page still has value in a new territory.

## 2. Make invitations a coherent flow
- Upgrade the existing invite card into a reusable invite/share component rather than a late-page promotional card.
- Support phone-number intent through the device’s SMS composer without collecting or storing contacts.
- Preserve native sharing and copy-link fallback.
- Use concise copy and clearly distinguish:
  - **Club invite**: bring a friend into the app.
  - **Walk invite**: share a concrete walk with date, time, and place.
- Give completion feedback and retain the invite controls so users can send more than one invitation.

## 3. Close the loop after posting a walk
- Keep the existing walk composer focused on place, time, and audience.
- After creation, make sharing the primary host action on the walk page instead of a small utility chip.
- Present **Text invite**, **Share**, and **Copy link** immediately, with language tied to that specific walk.
- Keep calendar and story-card actions secondary.
- Ensure link-only walks remain useful for users who have no in-app friends yet.

## 4. Adapt Discover by network density
### Cold start
- Lead with the equal-choice activation surface.
- Show a compact “nothing nearby yet” explanation once, not once per section.
- Offer useful territory-independent content below it: featured walks, trails/places, and public activity from a wider radius where available.
- Hide empty Friends and Circles rails; replace them with contextual next steps inside the activation surface.

### Emerging network
- Lead with the user’s next hosted/RSVP walk or friend activity.
- Follow with nearby walks, then circles and invitations.
- Show lightweight progress cues such as pending invitations or the first active circle only when real data exists.

### Dense metro
- Lead with ranked nearby and friend-relevant walks.
- Keep horizontal rails bounded and add meaningful filters such as timing, distance, and social relevance rather than rendering an unbounded feed.
- De-emphasize generic invite education while keeping invite/share available as a compact action.
- Preserve the same cards, typography, and interaction model used in cold start so users do not have to relearn the page.

## 5. Refresh the visual treatment toward 2027
- Move away from repeated dashed containers and grids of speculative circle templates.
- Use a calmer editorial hierarchy: one decisive activation block, compact live-data rows, fewer borders, and stronger spacing transitions.
- Treat empty space as guidance, not absence: short state copy, visible actions, and subtle progressive disclosure.
- Keep the app’s cream/forest identity and serif voice; modernize composition rather than introducing a trend-driven new palette.
- Maintain thumb-friendly actions and a clean mobile-first layout, then let wider screens expand rails without changing the information order.

## 6. Simplify Friends and Circles entry points
- Route the cold-start invite action directly into the new share sheet instead of asking for an existing username first.
- Retain username-based friend requests for people already on the app.
- In Circles, make “create a circle” useful after at least one invite/friend path is visible; remove the impression that users must choose from prewritten identity groups before they know anyone.
- Allow a newly created circle to flow naturally into planning a circle-scoped walk.

## 7. Validation
- Test explicit fixtures for: zero local activity, nearby walks without friends, friends without circles, one active circle, and dense metro data.
- Verify club invites via SMS/native share/copy, walk-specific sharing, walk creation handoff, location denied, and fallback behavior where native sharing is unavailable.
- Check mobile composition at the current 390px viewport and a desktop width, with special attention to bottom navigation clearance and action visibility.

## Technical scope
- Refactor `src/routes/_authenticated/discover.tsx` around a derived density/activation state and adaptive section ordering.
- Turn `src/components/discover/invite-card.tsx` into a reusable invite/share surface used by Discover and the post-walk flow.
- Update `src/routes/w.$code.tsx` so hosts get a prominent walk-specific invitation block.
- Make targeted adjustments to `src/routes/_authenticated/walk.new.tsx` and `src/routes/_authenticated/circles.tsx` for clean handoffs and contextual empty states.
- Reuse existing server functions and shareable links; no new contact storage or database migration is planned unless implementation reveals a missing persisted invitation requirement.