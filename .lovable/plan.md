# Make Groups open as a popup, not a full page

Right now `/groups/$slug` is a separate route that fully replaces the Groups tab. The URL changes but the visual transition is heavy and the list context is lost. Convert it into a **bottom sheet on mobile / right-side sheet on desktop** overlaid on the groups list — URL-driven so links still work, but feels light and dismissable.

## Approach: layout route + Outlet-in-Sheet

Use TanStack's nested layout pattern so the list stays mounted underneath the sheet. No new data fetching, no duplicated code — just restructure the existing two route files.

### File changes

1. **Rename** `src/routes/groups.tsx` → `src/routes/groups.index.tsx`
   (the existing list component, unchanged).

2. **Create** new `src/routes/groups.tsx` as a thin layout route:
   - Renders `<Outlet />` always.
   - Wraps the outlet in a shadcn `<Sheet>` whose `open` is `true` whenever a child route is matched (i.e. when on `/groups/$slug`).
   - `onOpenChange(false)` → `navigate({ to: "/groups" })`.
   - On mobile (<md): `side="bottom"`, rounded-top, max-height 92vh, internal scroll. On md+: `side="right"`, width ~520px.
   - Detect "child active" via `useMatches()` — if any match has `routeId === "/groups/$slug"`, the sheet is open.

3. **Edit** `src/routes/groups.$slug.tsx`:
   - Remove the outer `<Link>← All groups</Link>` and the page-level `pb-24` / mobile sticky-CTA block (the sheet handles dismissal and the CTA can sit inline at the bottom of the sheet body instead).
   - Trim the header padding slightly (`p-5` instead of `p-6 md:p-7`) so it reads as panel content, not a hero page.
   - Everything else (pulse, milestones, events, rooms, kudos, welcome) stays identical — same hooks, same server-fn calls.

4. **Edit** `src/components/group-card.tsx`: no functional change needed — the existing `<Link to="/groups/$slug">` will just trigger the parent layout's sheet to open via the route match. Confirm the link still works.

### Why this is light

- Zero new data fetching. The detail still loads from the same `useEffect` and server fns.
- No new components — reuses shadcn `Sheet`.
- The list stays mounted, so closing the sheet is instant and scroll position is preserved.
- Deep links (`/groups/chicago`) still work: layout route mounts → renders list + open sheet with detail.
- Back button closes the sheet naturally (it's a real route pop).

### Visual polish (small)

- Sheet `<SheetContent>` uses `bg-background` with the existing themed gradient from the detail header bleeding into the top.
- Add a subtle drag handle bar on mobile (`h-1 w-10 rounded-full bg-border mx-auto mt-2`).
- `SheetTitle` is the group name (visually hidden — the themed header already shows it large).

## Out of scope

- No changes to data, RLS, server functions, or the Groups list itself.
- Not removing the route — the URL contract stays the same.
