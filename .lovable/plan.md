# Logged-out experience: home page + welcome modal

## Goal

Anyone who lands on the URL sees the actual app — a warm, inviting Walk home page — not a sterile login wall. A welcome dialog overlays the page on first visit explaining the model, with a clear path to sign up. Every meaningful action (Start Walk, Join Group, RSVP, Join Audio Walk) gracefully funnels logged-out visitors into account creation.

## What changes

### 1. Stop redirecting logged-out users to /auth

Currently `__root.tsx` force-redirects unauthenticated users to `/auth`. Remove that. Instead:

- Logged-out users see the full app shell (sidebar / tab bar) and can browse.
- `/auth` and `/welcome` keep their existing standalone layouts.

### 2. Public-friendly home page (`/`)

The Walk tab becomes the public landing. For logged-out visitors:

- Hero with the existing imagery + tagline ("Take the walk. Let it count.")
- Primary CTA "Start a mental health walk" → opens auth modal (signup mode)
- Secondary CTA "How it works" → opens welcome modal
- Below the hero, three calm value cards: *Walk solo*, *Audio walks (only while moving)*, *IRL community walks* — short, emotionally warm copy.
- "This week" stats card replaced with "What walkers say" / mission line for logged-out state.
- Quick action grid still visible but each tile triggers the auth modal instead of starting a walk.

For logged-in users: unchanged behavior (start-walk flow + weekly minutes).

### 3. Welcome / marketing modal

A new `<WelcomeDialog>` (shadcn Dialog) component shown:

- Automatically once on first visit (gated by a `localStorage` flag `wc_seen_welcome=1`)
- On demand from a "How it works" button in the header / hero / footer
- After auto-open, dismissable; never re-opens automatically

Contents (3 short panels in a single dialog, no carousel needed):

1. **What this is** — peer-supported walking, not therapy. 988 callout.
2. **How it works** — Walk solo, join an IRL walk, or step into a live audio walk *only once you're actually moving*. Groups are quiet affinity tags, not feeds.
3. **Privacy** — Your walks, moods, and reflections stay private to you.

Footer of dialog: "Create your account" (primary, opens auth modal in signup mode) and "I already have one" (signin mode).

### 4. Auth modal (replaces full-page redirect for funnel actions)

Convert the existing `/auth` page into a reusable `<AuthDialog>` component, while keeping `/auth` as a standalone route fallback (deep links, password reset later). Triggered by:

- Welcome dialog CTAs
- Any "Start walk" CTA when logged out
- Group "Join", Event "RSVP", Audio room "Join", Profile, Journal nav clicks (intercepted at the action layer)

After successful signup → close modal → navigate to `/welcome` (the existing 4-step onboarding) → then return to `/`. After successful signin → close modal, stay on current page.

### 5. Gentle gating across the app

Instead of redirecting protected pages, render them with a soft prompt for logged-out users:

- `/groups`, `/events`, `/events/$slug`, `/groups/$slug`: readable (already public RLS), but Join / RSVP buttons trigger the auth modal.
- `/journal`, `/profile`: show a friendly empty state with a "Create your account to start your journal" CTA opening the auth modal.
- `/walk/active/$id`: requires a session — if not logged in, redirect to `/`.

### 6. Sidebar / tab bar for logged-out

Keep the same nav visible (so visitors can explore Groups & Events to feel the product), but add a small "Sign in" pill at the top of the sidebar / a sign-in icon in the mobile bar. Logged-in users see no change.

## Technical notes

- New file `src/components/welcome-dialog.tsx` — shadcn Dialog, controlled via a tiny `useWelcome()` hook backed by `localStorage`.
- New file `src/components/auth-dialog.tsx` — extracts the existing form from `src/routes/auth.tsx`. Both the route and the dialog import this shared form. Accepts `defaultMode` and `onSuccess` props.
- New file `src/lib/auth-prompt.tsx` — a context exposing `requireAuth(action: () => void)` so any button can wrap its handler: if user is signed in, runs the action; if not, opens the auth dialog and runs the action after success.
- `src/routes/__root.tsx`:
  - Remove the `if (!user) window.location.replace("/auth")` block.
  - Always render the shell. Add `<WelcomeDialog />` and `<AuthDialog />` mounted globally, controlled by the new context/provider.
  - Add a "Sign in" pill in the sidebar header for logged-out users.
- `src/routes/index.tsx`:
  - Branch on `user`. Logged-out variant renders the marketing hero + value cards + "How it works" trigger.
  - All start-walk handlers route through `requireAuth(...)`.
- `src/routes/groups.tsx`, `src/routes/events.tsx`, `src/routes/events.$slug.tsx`, `src/routes/groups.$slug.tsx`: wrap action buttons in `requireAuth(...)`.
- `src/routes/journal.tsx`, `src/routes/profile.tsx`: render a logged-out empty state with a CTA that opens the auth dialog.
- `src/routes/walk.active.$id.tsx`: if no user, redirect to `/`.
- Welcome modal first-open flag uses `localStorage`, guarded by `typeof window !== "undefined"` for SSR safety.

## Out of scope

- Real Google/Apple sign-in buttons (still email/password only).
- Server-side rendering of personalization (keep public home identical for everyone for now).
- Saving the intercepted action (e.g. resuming an RSVP after signup) — for v1 we just close the modal and let the user click again. Can be added later.
