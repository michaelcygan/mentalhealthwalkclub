# Security Audit — Pre-Launch

Combined results from the DB linter (32 findings), the deep security scanner (40 findings), and a code read of the flagged server functions. Triaged by exploit impact, not raw count.

## Sev 0 — Block launch (real, exploitable bugs)

1. **Storage policy bypass on `walk-snapshots`** *(scanner: error)*
   Two PERMISSIVE INSERT policies exist: `walk_snapshots_insert_own` checks only `bucket_id`; `walk_snapshots_own_insert` enforces `auth.uid()` as the first path segment. Because both are PERMISSIVE, the weaker one wins → any signed-in user can upload (and overwrite) any other user's GPS snapshot.
   Fix: drop `walk_snapshots_insert_own`.

2. **Realtime channel auth missing** *(scanner: error)*
   No RLS policies on `realtime.messages`. Any authenticated user can subscribe to any channel topic by name — including private walk-session / broadcast channels keyed by user or session ID.
   Fix: add RLS on `realtime.messages` restricting topic subscriptions to authorized users (host, RSVP'd attendee, or self).

3. **`addAllowlistCircle` / `removeAllowlistCircle` / `addBlocklistUser` / `removeBlocklistUser`** in `src/lib/social.functions.ts` *(scanner: error)*
   No host-ownership check. Any signed-in user can tamper with any event's audience controls.
   Fix: mirror the `setEventAudience` guard — fetch `events.host_user_id`, assert `=== userId`.

4. **`respondFriendRequest`** in `src/lib/social.functions.ts` *(scanner: error)*
   Only `.eq('id', data.id)`. The requester can call it with their own pending row and auto-accept, gaining `friends` visibility without consent.
   Fix: assert `requested_by !== userId` and that caller is a party to the row.

5. **`getEventPhotos`** in `src/lib/walk-page.functions.ts` *(scanner: warn, but real leak)*
   No `requireSupabaseAuth`, uses `supabaseAdmin`, returns signed URLs for any event UUID — including group-only and link-only events. Anonymous photo exfiltration with a UUID guess/leak.
   Fix: add `requireSupabaseAuth`, then check `events.visibility` + group membership / RSVP / host before signing.

6. **`profiles.lat` / `profiles.lng` exposed to all authenticated users** *(scanner: warn — sensitive for this app)*
   `profiles_select_all_authenticated` policy is `USING (true)`. For a mental health walking app, precise coordinates likely reveal home/frequent locations. Already noted in security memory.
   Fix: move `lat`/`lng` out of the broad SELECT path — either drop the columns into a separate owner-only table, or replace the policy with a view that omits them and deny direct SELECT on the base table for non-owners.

7. **`event_photos_public_select` allows anonymous reads** *(scanner: warn)*
   Public can read `storage_path`, `user_id`, captions, timestamps for every event photo — leaks user activity metadata even though the bucket itself is private.
   Fix: scope policy to `authenticated` only (consistent with sibling event tables).

## Sev 1 — Fix before launch (ownership gaps)

8. **`deleteStandingWalk`** in `src/lib/standing-walks.functions.ts` — no group-owner check. Any group member who learns a standing walk's UUID can wipe a group's recurring schedule. Mirror the `createStandingWalk` guard.

## Sev 2 — Configuration / hygiene

9. **Public bucket allows listing** (`ambient-covers`) — broad SELECT on `storage.objects` lets clients enumerate all files. Restrict the policy to only the paths your app needs, or move covers behind signed URLs.

10. **Extension installed in `public` schema** — move to a dedicated `extensions` schema (cosmetic, low risk, but flagged by the linter).

11. **SECURITY DEFINER functions executable by `anon` / `authenticated`** — 29 functions flagged. Most are intentional helpers (`has_role`, `is_event_host`, `are_friends`, `age_band_meets`, etc.) used inside RLS. Action: audit the list and `REVOKE EXECUTE ... FROM anon` on any that should not be callable from the client (e.g. `recompute_walker_metrics`, `evaluate_badges` if they exist as definers — these mutate state and should not be client-callable). Keep grants only on the pure read helpers used by RLS.

12. **RLS Enabled No Policy** (info) — one table has RLS on but no policies, so it is effectively locked. Confirm intentional; otherwise add a deny-all comment or a real policy.

## Sev 3 — Defense in depth (post-launch, do soon)

- **Leaked-password protection (HIBP)**: enable via `configure_auth` with `password_hibp_enabled: true`.
- **Rate limiting on public routes**: `/api/public/hooks/sync-*`, `/api/public/walk.$code.og`, `/api/public/payments/webhook`. The cron hooks now check `apikey` (good); add per-IP throttling to the OG endpoint to avoid abuse-driven Worker spend.
- **Stripe webhook**: confirm signature verification uses `timingSafeEqual` (constant-time) and is wrapped in try/catch returning 400 on bad signature.
- **CORS on `/api/public/*`**: keep responses same-origin unless explicitly needed; do not add `Access-Control-Allow-Origin: *`.
- **Input validation**: add Zod schemas (length + regex caps) to every server-route POST body — at minimum the webhook and OG endpoints. Server functions already validate via `inputValidator`; spot-check that all of them use strict Zod, not `(x) => x`.
- **PII surface review**: `safety_reports`, `user_dob`, `subscriptions`, `billing_events` — confirm policies are owner-only and that no server fn returns these via `supabaseAdmin` without an explicit authorization check.
- **Service role usage**: every remaining `supabaseAdmin` call in `.functions.ts` files should (a) authenticate the caller first, (b) project only safe columns, (c) apply explicit WHERE filters. Worth a final grep.
- **Update security memory** after Sev 0/1 are shipped so future scans don't re-flag the now-fixed items.

## Out of scope for this pass
New features, schema refactors beyond the lat/lng split, and the optional `extensions` schema move (cosmetic).

## Recommendation
Ship **Sev 0 (items 1–7) and Sev 1 (item 8) before launch** — these are the actual exploitable issues (~2–3 hours of work, mostly SQL + small server-fn guards). Sev 2 in the first week, Sev 3 as ongoing hygiene.

Approve and I'll switch to build mode and ship Sev 0 + 1 in one pass.
