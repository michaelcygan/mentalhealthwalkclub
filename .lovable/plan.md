# Logo + Brand Name Pass

Two related cleanups: drop in the new hand-drawn stamp logo wherever the current green Footprints icon appears, and update every user-facing string from "Walk Club" to "Mental Health Walk Club".

## 1. Add the logo as an asset

- Copy `user-uploads://MentalHealthWalkClub-Logo-Black.png` → `src/assets/logo-stamp.png` (used in React surfaces, ES6 import, gets bundled/optimized).
- Also copy to `public/logo-stamp.png` for the PWA manifest / Apple touch icon / OG image references that need a stable URL.

Approved overlay colors are black + white only. The source PNG is black-on-transparent, so:
- On cream / white surfaces (sidebar, mobile top bar, welcome dialog, auth page) → render as-is.
- On forest / dark surfaces (active walk hero, dark mode, share cards on dark) → render with `filter: invert(1)` to flip to white. Single source of truth, no second asset to maintain.

Create one tiny `<LogoStamp />` component in `src/components/logo-stamp.tsx` that takes `tone="dark" | "light"` and a `size` prop, so every surface uses the same component (avoids drift later).

## 2. Surfaces that get the new logo

Replace the existing `<Footprints>`-in-a-green-circle mark in:

- `src/routes/__root.tsx` — desktop sidebar header (line ~138) and the two mobile top-bar variants (lines ~193, ~206). Use `tone="dark"` (black on cream).
- `src/components/welcome-dialog.tsx` — header next to the title.
- `src/routes/auth.tsx` — sign-in/sign-up header.
- `src/routes/walk.active.$id.tsx` — small mark in the hero corner uses `tone="light"` (white on forest).

Other places that use `<Footprints>` as a generic icon (tab bar, empty states, stats) stay as Lucide icons — the logo is only for brand identity moments, not generic UI.

## 3. Rename "Walk Club" → "Mental Health Walk Club"

User-facing strings only. Replace in:

- `src/routes/__root.tsx` — sidebar wordmark, both mobile top-bar wordmarks, `apple-mobile-web-app-title` meta.
- `src/routes/auth.tsx` — already correct, no change.
- `src/routes/welcome.tsx` — page title + og:title.
- `src/routes/events.tsx`, `events.$slug.tsx`, `events.new.tsx` — page titles + descriptions + share text.
- `src/routes/groups.tsx`, `groups.$slug.tsx` — page titles + descriptions + share text.
- `src/routes/journal.tsx` — page title + share footer ("— shared from Mental Health Walk Club").
- `src/routes/profile.tsx`, `facilitate.tsx`, `index.tsx` — page titles.
- `src/components/guided-player.tsx` — MediaSession `artist` fallback.
- `src/components/walk-talk-dock.tsx` — MediaSession `album`.
- `public/manifest.webmanifest` — `short_name` becomes `"Mental Health Walk Club"` (it's long, but it's the actual brand; iOS will truncate gracefully on the home screen).

Mobile top bar layout note: the wordmark currently sits next to the brand mark with `text-sm`. "Mental Health Walk Club" is ~3× longer than "Walk Club" and will crowd the InboxBell + ModeToggle on a 390px viewport. Fix by:
- dropping the wordmark text on mobile top bar (logo alone identifies the brand — the stamp already says "Mental Health Walk Club" inside it), OR
- keeping it but switching to `text-[11px] tracking-tight` and removing the brand circle so the logo + name read as one unit.

Going with **logo-only on mobile top bar**, **logo + full name on desktop sidebar** (sidebar has 240px of room). Cleaner and avoids the truncation problem entirely.

## 4. Out of scope

- No new colors / no theme tokens added — black + white overlays are already covered by existing `foreground` / `primary-foreground`.
- Not regenerating PWA icons (`public/icon-192.png`, `public/icon-512.png`) in this pass — those are the abstract green mark and still work as installable-app icons. Can swap to the stamp in a follow-up if you'd like the stamp on the iOS home screen too. (Quick call-out: tell me if you want that and I'll regenerate them with the new mark on a cream background.)
- No changes to backend, routes, data, or migrations.

## Files touched

- new: `src/assets/logo-stamp.png`, `public/logo-stamp.png`, `src/components/logo-stamp.tsx`
- edited: `src/routes/__root.tsx`, `src/routes/welcome.tsx`, `src/routes/events.tsx`, `src/routes/events.$slug.tsx`, `src/routes/events.new.tsx`, `src/routes/groups.tsx`, `src/routes/groups.$slug.tsx`, `src/routes/journal.tsx`, `src/routes/profile.tsx`, `src/routes/facilitate.tsx`, `src/routes/index.tsx`, `src/routes/walk.active.$id.tsx`, `src/components/welcome-dialog.tsx`, `src/components/guided-player.tsx`, `src/components/walk-talk-dock.tsx`, `public/manifest.webmanifest`
