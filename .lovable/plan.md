## Problem

The global `EligibilityGate` in `src/routes/__root.tsx` hard-redirects every signed-in user whose status isn't `adult_active` to `/confirm-age`, including when they're just browsing the homepage or other public surfaces. DOB collection should happen at signup — not as a wall in front of general browsing.

## Approach

Make age confirmation an **action-time gate**, not a **navigation-time gate**. DOB is still collected during signup (already wired in `auth-form.tsx`), and server-side triggers + the existing `useIsAdultActive` client preflights still block adult actions (RSVP, follow, join group, create walk, publish, etc.). We just stop redirecting people who are only browsing.

## Changes

1. **`src/routes/__root.tsx`** — Remove the auto-redirect inside `EligibilityGate`. Keep the component as a lightweight wrapper (or delete it entirely and render `<AppFrame>` directly). The `/confirm-age` route stays reachable via preflight toasts' deep-link and via a soft prompt.

2. **Soft prompt for signed-in, non-adult-active users** — Add a small dismissible banner (top of `AppFrame`, only when `user && eligibility.eligibilityStatus !== "adult_active"`) that says "Confirm your age to RSVP, follow, and join groups" with a link to `/confirm-age`. No forced redirect.

3. **Keep everything else intact**:
   - Signup DOB collection in `auth-form.tsx` — unchanged.
   - Server triggers enforcing adult-only writes — unchanged.
   - `useIsAdultActive` client preflights on RSVP / follow / join — unchanged (they already deep-link to `/confirm-age` on failure).
   - `/confirm-age` route — unchanged, still works when reached via preflight or banner.

## Result

- Anonymous visitors: no change (were never gated).
- New signups: DOB captured at signup as today.
- Legacy signed-in users without DOB: can browse freely; get a soft banner and are prompted only when they try an adult action.

## Out of scope

No DB/migration changes. No changes to admin DOB correction, preflight hooks, or safety triggers.
