## Goal
Make walk-page photos ("Memory strip") privacy-gated: only visible to walkers who actually joined (RSVP'd / host / group member). Logged-out and non-RSVP'd viewers see a gated placeholder instead of images.

## Current behavior
- `getEventPhotos` (in `src/lib/walk-page.functions.ts`) currently returns photos to ANY authenticated viewer when the event is `public` or `link_only`. That's too permissive.
- The client (`src/components/walk-page/memory-strip.tsx`) skips fetching when logged-out and shows a generic "No memories yet" empty state, giving no signal that memories exist or that RSVP unlocks them.

## Changes

### 1. Tighten server access (`src/lib/walk-page.functions.ts`)
Rework `getEventPhotos` so access requires one of:
- host of the event, OR
- active member of the event's group (if group-scoped), OR
- has an RSVP row for this event

Public/link_only alone no longer grants photo access. Return shape becomes `{ photos, access: "member" | "gated", photoCount }` so the client can render a gated state that tells the truth about whether photos exist without exposing them.

Also add a lightweight public count helper (or fold into the above via an unauthenticated branch) so logged-out viewers can see "N memories — join the walk to view".

### 2. Add logged-out / non-RSVP gated state (`src/components/walk-page/memory-strip.tsx`)
- Logged out: render the Memory Strip section with a locked card:
  - Title: "Memories from this walk"
  - Body: "Photos here are for members who joined the walk."
  - Buttons: "Log in" and "Create account" (route to `/auth` with return URL preserved)
  - Never render any `<img>` or signed URL. Do not call the photos endpoint.
- Logged in, but not host / group member / RSVP'd: same locked card, swap CTA to "RSVP to view memories" (link to the RSVP action / event page anchor). No image tags rendered.
- Logged in and allowed: current behavior (fetch + render strip + camera FAB).
- Hide the floating camera FAB unless the viewer is allowed (member/host/group).

### 3. Fetching
- Skip the server call entirely for logged-out and non-allowed viewers to avoid 401 noise; rely on the RSVP/host/group signals already present on the walk page (`event.viewerRsvp` / host id / group membership) — pass an `allowed` prop into `MemoryStrip` from `src/routes/w.$code.tsx`, which already knows the viewer's RSVP state.

## Technical details
- No schema changes.
- Keep signed URL TTL as-is; they're only minted for allowed callers now.
- `EventPhoto.url` is never sent to unauthorized callers, so no risk of leaked signed URLs in network responses.
- Route `src/routes/w.$code.tsx`: pass `viewerAllowed` boolean into `<MemoryStrip>` based on existing loader data (host === viewer, group membership, RSVP present).

## Out of scope
- Photo captions/comments, per-photo privacy toggles, or blurred previews. Gated state is a plain card, no blurred thumbnails.
