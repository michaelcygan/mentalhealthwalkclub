## Wave 4 — Groups as the V1 social container

Wave 3 gave every walker a shareable public identity. Wave 4 gives them a shareable place to gather. Groups replace Circles for V1: public, discoverable, hostable, joinable — the ongoing home for a neighborhood, campus, or community.

### Scope

**In:** public group pages, group discovery, join/leave, hosted walks scoped to a group, group roles (owner/mod/member), SEO metadata on group pages, retiring Circles from the visible app.

**Out (later waves):** group chat/threads, group announcements beyond hosted walks, paid/private groups, Radio, Blog, badges polish, journal polish.

### Deliverables

1. **Public group page** at `/g/$slug`
   - SEO head (title/description/og:title/og:description, canonical, og:image only when the group has a real cover URL).
   - Server-loaded via a public server fn behind the `SUPABASE_PUBLISHABLE_KEY` client and a narrow `TO anon` SELECT policy on a `public_groups` view (safe columns only: id, slug, name, tagline, cover_url, city, member_count, created_at).
   - Renders: header + cover, tagline, member count, upcoming walks hosted by the group (reusing `WalkCard`), and a small "recent members" strip (avatar + username → `/u/$username`).
   - Signed-out: "Join to walk with them" CTA opens auth prompt with return URL back to the group page.
   - Signed-in non-member: "Join" primary action (optimistic). Member: "Joined" with menu to Leave. Owner/mod: "Manage" link into the authed surface.

2. **Groups discovery** at `/groups` (public)
   - Public server fn `listPublicGroups({ city?, q?, limit })` reading `public_groups`.
   - Grid of group cards; empty state pitches "Start a group" (auth-gated).
   - Head metadata + a single H1.

3. **Authed surfaces**
   - `/_authenticated/groups.new` — create form (name, slug preview, tagline, city, cover). Slug uniqueness enforced server-side; auto-generated from name with collision suffix.
   - `/_authenticated/groups.$slug.manage` — owner/mod only. Edit basics, promote/demote mods, remove members.
   - Rename existing authed `/circles` → keep the route file but redirect to `/groups`; the "My groups" list surfaces on the existing profile/more surface.

4. **Walks ↔ Groups**
   - Reuse existing `events.group_id` column. `walk.new` gains an optional "Post to a group" selector populated from `listMyGroups()` (memberships).
   - Public walk cards already surface their group; add a subtle "in {Group}" chip that links to `/g/$slug` when present.

5. **Retire Circles from V1 visible surface**
   - Remove Circles from mobile tab bar / more page.
   - `/circles` route stays as a redirect to `/groups` so old links don't 404.
   - `event_circle_allowlist` + `circles` tables stay in the DB (frozen) — not dropped in this wave to avoid destabilizing existing events with allowlists. A later cleanup wave handles it.

6. **Notifications**
   - Extend `notification_kind` with `group_join` and `group_walk_posted`.
   - Fire `group_join` to group owner when someone joins (rate-limited: at most one per user per group).
   - Fire `group_walk_posted` to members when a walk is posted to their group.

### Data model additions

- `public.groups` — already exists. Ensure columns: `slug` (unique, citext or lower-cased text), `name`, `tagline`, `cover_url`, `city`, `member_count` (maintained by trigger), `owner_id`, `created_at`, `updated_at`. Add missing pieces via migration only if absent.
- `public.group_memberships` — already exists with `role` (owner/mod/member) and `status`. Add trigger `tg_group_member_count` to keep `groups.member_count` in sync on insert/update/delete when `status='active'`.
- `public.public_groups` view — `SELECT id, slug, name, tagline, cover_url, city, member_count, created_at FROM public.groups WHERE visibility = 'public'`. Grant `SELECT` to `anon` and `authenticated`.
- RLS on `groups`:
  - Public SELECT via the view (no direct `anon` grant on the base table).
  - `authenticated` SELECT: own + public.
  - INSERT: `authenticated`, `owner_id = auth.uid()`.
  - UPDATE/DELETE: `owner_id = auth.uid()` OR `has_group_role(auth.uid(), id, 'mod'|'owner')` via a security-definer function.
- Owner-visible reads: any hidden/private state must have an owner-scoped SELECT policy in the same migration (per public-schema-grants rule).
- Slug uniqueness: `UNIQUE (lower(slug))`.

### Server functions

- **Public (no auth):** `getPublicGroupBySlug({ slug })`, `listPublicGroups({ q?, city?, limit? })`. Both use the server publishable client with the `sb_` fetch shim already used in `follows.functions.ts`.
- **Authed:** `joinGroup({ groupId })`, `leaveGroup({ groupId })`, `getMyMembership({ groupId })`, `listMyGroups()`, `createGroup({ name, tagline?, city?, cover_url? })`, `updateGroup({ id, ... })`, `listGroupMembers({ groupId, limit })`, `setMemberRole({ groupId, userId, role })`, `removeMember({ groupId, userId })`.
- All authed fns use `requireSupabaseAuth`; role checks call a `has_group_role` security-definer function to avoid RLS recursion.

### Verification

- Type check (tsgo) clean after each migration + code batch.
- Manual: signed-out `/g/$slug` renders with SEO head; `/groups` lists; join → optimistic UI + member_count increments; post walk to group → visible on group page; leave → decrements; `/circles` redirects.
- Linter (supabase--linter) run after the migration; fix flagged items before finishing the wave.

### Order of operations

1. Migration: `public_groups` view, `has_group_role`, member-count trigger, slug uniqueness, `group_join` + `group_walk_posted` notification kinds, RLS additions/updates, GRANTs.
2. Public server fns + `/g/$slug` + `/groups` routes.
3. Authed server fns + `/_authenticated/groups.new` + `/_authenticated/groups.$slug.manage`.
4. Wire `walk.new` group selector + public walk cards' group chip.
5. Retire Circles from visible nav; add `/circles` → `/groups` redirect.
6. Notifications wiring for join + walk-posted.

### Not doing this wave

- Radio (Wave 5), SEO blog (Wave 6), badges/journal polish (Wave 7).
- Group chat, invites-by-link, private/paid groups.
- Dropping legacy `circles` / `event_circle_allowlist` tables.

Approve and I'll start with the migration.