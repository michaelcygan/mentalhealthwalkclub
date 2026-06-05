## Compose FAB — global mount + audit

### Move the FAB out of Home

Remove `<HomeComposeFab />` from `src/routes/index.tsx` and mount it once globally inside `src/routes/__root.tsx`, alongside `<TabBar />`. This way it persists across every route by default and we gate visibility from one place.

### Visibility rules (one helper inside the FAB)

The FAB returns `null` when:
- user is not authenticated, OR
- the current pathname matches any of:
  - `/walk` (active walk)
  - `/auth`, `/welcome`
  - `/events/$slug` (e.g. `/events/something` — present but not exactly `/events`)
  - `/listen/$id`
  - `/admin` or `/admin/...`
  - `/w/...`
  - `/privacy`, `/terms`
  - `/shop/return`

Otherwise it renders. That covers Home, Discover, Journal, Profile, Groups, Places, Trails, Listen (index), Circles, Events list, Impact, Shop, and any nested rails.

Implementation: a small `useRouterState({ select: s => s.location.pathname })` lookup at the top of `HomeComposeFab`, plus `useAuth()` for the auth gate. No prop drilling.

### Icon swap

- Closed: `Footprints` from lucide-react (replaces `Plus`).
- Open: `X` (unchanged).
- Same 56px circle, same forest background, same calm transition.

### Positioning sanity check

- Mobile: stays bottom-right, `bottom: calc(env(safe-area-inset-bottom) + 72px)` to clear the tab bar.
- Desktop: tab bar is hidden (`md:hidden`), so the +72px offset leaves a comfortable gap from the viewport edge. Confirmed visually with the current placement.
- The expanded action labels ("Walk solo" / "Plan a walk") right-align so they don't collide with the sidebar.

### Out of scope

- No route changes, no new pages, no Plan-a-walk creation flow (still routes to `/events` placeholder per current behavior).
- No icon library additions — `Footprints` is already imported elsewhere.
- No changes to FAB animation timing or styling beyond the icon swap.

### Files touched

1. `src/components/home-compose-fab.tsx` — add auth + path gate, swap Plus → Footprints.
2. `src/routes/__root.tsx` — import and mount `<HomeComposeFab />` once inside `TabBar` (or right alongside `<MobileTabBar />`).
3. `src/routes/index.tsx` — remove the local mount and the now-unused import.

### Verification

After the edit, walk through: `/`, `/discover`, `/journal`, `/profile`, `/groups`, `/places`, `/trails`, `/listen`, `/shop`, `/impact` — FAB visible on all. Then `/walk`, `/auth`, `/events/some-slug`, `/admin` — FAB hidden.