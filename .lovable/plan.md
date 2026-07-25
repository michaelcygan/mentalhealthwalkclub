# Wave 0 — Repository & Migration Audit

Read-only audit. No files change until Wave 1 is approved.

## 1. Route inventory (36 route files)

**Keep & simplify** (become the V1 shell)
- `__root.tsx` — keep, replace mobile bar + header controls in Wave 2.
- `index.tsx` — keep, rebuild as public homepage + Nearby grid (Wave 2/3).
- `auth.tsx` — keep.
- `w.$code.tsx`, `w.$code.recap.tsx` — keep the shareable walk URL; simplify page (Wave 3).
- `_authenticated/route.tsx` — keep the auth gate.
- `_authenticated/walk.new.tsx` — keep, collapse into short flow (Wave 3).
- `_authenticated/groups.tsx`, `_authenticated/groups.$slug.tsx` — keep, simplify (Wave 4).
- `_authenticated/discover.tsx` — **retire as separate destination**; content folds into `/` Nearby (Wave 2). Redirect `/discover → /`.
- `journal.tsx` — keep, rebuild around walk_sessions + photos (Wave 5).
- `profile.tsx` → rename to `/me` conceptually; keep file, retitle sections (Wave 2/5).
- `settings.tsx`, `more.tsx` — keep; merge `more` into `/me` menu.
- `privacy.tsx`, `terms.tsx`, `support.tsx` — keep; rewrite copy (Wave 7).
- `welcome.tsx` — keep (post-signup landing).
- `api/public/walk.$code.{ics,og,story,rsvp}.ts` — keep; audit `rsvp` (guest flow) & `story` (service-role reads) (Wave 3).
- `api/public/hooks/sync-{blog,podcast}-feeds.ts` — keep only if blog RSS keeps running; podcast sync is retired-runtime (Wave 6/8).
- `api/public/payments/webhook.ts` — **freeze**, remove from runtime once billing is off (Wave 8).

**Redirect (retire URL, keep parity)**
- `events.tsx`, `events.$slug.tsx` → `/` and `/w/:code` (Wave 2).
- `_authenticated/discover.tsx` → `/`.
- `_authenticated/walk.index.tsx` (solo timer) → `/journal` (Wave 5).
- `_authenticated/places.tsx`, `places.$key.tsx` → `/` (Wave 8).
- `_authenticated/trails.tsx`, `trails.$id.tsx` → `/` (Wave 8).
- `_authenticated/listen.tsx`, `listen.$id.tsx`, `listen.collection.$slug.tsx` → new `/radio` in Wave 6, or remove.
- `_authenticated/read.$postId.tsx` → `/blog/:slug` (Wave 6).
- `_authenticated/circles.tsx` → `/groups` (Wave 4).

**Retire (no parity)**
- `impact.tsx`, `shop.tsx`, `shop.return.tsx` — donations & merch out of V1.
- All `admin.*.tsx` except a consolidated new admin (Wave 7): collapse 13 admin pages into 6 tabs (Walks, Users, Groups, Safety, Blog, Radio). Retire `admin.podcasts.*`, `admin.collections`, `admin.membership`, `admin.merch`, `admin.insights` (fold useful bits into new `admin.analytics` or drop).

## 2. Database inventory (55 public tables) — reuse/extend/freeze/migrate/drop-later

**Reuse (core of V1)**
- `profiles` (25 cols) — extend privacy projection; split public vs private fields in Wave 1.
- `events` (50 cols) — the walk model; add geography + trim unused columns in view layer (Wave 3).
- `event_rsvps` — keep; add attendance-confirmed status (Wave 3).
- `event_photos`, `walk_photos`, `walk_sessions` — consolidate journal around these (Wave 5).
- `groups`, `group_memberships`, `group_standing_walks` — keep; use `group_standing_walks` for Post Again seed (Wave 4).
- `notifications` — keep, prune kinds (Wave 7).
- `badge_definitions`, `user_badges` — keep; rewrite award triggers (Wave 5).
- `safety_reports`, `blocks` — keep; complete workflows (Wave 7).
- `user_roles`, `has_role()` — keep; admin auth.
- `error_reports` — keep.
- `user_dob`, `user_locations` — keep (private).

