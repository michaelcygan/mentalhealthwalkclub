# Pivot Plan — Mental Health Walk Club v2 (revised v5)

One viral loop, two surfaces for it:
1. **Personal**: post a walk → share a Partiful-style page → friends RSVP.
2. **Communal**: join a public **Group** with a standing walk → meet regulars near you.

Lo-fi, ambient, web-only, Stripe-only.

---

## Phase 1 — The Big Cut

Same as v4. Remove native shell, audio rooms, live walks, GPS tracking, facilitator, leaderboard, practices, route mosaics, etc. Keep `friend_walks`, `event_rsvps`, `/w/$code`, share-card, `profiles`, `user_roles`, `badges`, `walker_level`, `walk_sessions`, `walk_photos`, `walk-snapshots`, podcasts, ambient music, weather, journal, accelerometer step counter, guest-id.

---

## Phase 2 — The Walk Page (place-aware, gently social)

Leaflet + CARTO Voyager (no key), single hand-drawn pin. Cover photo from Wikimedia Commons by lat/lng, fallback gradient. Hourly weather strip with reschedule auto-suggest. Trail/park badge when near a saved trail. RSVP (going/maybe/can't) + avatar stack. Lightweight comments + emoji reactions. Going-RSVP mini chat via Supabase Realtime (48h purge). "Join the Club" CTA for logged-out viewers.

**Photos — present but quiet** (v4 framing kept):
- Soft camera FAB on the active-walk screen, no pulsing.
- Collapsible **Memory strip** on the walk page once 1+ photo exists; lightbox on tap; never dominates.
- **Attendees-only by default**; per-walk toggle to "Public on this walk page". Never on a global feed.
- No likes/counts publicly (uploader sees their own count). No face tagging. EXIF stripped server-side.
- One gentle 24h post-walk prompt to attendees who didn't upload, dismissible, never repeats.
- One-tap "Save this walk's memories" → zipped folder + one-page memento PDF (sentence summary, weather, who came).
- Optional soften-after-90-days per walk.

`friend_walks` gains: `meetup_lat`, `meetup_lng`, `meetup_label`, `cover_image_url`, `audience_mode`, `trail_id?`, `group_id?`, `photos_visibility`, `memory_softens_at?`. New tables: `walk_messages`, `walk_comments`, `walk_reactions`. `walk_photos` gains `attendee_only`.

---

## Phase 3 — Circles + Audience Controls

`circles` (owned, named, private) + `circle_members` + `friendships` (mutual). `walk_audience` modes: `public` / `friends` / `circles_allowlist` / `friends_except_blocklist` / `group` (new). RLS-only filtering; hidden walks 404 for excluded users.

---

## Phase 4 — Groups (back, but rebuilt for discovery + safety)

Brought back as the **communal** half of the viral loop. Two flavors share one table:

- **Private group**: friend-of-friend feel, invite-only. (Effectively a Circle with a standing walk attached — but lives in `groups` so the surface is consistent.)
- **Public group**: discoverable. Default surface is **local-only within a radius**; opt-in **global** for identity/topic groups ("Postpartum Walkers," "Sober Sunset Strolls," "Grief & Movement").

### Standing walks

Every group can attach a recurring meetup pattern (e.g. *Sundays 9am, Prospect Park West Entrance*). Server materializes the next 4 occurrences as `friend_walks` rows scoped to the group, so each one gets a real walk page, RSVPs, weather, photos, mini chat — same primitive as personal walks. Cancel-one and skip-week supported.

### Discovery & locality

- `/discover` shows public groups within ~25mi by default; toggle for **global** identity groups.
- Group cards show: name, one-line description, member count (rounded: 12, 40+, 120+), next walk time, neighborhood-level location (3-decimal geohash until the user joins), and a small photo from Wikimedia Commons of the meetup area.
- Logged-out viewers always see a "Join the Club" landing instead of the live feed.

### Safety + anti-spam (real, not theatre)

- **Hard 18+ floor** via DOB attestation at signup; only the age-band enum is queryable.
- **Group age policy** (host-set): `18+` (default), `21+`, `25+`, `40+`. RSVP/join gated by band; non-matching users see "this group is for ages 25+."
- **Host trust score** before "create public group" unlocks: requires verified email + at least 3 completed walks + 14 days since signup + no active safety reports. Until then, hosts can create **private** groups freely.
- **Public group review**: first public group from a new host enters a 24h soft-review queue (auto-approved if no admin flag); shown to user as "your group goes live within a day."
- **Rate limits**: 1 public group per user per 7 days for the first 30 days; 3/week after. Standing walks per group capped at 2/week to prevent flooding.
- **Profile-side display rules**: a user's hosted public groups appear on their profile only after the group has 3+ unique RSVPs from accounts >7 days old (kills empty/spam-shell groups).
- **Block + report** flow: blocking a host hides their groups from `/discover`, walk pages, and search. Reports route to existing `safety_reports`; 2 upheld reports auto-quarantine the group pending review.
- **No DMs in v1.** All conversation lives on a walk page (mini chat) or the group wall — public, accountable surfaces only. Cuts the most common harassment vector before it starts.
- **Location precision**: public group cards show neighborhood/geohash-3 until you RSVP "going"; only then do you see the exact meetup pin. Personal/private groups same rule.
- **Quiet abuse signal**: group is auto-hidden from discovery (not deleted) if it has 0 going-RSVPs across 3 consecutive standing walks AND <2 active members — silently kills bot-spawned groups without punishing legit slow starts.

### Places card (your idea, expanded)

Standing-walk meetup locations populate a **Places** card on the host's public profile *and* feed `/places`. So when a great organizer runs a standing Saturday walk at Inwood Hill Park, that park earns a tile with their group attached. Becomes a soft directory of meetup spots → drives both group discovery and trail/park exploration.

- Place tile shows: photo (Wikimedia Commons), neighborhood, 1-line OSM tag summary, "X groups meet here," "next walk here: Sat 9am."
- Tapping a Place shows the trail/park detail page + the groups meeting there + a "Start a walk here" CTA.

### Data shape

`groups (id, owner_id, name, slug, description, visibility, scope, age_band_min, radius_miles?, lat?, lng?, neighborhood, cover_image_url, status, trust_locked_until?, created_at)`
`group_memberships (group_id, user_id, role, status, joined_at)`
`group_standing_walks (id, group_id, day_of_week, start_local_time, timezone, meetup_lat, meetup_lng, meetup_label, trail_id?, active, created_at)`

`friend_walks.group_id` ties materialized instances back. RLS: members see all group walks; non-members see only `public` group walks within the discovery radius and respect age-band.

### Why this is safe-to-ship

The risk of public groups isn't the concept — it's frictionless creation, unmoderated DMs, exact-location leakage, and minor access. Each of those gets a concrete brake above. Net effect: discovery comes back, the viral loop gets a second engine, and the abuse surface stays narrower than what Meetup or Facebook Groups ship today.

---

## Phase 5 — Discovery feed + Parks & Trails

`/discover` becomes the unified surface:
- **Tonight near you**: public walks + group walks ≤25mi
- **Groups for you**: nearby public groups + opt-in global identity groups
- **Places**: parks/trails + meetup spots (from Phase 4 Places card)

Trails seeded from OSM Overpass (free, no key), `user_saved_trails` with drag-to-reorder, trail detail page with "Start a walk here" CTA.

---

## Phase 6 — Media (kept + leaned into)

Podcasts end-to-end. New `playlists`/`playlist_items` for curated ambient mixes around moods. `/listen` tab with three rails. Solo-walk pre-screen picks silence/ambient/podcast/playlist.

---

## Phase 7 — Solo Walks, Simplified

Drop map/distance/pace. Keep timer, ambient/podcast/playlist player, weather, mood, journal, accelerometer, soft camera FAB, post-walk reflection.

---

## Phase 8 — Merch v1

`merch_products` + admin UI at `/admin/merch` + Stripe + `merch_orders`. 2-3 SKUs to start, nonprofit collabs later.

---

## Phase 9 — Plus at $1.99/mo

**Free**: unlimited walks, RSVPs, comments, Memories, solo walks, basic playlists, podcasts, up to 3 Circles, up to 20 friends, 5 saved trails, **join up to 5 public groups**, **host up to 2 private groups**, journal 5 entries/mo.

**Plus** ($1.99/mo):
1. Unlimited Circles + audience precision (allow/block per walk).
2. Custom walk pages (palette + cover + hand-drawn pin style).
3. Unlimited journal entries with prompts library.
4. Plus playlists + guest-curated mixes.
5. Unlimited saved trails + private trail notes.
6. **Host unlimited groups (public + private)** + group cover customization + standing-walk recurrence beyond weekly (biweekly, monthly, seasonal).
7. Seasonal challenges + exclusive badges.
8. **Supporter badge** — **50% of every Plus dollar visibly funds the partner nonprofit** (shown on billing + `/impact`).

Reprice existing `plus_monthly` to $1.99. Gates via `has_active_subscription` + `usePlus()` + server-side `requirePlus`. Monthly server fn sums net Plus revenue, writes 50% to `impact_donations`.

---

## Phase 10 — Design

Serif headlines + handwritten accents. Film-grain/paper textures. **Charts retained** where they help self-tracking — profile sparkline, journal mood line, yearly heatmap, Plus seasonal progress ring — each paired with a plain-language sentence. No charts on the walk page. Drop decorative stat tiles. Slower transitions (300→500ms). Add dusty-rose accent + deeper moss for Places/trails surfaces.

---

## Build order

```text
1. The Big Cut
2. Circles + audience
3. Walk page v2
4. Groups + standing walks + Places card
5. Discovery + trails
6. Solo walks slim
7. Media + playlists
8. Plus retune + 50% impact
9. Merch
10. Design polish (continuous)
```

---

## Tech notes

Keyless APIs only: Wikimedia Commons, Open-Meteo, OSM Overpass, CARTO basemap. All new tables get RLS + GRANT. Audience filtering enforced in RLS, not UI. Standing walks materialized by a nightly server fn (next 4 occurrences per group) with idempotent inserts on `(group_id, occurs_at)`. Trust score computed in a security-definer fn. Memento PDF via `@react-pdf/renderer` (Worker-safe). Public route loaders use public server fns with `supabaseAdmin` scoped by share code/slug.
