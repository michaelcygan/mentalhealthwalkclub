# IA refactor: More tab + Settings, slimmer Profile

## Why
The Profile page is doing three jobs at once: (1) it's your identity card, (2) it's a directory of every other section (Discover, Listen, Circles, Shop, host Places, saved Trails), and (3) it's the Settings drawer (name/bio/location, safety, admin, sign out, delete). That's heavy for a tab and makes Profile feel like a junk drawer.

For v1 of Mental Health Walk Club, the cleanest split is:
- **More** = navigation hub + account utilities (replaces the Profile tab)
- **Profile** = who you are + what you've done (your "page")
- **Settings** = how the app behaves + account safety

This also frees the 4th tab slot for a true "everything else" hub — which is where 2026 mobile IA is trending (Instagram, Threads, Strava all collapse secondary destinations behind a hub rather than competing for a tab).

## Tab bar after
Home · Discover · Journal · **More** (4 tabs, unchanged count)

Icon: `Menu` (or `Grid2x2`/`LayoutGrid`) from lucide. Active pill behavior carries over from the current pill island.

## /more — new route
A short, scannable hub. Mobile-first single column, ~3 sections.

1. **Profile mini-card** (tappable → `/profile`)
   - Avatar (or initials), display name, `Supporter` chip if Plus
   - Sub-line: city · "Walker since {Mon YYYY}"
   - Chevron right
2. **Explore** (link rows, same visual language as today's profile rows)
   - Listen — Podcasts & playlists
   - Circles & friends
   - Events
   - Shop — Merch
   - Impact (only if Plus, or always with "Learn more")
3. **Account**
   - Settings → `/settings`
   - Help & safety (jumps to Settings → Safety section)
   - Admin · Podcasts (admins only)
   - Sign out

No stats, no badges, no goal editing, no host-places, no saved-trails on /more. Those belong on /profile.

## /profile — slimmed to the identity page
Keep it focused on "this is me and my walking life". Order:

1. Identity card: avatar, name, "hello again" handwriting, city, Supporter chip, **Edit profile** pill (top-right, opens a small sheet for name / bio / location / privacy — same controls that currently live in the Settings drawer, but scoped to *profile fields* only)
2. 3-stat row: walks · time · miles (already there)
3. Week streak ribbon (already there)
4. Weekly sparkline
5. Walk Club stats (hosted/attended/streak)
6. Badge wall
7. Weekly goal
8. Billing card (Plus state)
9. Where you host (host places)
10. Your trails (saved trails)

Remove from /profile: the Discover / Listen / Circles / Shop link rows (they live on /more), the Settings & safety button (lives on /more → Settings), Sign out, Delete account, Safety panel (all migrate to /settings).

## /settings — new route
Single scrollable page (not a bottom sheet). Sections:

1. **Account**
   - Display name, location, bio, privacy toggle (`is_private`)
   - Email (read-only, from auth)
2. **Membership**
   - Plus status, manage billing → Stripe portal (reuse BillingCard, or a compact row)
   - Impact link (if Plus)
3. **Notifications** *(v1 scaffold — toggles for: walk reminders, friend RSVPs, weekly recap email; persists to a new `notification_prefs` jsonb on profiles or a dedicated table; safe to ship even if some toggles are not wired to a sender yet — they capture intent)*
4. **Appearance** *(v1: theme — system / light / dark; reuse if a theme provider exists, otherwise persist preference only)*
5. **Connected accounts** *(only render if relevant integrations exist — e.g. Spotify/Apple ambient picker; otherwise omit)*
6. **Privacy & data**
   - Privacy policy → `/privacy`
   - Terms → `/terms`
   - Download my data *(stub button "coming soon" or hide for v1 — to be decided)*
7. **Safety & support**
   - Crisis copy + 988 link (moved from Profile settings sheet)
8. **Admin** (admins only) — link to `/admin/podcasts`, `/admin/merch`, `/admin`
9. **Sign out** button
10. **Delete account** (destructive, with the same double-confirm flow)

## Files & changes (technical)
- `src/components/mobile-tab-bar.tsx` — swap the 4th tab: `{ to: "/more", label: "More", icon: Menu }`. Update desktop sidebar `TABS` in `src/routes/__root.tsx` the same way.
- `src/routes/more.tsx` — new file. Pulls display_name/avatar/city via the same `profiles` query used today; renders the mini-card + Explore + Account sections; owns Sign out.
- `src/routes/profile.tsx` — remove Discover/Listen/Circles/Shop rows, remove the settings sheet + safety + admin + sign out + delete. Add a small "Edit profile" sheet that only edits `display_name`, `location`, `bio`, `is_private`. Keep stats, sparkline, WalkClubStats, BadgeWall, goal, BillingCard, host places, saved trails.
- `src/routes/settings.tsx` — new file. Account form, Membership (BillingCard), Notifications scaffold, Appearance, Connected (conditional), Privacy & data, Safety, Admin (conditional), Sign out, Delete account. Reuse `LocationAutosuggest`, `deleteMyAccount`, `useSubscription`, `useAuth`.
- Optional: extract a shared `AccountFieldsForm` component so /profile's edit sheet and /settings → Account use the same controls.
- No DB migration required for v1; notification prefs can be a `localStorage` placeholder for the first ship if we want to avoid a schema change. (Open question below.)

## Out of scope for this pass
- New notification *delivery* (we'd only persist toggle state).
- Theme system if one doesn't already exist — Appearance section becomes "coming soon" or is omitted.
- Reworking Discover / Journal / Home content.

## Open questions
1. **Notifications in v1**: ship the toggles UI now with `localStorage` persistence, or wait until we wire actual senders? I'd lean ship-the-UI so the IA feels complete.
2. **Edit profile**: keep it as a sheet on /profile *and* mirror in /settings → Account, or single source of truth in /settings and remove the sheet from /profile? My recommendation: keep the lightweight sheet on /profile (people expect to tap their own name to edit) and have /settings → Account be the canonical form.
3. **Events** on /more: include now or wait until the Events surface is more fleshed out?