**Migrate (data shape change)**
- `friendships` (mutual accepted model) → new `follows` table (directional). Wave 4: create `follows`, migrate accepted friendships into 2 rows each. **Freeze `friendships`, do not drop.** Current row count: 0, so migration is trivial.
- `journal_entries` (1 row) → merge concept into `walk_sessions.reflection_note` + `walk_photos`. Preserve legacy read path.
- `blog_posts` (80 rows, imported RSS) → introduce first-party columns (`body`, `status`, `author_id`, `seo_*`) or a new `articles` table. Prefer **extend `blog_posts`** with a `source` enum ('feed'|'original') to avoid data duplication; freeze `blog_feeds` runtime (Wave 6).

**Freeze (remove runtime use, keep table)**
- `circles`, `circle_members`, `event_circle_allowlist`, `event_blocklist` — Wave 4.
- `event_broadcasts`, `event_broadcast_reactions`, `high_fives` — Wave 3/7.
- `event_rsvp_guests` — Wave 3 (guest RSVP disabled).
- `podcast_feeds` (7), `podcast_episodes` (643), `guided_tracks`, `playlists`, `playlist_items`, `listen_collections`, `listen_collection_items`, `listen_events`, `listen_search_log`, `saved_reads`, `ambient_tracks` — replaced by Radio in Wave 6.
- `blog_feeds` (7) — Wave 6.
- `trails`, `trail_search_log`, `user_saved_trails`, `places` — Wave 8.
- `subscriptions`, `billing_events`, `membership_settings`, `supporter_profile`, `impact_donations`, `merch_products`, `merch_orders` — Wave 8.
- `goals`, `user_goals`, `user_preferences` (partial) — Wave 5.
- `content_requests`, `announcements` — Wave 7.

**Drop-later proposal (separate approval after Wave 8)**
All frozen tables above with row counts of 0 or non-user data. Never dropped inside a feature wave.

## 3. Existing-data risks

- 28 events, 39 walk_sessions, 43 profiles, 14 notifications, 14 user_badges, 80 blog_posts, 643 podcast_episodes, 1 journal_entry, 1 walk_photo. **Users are live-ish; treat all migrations as forward-only.**
- No RSVPs, groups, circles, subscriptions, merch — so simplifications there are safe.
- `blog_posts` has 80 real imported rows; do not truncate.
- `podcast_episodes` (643) — Wave 6 turns off runtime but leaves data.
- 77 migration files spanning 2026-05 to 2026-06 — do not delete any.

## 4. Package manager & lockfile diagnosis

- **Two lockfiles present:** `bun.lockb` (308 KB) and `package-lock.json` (394 KB). Only one can be canonical.
- Wave 1 recommendation: **adopt Bun** (matches `bunfig.toml`, existing `bun add` workflows, Cloudflare/TanStack template default). Delete `package-lock.json`, regenerate `bun.lock` (text-format) with a clean `bun install`.
- CI/deploy: verify Lovable build uses `bun install`; if it uses npm, switch.

## 5. Dependency & asset removal opportunities (measured in Wave 8, listed now)

- `@stripe/react-stripe-js`, `@stripe/stripe-js`, `stripe` — remove with billing (Wave 8).
- `leaflet`, `@types/leaflet`, `react-leaflet`, `maplibre-gl` — remove if no map ships in V1 (spec says no map). Wave 8.
- `recharts` — used only in admin insights; keep only if new admin analytics needs it.
- `@dnd-kit/*` — verify usage; likely only playlist/admin reorder → remove with Radio admin using simpler reorder.
- `embla-carousel-react`, `vaul`, `input-otp`, `react-day-picker`, `react-resizable-panels` — audit; keep only what's referenced by kept routes.
- `fast-xml-parser`, `@mozilla/readability`, `linkedom` — remove with blog-feed sync + reader mode (Wave 6/8).
- `despia-native` — verify not needed for web V1.
- `public/videos/ambient/*.mp4` — remove with ambient video (Wave 8).
- `src/assets/*` niche/mood/city cover packs — audit for orphaned covers.

## 6. Security findings (priorities for Wave 1)

- **Tracked env files.** `.env`, `.env.development`, `.env.production` are all committed (856/136/136 bytes). `.gitignore` does not list them. Untrack all three, add `.env.example` with placeholder keys only, ensure `.env*` in `.gitignore` (except `.env.example`).
- **27 files import `supabaseAdmin` / service role.** Each must independently authorize the requested resource. Audit list (Wave 1 for reads that skip authz):
  - `walk-page.functions.ts`, `walk-places.functions.ts` — public walk & attendee reads.
  - `api/public/walk.$code.{og,story,ics,rsvp}.ts` — public routes with service role.
  - `walks.functions.ts`, `podcasts.*`, `blogs.*`, `listen-curation.*`, `collections.*` — several are public reads that should use anon/publishable + narrow RLS, not service role.
