# Lean V1 launch plan

## V1 objective

Make this simple loop reliable:

```text
Create walk → Share link/story → Guest RSVP → Keep RSVP state
→ Optional account creation → Return to the walk → Share or plan again
```

No email sending, physical attendance tracking, full chat, automated circle enrollment, or growth analytics in V1.

## 1. Fix launch-critical correctness and privacy

- Count both member and guest “going” RSVPs in the walk total and social share count.
- Keep guest names visible only to the host; public visitors see member profiles plus an aggregate guest count.
- Replace predictable walk-link generation with secure random codes.
- Require an explicit server-side encryption secret for guest emails; remove the public/fallback-key behavior.
- Sanitize username searches before backend filtering.
- Add an explicit host check before posting walk broadcasts.
- Align broadcast reaction options between the UI and database.
- Address the highest-risk existing access findings: billing acknowledgement fields, private profile preferences, realtime topic scope, and unnecessary privileged-function access.

## 2. Make guest RSVP feel complete without email

After a guest RSVPs, keep a compact receipt directly on the walk page:

- “You’re going” status
- Add to calendar
- Copy/share the walk
- Change RSVP
- “Create an account to keep this walk” as a secondary action

Store only a non-sensitive guest RSVP receipt ID locally—not their email. The public walk link remains their durable destination, and the calendar entry provides an additional reminder without adding email infrastructure.

## 3. Preserve the walk through account creation

- When signup starts from a walk, preserve the current walk URL and return there after authentication instead of sending the person to Home.
- Once signed in, securely match the new member’s verified account email to the guest RSVP’s existing email hash.
- Mark that guest RSVP as claimed and create/update the member RSVP, so the walk immediately appears as theirs.
- Remove the local guest receipt after a successful claim.

This uses the existing `claimed_user_id` field and auth flow; it does not introduce a new invitation or identity system.

## 4. Make sharing the natural completion of walk creation

After “Create walk,” show a lightweight success sheet using the existing share actions:

- Share
- Text
- Copy link
- Story card
- Add to calendar
- View walk

The user still lands on the same public walk page; this is presentation and sequencing, not a new workflow.

For V1, retain the existing generated Story card but make its action clearer: download/open the story image rather than implying direct posting to Instagram. Raster social images can remain a later compatibility improvement unless real-device testing shows broken previews.

## 5. Support neighborhood momentum with existing circles

Avoid building chat or automatic group creation. Instead:

- On a past walk/recap, show two clear next steps: “Plan this walk again” and “Keep walking together.”
- “Keep walking together” opens Circles with concise context and the existing invite/share surface.
- Keep circle membership opt-in and username-based for V1.
- From an existing circle, continue preselecting that circle when planning the next walk.

This gives neighborhood groups a path to persist without creating moderation, messaging, or invite-token infrastructure.

## 6. Finish the existing composer and interaction polish

- Keep the central composer; it is real and useful.
- Fix the silent no-op when its walk-note action is tapped before a walk is active.
- Correct its accessibility state and focus behavior.
- Share one tab configuration between mobile and desktop.
- Remove the unused legacy reflection FAB.
- Associate guest RSVP labels with their fields and make host controls work on touch, not hover only.
- Replace destructive browser confirmations only where they occur in the walk/circle launch path.

## 7. Validate the V1 launch scenario

Test this exact path on mobile and desktop:

1. New member creates a link-only and a public walk.
2. Host shares through native share, SMS, copy, and Story card.
3. Logged-out guest opens the link and RSVPs.
4. The page remembers and displays the guest’s RSVP without storing their email locally.
5. The guest adds the walk to their calendar and shares it onward.
6. The guest creates an account and returns to the same walk with the RSVP retained.
7. The host sees the private guest roster; other visitors do not.
8. Combined counts remain correct through RSVP changes and removals.
9. The recap leads cleanly to another walk or Circles.
10. A seeded 100-RSVP walk renders and updates without degraded interaction.

## Deferred to V1.5–2

- Confirmation and reminder emails
- Physical attendance/check-in and no-show metrics
- Full group chat or direct messaging
- Automatic attendee-to-circle enrollment
- Referral dashboards and funnel analytics
- Automated Instagram posting
- Advanced host tooling for very large events