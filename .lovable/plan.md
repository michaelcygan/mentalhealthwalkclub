
# Plan a walk — end-to-end flow

A lofi-Partiful flow: pick a place, set a time, choose who it's for, share a link, watch the page come alive as people RSVP. Logged-out friends can join with name + email. Hosts broadcast updates. After the walk, an auto-recap card invites resharing.

The existing `events` table + `event_rsvps` already covers most of the data model — we extend rather than rebuild.

## 1. Compose flow — `/walk/new`

A single, calm screen (mobile-first, no multi-step wizard) with these blocks:

- **Where** — Google Places autocomplete (cached). Picking a place stores `place_id`, name, address, lat/lng, and a category hint (park / neighborhood / trail / city / cafe). Triggers background lookup for a hero image (see §2).
- **When** — date + start time. Default: tomorrow, 5:00pm local. Optional end time. Timezone auto-detected from place coords.
- **Vibe** — short text ("easy 30 min loop", "quiet, no phones"). Optional.
- **Who it's for** — three audience modes:
  - **Open** — anyone with the link can RSVP; appears in Discover. (`visibility = public`)
  - **Group walk** — attached to a Group or Circle the host belongs to. Members see it in their group feed; the share link still works, but RSVPs from non-members are flagged "guest of {host}". Host picks the group/circle from a dropdown of their memberships. (`visibility = group`, with `group_id` or `circle_id`)
  - **Link only** — unlisted; only people with the link can see or RSVP. Not in Discover, not in any group feed. (`visibility = link_only`, default)
- **Cover photo** — auto-suggested from §2, host can swap or upload.
- **Pace / distance / dog-friendly / kid-friendly** — small chips, all optional.

CTA: "Create walk" → routes to `/w/$code`. Host immediately sees a share sheet (copy link, IG story card, iMessage, WhatsApp, native share).

## 2. Location enrichment (cached)

For each unique `place_id` we cache one row in a new `places` table:

- Google Places search via the existing connector (server fn, gateway-cached).
- For parks / neighborhoods / cities / trails: query Wikipedia/Wikimedia Commons by place name + region for a lead image and a one-sentence description.
- Fallback to a Google Places photo, then a procedural lofi gradient (we already have `city-procedural.ts`).
- Cache hero photo URL, attribution, short blurb, and a static OSM map snippet.

Most popular spots load instantly with a beautiful editorial cover; we pay the lookup cost once.

## 3. Shareable invite page — `/w/$code`

Public route, SSR-rendered, OG tags from loader data so IG / iMessage / Discord previews look great. Layout, top to bottom:

- **Hero**: cover photo with soft lofi grain; weather pill for the start time (sunny 68°, light rain at 5pm); subtle parallax on landscape covers, a gentle rain animation if the forecast is wet, a warm sun-flare for clear afternoons.
- **Title block**: "{Host} is walking {Place}", date/time in friendly local format, "X going · Y maybe". If it's a Group walk, a small chip: "with {Group name}".
- **Map**: small static OSM map with a single pin (meeting point).
- **RSVP buttons**: `Going` / `Maybe` / `Can't make it`. Tapping fires a confetti burst (Going) or a quiet leaf-drift (Maybe). Avatar wall fills in real time via Supabase realtime channel.
- **Attendees**: stacked avatars; tapping expands to a full list with "invited by" chips (Partiful-style invite tree).
- **Broadcasts**: host-only updates ("running 5 min late", "we're at the fountain"). Attendees see them inline; can react with 👍 / ❤️ / 🌧️. (Open thread is phase 2.)
- **About this place**: blurb + attribution from Wikipedia/Wikimedia.
- **Safety footer**: report link, meet-in-public reminder, host trust badge if `host_trust_ok()` passes.

## 4. RSVP — logged in & logged out

