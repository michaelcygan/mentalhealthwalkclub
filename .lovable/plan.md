# Wave 3 — Directional follows & public profiles

The V1 spec calls for **directional follows / mutuals** (replacing the current bidirectional-request "friendships" table) and profile pages that work for both signed-in and signed-out visitors. Today the app has:

- `friendships` table with `user_low / user_high / requested_by / status='pending|accepted|declined'` — symmetric handshake, wrong shape for V1.
- `/profile` route (self-only, editor). No public `/@username` page.
- `public_profiles` view (added in Wave 1) already exposing safe columns — unused so far.

## Goals

1. Replace friend handshake with **directional follows** — A follows B is one row; **mutual** = both rows exist.
2. Ship a **public `/@username` profile route** (SSR, shareable, indexable) that renders for signed-out visitors and shows a Follow button when signed in.
3. Rename self-profile URL from `/profile` → `/me` and keep a redirect.
4. Retire "friend request" UI copy in favor of Follow / Following / Followers / Mutuals.

## Data model

New table `public.follows`:

```
follower_id  uuid  → auth.users (the actor)
followee_id  uuid  → auth.users (the target)
created_at   timestamptz
PRIMARY KEY (follower_id, followee_id)
CHECK (follower_id <> followee_id)
```

RLS:
- `SELECT` — `authenticated` (anyone signed in can see who follows whom, needed for mutuals + follower lists).
- `INSERT` — `follower_id = auth.uid()` only.
- `DELETE` — same. No UPDATE.
- No `anon` grant; follower counts on the public profile page come from a `SECURITY DEFINER` counter function.

Helper SQL functions (all `SECURITY INVOKER` unless noted):
- `public.is_following(_follower uuid, _followee uuid) returns boolean`
- `public.is_mutual(_a uuid, _b uuid) returns boolean`
- `public.follow_counts(_user uuid) returns (followers int, following int, mutuals int)` — `SECURITY DEFINER` so counts render on public profile pages without granting `anon` broad read.

`friendships` table: leave in place, do NOT drop yet — read-only during Wave 3 so existing data isn't lost. A later wave can migrate accepted rows into two `follows` rows and drop the table.

## Server functions (`src/lib/follows.functions.ts` — new)

- `followUser({ userId })` — insert row; emit `follow` notification.
- `unfollowUser({ userId })` — delete row.
- `getFollowState({ userId })` — `{ iFollow, followsMe, mutual }`.
- `listFollowers({ userId, limit, cursor })` / `listFollowing({ userId, limit, cursor })` — paginated, join `profiles`.
- `listMutuals({ userId })` — used for "Walk with" suggestions.
- `getPublicProfileByUsername({ username })` — reads `public_profiles`; returns `null` on miss so the route can `throw notFound()`.

The old `sendFriendRequest / respondFriendRequest / removeFriendship / listFriends` server fns stay exported but delegate:
- `sendFriendRequest` → `followUser`
- `respondFriendRequest` → no-op (returns ok) — with directional follows there is nothing to accept.
- `removeFriendship` → `unfollowUser`
- `listFriends` → `listMutuals`
This keeps existing screens working while call sites migrate.

## Routes

New:
- `src/routes/u.$username.tsx` — public profile.
  - Loader calls `getPublicProfileByUsername` + `follow_counts` (server fn wrapper). `notFound()` on miss.
  - `head()` sets title/description/og:title/og:url/canonical + `og:image` when the profile has an avatar (absolute URL).
  - Renders: avatar, display name, `@username`, bio, city, follower / following / mutual counts, upcoming public walks they host (reads `public_events` filtered by `host_user_id`), and past hosted walks (public view only). For signed-in visitors: Follow / Unfollow button and mutual badge.
- `src/routes/_authenticated/me.tsx` — self editor, same content as the current `/profile` page.
- `src/routes/profile.tsx` — kept as a `beforeLoad` redirect to `/me` for old links / bookmarks.
- `src/routes/u.$username.followers.tsx`, `src/routes/u.$username.following.tsx` — paginated lists (authenticated view only; unauthenticated redirected through the public profile).

Rename references in the mobile tab bar, `more.tsx`, and any `Link to="/profile"` to `/me`.

## UI

- Replace the "Add friend / Accept / Decline" affordances in `circles.tsx` and any friend surfaces with a single **Follow** button that toggles to **Following** on hover ("Unfollow"). Mutual state gets a small "Walk buddy" chip.
- Notification kinds: keep `friend_request` in the DB (backwards compatible) and add `follow` and `mutual` kinds; new emits use the new kinds, old rows keep rendering.
- Copy sweep: "friends" → "mutuals" in headings; "requests" chip removed from Circles.

## Out of scope for this wave

- Backfilling `friendships → follows` (do later, once Wave 3 is stable in prod).
- Blocking / mute controls (they exist on the events audience side already).
- Discovery of accounts to follow — Wave 4 will bring "people you may know" once the follow graph has data.

## Verification

- Type-check clean after regen.
- Manual: sign-out visit to `/@ownusername` returns 200 with meta title/description/canonical set to the profile URL, avatar renders as `og:image`, no Follow button. Signed-in visit shows Follow, tapping toggles state and refetches counts.
- Manual: `/profile` redirects to `/me`. Old friend surfaces still render (via the delegated shims) without console errors.

## Deliverables

1. Migration: `follows` table + grants + RLS + helper functions.
2. `src/lib/follows.functions.ts` and updates to `src/lib/social.functions.ts` (delegations).
3. New routes `u.$username.tsx`, `_authenticated/me.tsx`, list routes; redirect route at `/profile`.
4. UI updates in `circles.tsx`, `more.tsx`, mobile tab bar, notification renderers.
5. No changes to unrelated flows (walks, journal, listen).