- **Guest RSVP encryption key** now bound to `GUEST_RSVP_ENCRYPTION_KEY`. Confirm no fallback path remains and confirm the file `guest-rsvp-crypto.server.ts` refuses to run without the secret.
- **Public sync hooks** already require `apikey` header (verified). Keep, but audit that they don't accept the anon key from a malicious caller with write intent — they should verify the key equals the publishable key and only trigger reads/writes on server-side authenticated queries.
- **Profile privacy vs RLS.** Wave 1 must add a public-safe projection or column split. Today, an authenticated client can select nearly every profile column.
- **HIBP password protection** not enabled — enable via `configure_auth` in Wave 1.

## 7. Test coverage

**None.** No `*.test.ts(x)` files exist. Wave 1 must:
- Add Vitest.
- Add first RLS/authz tests: guest cannot read event meeting details; non-member cannot read private group walks; non-owner cannot delete another user's rows on `walk_sessions`, `walk_photos`, `follows` (once introduced), `event_rsvps`.

## 8. TypeScript / lint

Not run in this audit. Wave 1 must run `tsgo` and `eslint .`, fix substantive errors only (no formatting churn).

## 9. Proposed files & migrations per later wave (preview only)

- Wave 1: `.env.example`, `.gitignore` update, `vitest.config.ts`, `src/tests/*`, `supabase/migrations/*_profile_privacy.sql`, `configure_auth` call.
- Wave 3: `supabase/migrations/*_events_geo.sql` (add `location geography(Point,4326)`, GiST index, trigger to sync from lat/lng), new `src/lib/nearby.functions.ts`, rewritten walk page & post flow.
- Wave 4: `supabase/migrations/*_follows.sql` (new table + policies + friendships→follows backfill), `src/lib/follows.functions.ts`.
- Wave 5: `supabase/migrations/*_badges.sql` (idempotent award fns), refactored `src/lib/journal-entries.functions.ts` → memories over walk_sessions.
- Wave 6: `supabase/migrations/*_radio.sql` (`radio_tracks`, `radio_settings`), `*_articles.sql` (extend `blog_posts`), R2 env placeholders in `.env.example`, `src/lib/radio.functions.ts`, `src/lib/articles.functions.ts`, new `/blog`, `/blog/:slug`, `/radio-admin` routes.
- Wave 7: consolidated `src/routes/admin/*`, notification-kind cleanup migration, copy rewrite in `privacy`, `terms`, `support`, `about`.
- Wave 8: dependency + asset removal PR; separate proposal for legacy-table drops.

## 10. Rollback strategy

- Forward-only migrations; each new SQL is reversible by writing the inverse migration (never delete migration files).
- Retired routes get redirects, not deletions, until Wave 8.
- Frozen tables remain readable; retired code paths are removed from client bundles but data survives.
- Feature waves ship independently; each is a review checkpoint.
- Legacy-table drops are proposed as a separate PR after Wave 8.

## 11. Blockers requiring your decision before Wave 1

1. **Package manager**: confirm **Bun** as canonical (my recommendation) — then `package-lock.json` is deleted in Wave 1.
2. **Env untracking**: confirm you have your `.env` values saved locally; Wave 1 will untrack the three committed env files (`git rm --cached`) and rely solely on Lovable's secret storage.
3. **`blog_posts` shape**: extend the existing table with an `original`/`feed` source column (my recommendation, preserves 80 imported rows), or create a separate `articles` table and leave `blog_posts` frozen. Extending is simpler and keeps SEO URLs.
4. **Radio storage**: confirm Cloudflare R2 is available on your account — Wave 6 needs bucket + credentials. If not, we substitute Supabase Storage for V1 with a documented ceiling.
5. **`/me` vs `/profile`**: confirm renaming the authenticated route to `/me` (with redirect from `/profile`), or keep `/profile` and just re-scope its content.
6. **Podcast episodes (643 rows)**: freeze runtime only, or also hide `admin.podcasts.*`? My recommendation: hide admin, keep data.

Reply with decisions on the six items above (or "proceed with your recommendations") and I'll start Wave 1.