- **Logged in**: one-tap. Writes to `event_rsvps`. Triggers confetti + avatar pop.
- **Logged out**: opens a tiny sheet asking name + email. Email is used for:
  - calendar invite (.ics attached, Google Calendar deep link)
  - host notification ("Maya RSVP'd")
  - day-of reminder (2hr before)
  - post-walk recap link
  No password, no account. Stored in new `event_rsvp_guests` table (email hashed for lookup, raw email kept encrypted for sending). A one-click "claim your walks" magic link in the recap email converts guests to accounts.
- **Group walks**: members RSVP normally. Non-members can still RSVP via link; they're tagged "guest of {host}" and the host (and group owner) can remove them.
- **Abuse**: per-IP + per-email throttling; honeypot field; soft captcha after 3 rapid RSVPs from one IP. Host can remove any RSVP.
- **Invite credit**: share links carry a `?ref={rsvp_id}` token so we record who invited whom and render "invited by @maya" chips on the avatar wall.

## 5. Broadcasts (host updates)

- Host-only composer on the walk page ("Send an update").
- Posts to `event_broadcasts` table, fan out via Supabase realtime to everyone on the page.
- Email push to RSVP'd guests for the first broadcast within 1hr of start ("Maya posted an update").
- Reactions stored in `event_broadcast_reactions`.

## 6. Post-walk recap — `/w/$code/recap`

Auto-generated 1hr after the scheduled end time (or when the host taps "End walk"):

- Big lofi card: place cover, date, "{N} walked together", weather, total minutes, a photo grid from `event_photos`.
- Each attendee gets a personal stat slot ("your 4th walk this month · 3-week streak").
- Big "Share recap" button (PNG export of the card for IG, plus link to the page).
- Host CTA: "Plan the next one" — opens compose pre-filled with same place/time (and same group, if applicable).

## 7. Gamification & profile metrics

Add to `profiles` (or compute from existing tables):

- `walks_hosted`, `walks_attended`, `current_streak_weeks`, `longest_streak_weeks`.
- New badges: `first_host`, `five_friends_walked`, `rainy_rsvp`, `four_seasons_host`, `viral_invite` (3+ guests via your ref link).
- Profile shows a small "Walks" panel with these stats and the next 3 upcoming RSVPs.
- Subtle weekly streak ring on the home tab.

## 8. Animation language (lofi, not heavy)

- Confetti = small soft-edge dots in brand sage/clay, 600ms, eases out.
- Weather-aware: rain forecast → faint angled streaks behind hero; clear/warm → slow sun-flare bloom; cold → subtle steam-breath at the top.
- Terrain-aware: park/trail → leaf drift; city/neighborhood → slow horizontal "passing window" gradient; coastal → soft wave shimmer.
- All animations respect `prefers-reduced-motion` and pause when the tab is hidden.
- No autoplay sound, no full-screen takeovers, no haptics outside button taps.

## 9. Safety & moderation

- Email + IP rate-limits on guest RSVPs and broadcasts.
- Host can remove RSVPs, block users, and delete broadcasts.
- Existing `safety_reports` table powers "Report this walk".
- Open walks require `host_trust_ok()` (existing function) OR a Plus subscription — protects against drive-by spam hosts. Group walks inherit the group's trust; link-only walks have no gate.
- Guests' emails are never shown to other attendees; hosts see only display names.

## 10. Routes & files

New routes:

- `/walk/new` — compose (`src/routes/_authenticated/walk.new.tsx`)
- `/w/$code` — public invite (expand `src/routes/w.$code.tsx`)
- `/w/$code/recap` — recap card
- `/api/public/walk/$code/rsvp` — guest RSVP endpoint (Zod validated, rate-limited)
- `/api/public/walk/$code/ics` — calendar invite download
- `/api/public/walk/$code/og.png` — generated OG image for richer link previews

The existing `/events` placeholder gets replaced; the home FAB "Plan a walk" action routes to `/walk/new` instead of `/events`.

## Technical details

### Data model additions (migrations)

