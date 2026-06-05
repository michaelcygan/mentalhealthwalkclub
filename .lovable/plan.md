## Tab-bar renovation: 5 → 4 tabs, FAB for compose

Lightest-touch pass. No new routes, no schema, no business logic.

### New tab bar

```
Home · Discover · Journal · Profile
```

- **Home** (`/`) — renamed from "Walk". Same route file. Daily landing: weather strip, streak, "what's next" RSVP card, today's reflection nudge. Active-walk banner pinned to top when a session is running.
- **Discover** (`/discover`) — new tab. Already absorbs the old `/events` purpose via its "Tonight near you" rail.
- **Journal** (`/journal`) — unchanged.
- **Profile** (`/profile`) — unchanged.

`/events`, `/walk`, `/listen`, `/groups`, `/places`, `/trails`, `/impact`, `/shop` all stay reachable as deep links — only their tab-bar slot changes.

### Compose FAB on Home

A single floating action button bottom-right (above the tab bar, respecting `env(safe-area-inset-bottom)`). Tap to expand into two options:

- **Start solo walk** → triggers the existing solo-walk flow on `/` (the pre-screen audio picker + start).
- **Plan a walk** → routes to the existing "create event" flow (whatever `/` currently uses for the link/group walk path).

Component lives at `src/components/home-compose-fab.tsx` (new). Uses a `Popover` or simple animated `div` — no new deps. Icon: `Plus` collapsed, rotates to `X` when open. Hidden when an active walk banner is showing (no double CTA).

### Files touched

1. **`src/components/mobile-tab-bar.tsx`** — 4 tabs, swap order/labels:
   - `Home` (Footprints icon, `/`, exact)
   - `Discover` (Compass icon, `/discover`)
   - `Journal` (BookHeart icon, `/journal`)
   - `Profile` (UserIcon, `/profile`)
   - Grid stays `grid-cols-4`.

2. **`src/components/home-compose-fab.tsx`** *(new)* — the FAB + expand-to-two-actions UI.

3. **`src/routes/index.tsx`** — mount `<HomeComposeFab />`. Audit existing inline "Start solo" / "Plan a walk" CTAs: if they were the page's primary buttons, demote them to inline secondary affordances (or remove if the FAB fully replaces them — I'll decide based on what's on the page today and note it before editing).

### Out of scope

- No changes to `/events`, `/walk`, or any walk-creation logic — the FAB just routes to existing flows.
- No desktop nav changes unless `__root.tsx` has a top nav that lists the old "Walks" tab (quick audit; only edit if present).
- No icon library additions — `Compass` and `Plus` are already in lucide-react.

### Verification

After the edit: load `/` on mobile viewport, confirm 4 tabs render, FAB expands, both actions route correctly, active-walk banner suppresses the FAB.