# One Product, Two Levels of Access

Turn the app into a single product: a public walk utility for visitors, and the unchanged full app for members. Same accounts, same backend, additive migrations only.

## Verified current state

- `/walks`, `/post`, `/p/$portalSlug`, `/w/$code/edit` do not exist yet; `portal_locations` does not exist.
- `src/lib/nearby.functions.ts` fetches 80 rows by time window and filters city/radius **after** the limit — real bug at scale, will be replaced by a filter-before-limit SQL function.
- `src/routes/index.tsx` already branches logged-out vs. authenticated; the logged-out side is marketing-heavy (Radio rail, value cards) and calls geolocation on mount.
- `src/lib/guest-rsvp-crypto.server.ts` falls back to the service-role key / project URL when `GUEST_RSVP_ENCRYPTION_KEY` is absent. The key **is** configured; the fallback still needs to fail closed.
- Public RSVP (`src/routes/api/public/walk.$code.rsvp.ts`) requires guest `ageAttest`.
- `listWalkAttendees` (in `src/lib/walks.functions.ts`) + `attendee-stack.tsx` expose names/avatars to unauthenticated viewers.
- `.env`, `.env.development`, `.env.production` are tracked in git; only `.env.example` should be.
- No test runner and no `test` script; no email provider secret is configured (only `GUEST_RSVP_ENCRYPTION_KEY`).

## Phases

Each phase ends with lint + build, a change summary, migration list, and a confirmation the authenticated app still works. Restore point + database backup before the first migration.

**1 — Shell by auth state.** `__root.tsx`: minimal public shell (identity, Find walks, Post a walk, Sign in, Support) when signed out; existing member shell untouched when signed in. No tab bar, dock, notifications, or Plus promotion for visitors.

**2 — Public walk board.** One reusable board component (location heading, time filters 7/30/all, list↔map toggle, existing walk cards, Load More, loading/error/empty states) powering logged-out `/`, `/walks`, and portals. Map uses the existing MapLibre/OSM stack.

**3 — Geographic query fix.** Additive SQL function + display-safe view: filter on community walk, published, public, real `host_user_id`, future start, horizon, city/Haversine radius, then sort and limit with a cursor. Seeded hostless walks excluded from public board.

**4 — `/walks` + NFC portals.** New `portal_locations` table (slug, label, optional place, lat/lng, radius, active, timestamps) and `/p/$portalSlug`: resolves stored location, shows walks with no geolocation prompt, allows changing area, keeps attribution. Location precedence: portal → campaign URL → saved local choice → coarse edge city → general upcoming. `/walks` is the durable ad route with UTM capture.

**5 — Shared composer.** Extract `walk.new.tsx` into a `WalkComposer` with a public mode (`/post`: place, when-picker, duration, title, optional vibe/meeting point/pace/dog/kid/access note, 18+ checkbox) and the existing authenticated mode (audiences, groups). One event-creation service, one place model, one weather path.

**6 — Public place + weather boundaries.** Move Photon and NWS provider logic into server-only internals; add narrow rate-limited public search/forecast endpoints (bounded queries, rounded coords) while keeping the authenticated wrappers. Extend `PlaceSuggestion` with structured city/district/region/country from `photon.server.ts` and stop parsing city out of the formatted address.

**7 — Draft → account → publish.** Versioned expiring local draft (no DOB) that survives OAuth/email/refresh, a client idempotency key with a DB uniqueness guard, auth modal at Publish, automatic resume, organizer created, draft cleared only after confirmed publication, land on `/w/$code`.

**8 — Adult self-attestation.** Extend eligibility so an account is adult-active via existing verified DOB **or** recorded self-attestation (timestamp, source, terms version). New signups check one 18+ box and enter the app immediately — no blocking `/confirm-age`. Guests never attest. Existing DOB records, `account_safety`, and suspensions preserved.

**9 — Shared walk page + attendee privacy.** Keep `w.$code.tsx` as-is visually; deepen with auth (member RSVP, organizer controls). Public attendees become aggregate counts only; names/roster restricted to organizer and admins; guest emails never shown.

**10 — RSVP, organizer management, notifications.** Drop guest age attestation from the sheet and public API; add confirmation email, secure manage link, change/cancel. `/w/$code/edit` with server-side ownership, roster, cancel (status change, not deletion), "My Walks" entry point, change/cancel notifications. Guest crypto fails closed without the dedicated key.

**11 — Admin.** New "Public Walk Utility" section inside existing admin: utility overview (upcoming, next 7 days, recent RSVPs, new organizers, portal visits, empty-result rate, open reports, failed publishes/RSVPs/emails, config health), walk moderation with reasons + audit trail, organizer suspension/restore, portal CRUD with durable URL and metrics, and public "Report this walk" wired into the existing Safety queue.

**12 — Analytics + low-touch ops.** Privacy-minimal utility events (surface, portal, walk, rotating session ID, coarse area, UTM, referrer host) with defined raw retention; outbox-backed transactional email, posting caps, rate limits, honeypots, admin alerts, weekly digest, scheduled cleanup of expired analytics, guest contact data, IP hashes.

**13 — Copy, security, SEO, tests.** Calm safety copy; sanitation and length limits on public writes; untrack `.env*` except `.env.example` and flag anything needing rotation (no values printed); sitemap limited to public routes with portals noindex/canonicalized; add a test runner plus the boundary tests listed in the brief.

## Technical notes

- Public reads go through a publishable-key server client + narrow `TO anon` policies on a display-safe view; no admin client for public data.
- Every new public table gets GRANTs in the same migration; all migrations additive.
- No second Lovable project or Cloud instance; existing backend only.
- Cleanup and digests use the existing `pg_cron` setup calling `/api/public/*` routes.

## Open item

No email provider is configured. Phase 10 needs one secret (recommended: Resend `RESEND_API_KEY`) — I'll request it at that point and surface its absence in admin health rather than hardcoding anything.