- `places` — cached Google/Wikimedia data. Columns: `id`, `google_place_id` (unique), `name`, `address`, `lat`, `lng`, `category`, `hero_url`, `hero_attribution`, `blurb`, `osm_static_url`, `cached_at`. GRANT select to anon (read-only public cache).
- Extend `events`:
  - `place_id` FK → `places.id`
  - `cover_override_url`, `pace`, `distance_meters`, `dog_friendly`, `kid_friendly`
  - widen `visibility` enum to include `group` and `link_only` alongside existing `public` / `private`
  - `group_id` FK → `groups.id` (nullable; set when visibility = `group`)
  - `circle_id` FK → `circles.id` (nullable; set when visibility = `group` and a circle is chosen instead of a group)
- `event_rsvp_guests` — `id`, `event_id`, `name`, `email_hash`, `email_encrypted`, `status`, `referred_by_rsvp_id`, `created_at`, `ip_hash`. RLS: insert via public server fn only; select via host server fn only.
- `event_broadcasts` — `id`, `event_id`, `author_id`, `body`, `created_at`. RLS: insert by host, select by anyone who can see the event.
- `event_broadcast_reactions` — `broadcast_id`, `rsvp_id` or `guest_rsvp_id`, `emoji`, unique constraint.
- Extend `profiles` (or compute view): `walks_hosted`, `walks_attended`, `current_streak_weeks`.

All new public tables: `GRANT` blocks, RLS on, policies via `is_event_host` / `is_group_member` / `is_circle_member` / `has_role`. No raw `anon` write grants — guest writes go through `/api/public/*` server routes with Zod + rate-limiting.

### Server functions (createServerFn, not Edge Functions)

- `lib/places.functions.ts` — `searchPlaces(query)`, `getOrCreatePlace(place_id)` (calls Google + Wikimedia via gateway, caches).
- `lib/walks.functions.ts` — `createWalk(input)` (validates that `group_id`/`circle_id` belongs to the host), `getWalkInvite(code)` (public, admin-elevated), `rsvpAsUser(code, status)`, `removeRsvp(rsvpId)`, `sendBroadcast(eventId, body)`, `reactToBroadcast(broadcastId, emoji)`, `getRecap(code)`, `listMyHostableGroups()` (drives the Group walk dropdown — combines `groups` the user owns/belongs to and `circles` they own).
- Public server routes for guest RSVP, ICS, OG image generation (TanStack server routes under `src/routes/api/public/walk/...`).
- Wikipedia/Wikimedia: no auth needed, fetch from `en.wikipedia.org/api/rest_v1/page/summary/{title}` server-side; results cached in `places`.
- Realtime: Supabase realtime channel `event:{id}` for RSVP & broadcast inserts.

### Animations

- Lightweight: framer-motion or pure CSS keyframes. No lottie, no canvas-heavy libraries.
- Weather → animation mapping lives in a single `walk-page/atmosphere.tsx` that takes `{ weatherCode, category }` and renders the appropriate background layer.

### Sharing

- OG image generated on-the-fly via a server route and cached in Supabase Storage per event.
- "Share to IG Story" generates a 1080x1920 PNG (place hero + title + date + walking-feet logo) using same template, downloads via blob URL.

### Out of scope for v1

- Open chat thread (phase 2, gated)
- Payment / paid walks
- Map-based discovery of nearby walks (Discover tab handles this separately)
- Recurring walks (`group_standing_walks` covers this already)
- Push notifications (email-only for v1)

## Build order

1. `places` table + Google/Wikimedia enrichment server fns
2. `events` schema extension (visibility enum, group_id/circle_id, place_id, chips)
3. Compose page `/walk/new` with the three-mode audience picker and group/circle dropdown
4. Public invite `/w/$code` with RSVP for logged-in users + realtime avatar wall
5. Guest RSVP flow (`event_rsvp_guests` + public server route + email)
6. Broadcasts + reactions
7. Animations / atmosphere layer
8. Recap page + OG image + share-to-IG card
9. Profile metrics + new badges
