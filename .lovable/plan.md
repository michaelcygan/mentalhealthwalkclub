
# 18+ Launch: Age Gate & Adult Safety Realm

Layered upgrade adding a private DOB-based eligibility gate and an adult-only "safety realm" across the app. Reuses the existing `user_dob` + `profiles.age_band` system. No youth accounts, guardians, or waitlists. Strict migration: any existing account without a confirmed DOB becomes `pending_age`.

I'll execute all 11 waves in one pass, running `npm run lint` and `npm run build` after each and fixing any regressions before continuing.

## Architecture

Two orthogonal concepts:
- **Age band** (`profiles.age_band`): adult group floors (18+, 21+, 25+, 40+, 65+). Unchanged.
- **Safety realm** (new `account_safety` table): whether the account may participate socially at all. For launch, only `adult` is active.

DOB stays in `user_dob` — one private source of truth. Never enters `profiles`, auth metadata, JWT claims, public views, notifications, or analytics.

## Wave 0 — Audit & migration plan

Query current state: auth users, users with/without `user_dob`, any DOB implying <18, `age_band` distribution, published events/groups/circles/guest RSVPs, existing public views, RLS on social tables.

Migration strategy (strict):
- DOB present, ≥18 → `adult_active` / realm `adult`
- No DOB → `pending_age` / realm `unknown`  (applies to test accounts too)
- DOB present, <18 → `underage_blocked` / realm `blocked`
- Content owned by non-adult-active owners → removed from public views (not deleted)

## Wave 1 — Private eligibility model

Migration creates:
- `account_safety` table (user_id PK, safety_realm, eligibility_status, age_method, age_attested_at, terms_version, privacy_version, suspended_reason, suspended_at, timestamps). RLS: user reads own row only; admins read all; no anon.
- `account_safety_audit` table for admin corrections.
- Enum-like CHECK constraints on `safety_realm` (`unknown|adult|future_youth|blocked`) and `eligibility_status` (`pending_age|adult_active|underage_blocked|age_review|safety_suspended`).
- SQL helpers: `is_adult(_dob date)`, `current_account_eligibility()`, `current_safety_realm()`, `is_adult_active(uuid)`.
- Replace `set_my_dob` with `confirm_my_date_of_birth(_dob)`: authenticated only, validates (not-future, ≤120y, one-time), writes `user_dob`, derives `age_band`, upserts `account_safety` with terms/privacy versions, returns `{ eligibilityStatus, safetyRealm, ageBand }`.
- Admin-only `admin_correct_user_dob(_uid, _dob, _reason)` with audit row.
- `YOUTH_REALM_ENABLED=false` server config constant (`src/lib/safety-config.ts`).

`profiles.dob` and DOB in auth `raw_user_meta_data` are never written.

## Wave 2 — Global eligibility boundary

- Server helper `src/lib/account-eligibility.functions.ts`: `getAccountEligibility()` (authed server fn) returning `{ eligibilityStatus, safetyRealm, ageBand }`. Add `requireAdultAccount(supabase, userId)` server-side helper used by other server fns — throws typed errors (`age_required`, `adult_account_required`, `account_age_review`, `account_suspended`).
- New public route `src/routes/confirm-age.tsx` — calm 18+ confirmation UI (DOB + accuracy checkbox + Terms/Privacy links). Under-18 result shows blocked notice + sign out + delete account.
- Global gate: extend `AuthProvider` (`src/lib/auth-context.tsx`) to load eligibility whenever a session exists, and add `EligibilityGate` in `src/routes/__root.tsx` that intercepts all authenticated navigation. Allowlist: `/auth`, `/confirm-age`, `/terms`, `/privacy`, `/support`, `/settings/delete`, sign-out.
- Under-18 / age_review / safety_suspended each render dedicated notice screens.
- No flash: gate suspends children until eligibility resolves.

## Wave 3 — Signup & OAuth

`src/components/auth-form.tsx`:
- Add DOB field + accuracy checkbox on email signup. Client rejects <18 / invalid / future before calling `signUp`. Never passes DOB in `options.data`.
- After signup session is available, call `confirm_my_date_of_birth`. If email confirmation delays session, redirect to `/confirm-age` post-verification.
- Google/Apple: authenticate, mark `pending_age`, redirect to `/confirm-age`. Under-18 result triggers server-side account teardown + sign out. Only a non-sensitive `age_gate_started` flag may sit in `localStorage`; never the DOB itself.
- Preserve current Plus/Free copy — don't reintroduce old trial language.
- Add unobtrusive "18+ community" note near signup.

## Wave 4 — Adult realm on social objects

Migration adds `age_realm TEXT NOT NULL DEFAULT 'adult' CHECK (age_realm IN ('adult','future_youth'))` to `events`, `groups`, `circles`. Server sets it; client never sends it.

Update:
- `src/lib/walks.functions.ts` `createWalk`: call `requireAdultAccount` first, force `age_realm='adult'`. Publishing blocked for non-adult-active owners.
- `src/lib/groups.functions.ts` create/join: require `adult_active`, keep `age_band_meets` check for group floors.
- Circles create/join/invite: same adult-realm requirement.

Backfill: adult-active owners → `age_realm='adult'`; unresolved-owner content unpublished from public views.

## Wave 5 — Server-enforced RSVPs

- Replace direct `event_rsvps` client upsert with `setWalkRsvp` server fn (auth + adult + realm match + visibility + not-blocked + not-past). Optimistic client with rollback.
- Add DB trigger on `event_rsvps` enforcing: participant `adult_active` AND event `age_realm='adult'`. Same idea for `event_rsvp_guests`.
- Update guest endpoint `src/routes/api/public/walk.$code.rsvp.ts`: only serves adult-realm published public/link_only walks; adds "I confirm I am 18+" attestation (version + timestamp stored in row). No DOB collected from guests.

## Wave 6 — Discovery & public surfaces

- Update/create `public_events` view: `status='published'` + adult-appropriate visibility + `age_realm='adult'` + owner `adult_active`. No safety join columns exposed.
- Update/create `public_profiles` view: adult-active only. Never exposes DOB, birth year, safety realm, eligibility.
- `nearbyWalksPublic`, all authenticated discovery, `getWalkByCode`, OG/story/ICS/recap endpoints all read the filtered view; ignore any client-provided `realm` param.
- Group event privacy preserved — adult realm doesn't override visibility.
- Follows (`followUser`, `getFollowState`, listers): both sides must be `adult_active`. Add DB trigger on `follows`.
- Event photos, broadcasts, invitations, notifications: adult-realm + eligibility checks.

## Wave 7 — RLS & DB enforcement

Central SQL helpers (`is_adult_active`, `can_participate_in_event`, `can_follow_user`) used by policies on: `events`, `event_rsvps`, `event_rsvp_guests`, `groups`, `group_memberships`, `circles`, `circle_members`, `follows`, `event_photos`, `event_broadcasts`, `notifications`.

Storage policies for `event-photos`, `walk-photos`, avatars, group covers: require `adult_active` for uploads; hide URLs owned by non-adult-active accounts through app readers.

DOB and account_safety remain unreadable to unrelated authenticated users.

## Wave 8 — Existing-user migration

Data migration inside the same SQL migration:
- For each `auth.users` row, upsert `account_safety` based on `user_dob`:
  - DOB ≥18 → `adult_active` / `adult`
  - no DOB → `pending_age` / `unknown`
  - DOB <18 → `underage_blocked` / `blocked`
- Existing `events`/`groups`/`circles` owned by adult-active owners → `age_realm='adult'`; others → set `status='unpublished'` (or equivalent) so they leave public views. Records preserved.
- Existing sessions hit the eligibility gate on next authenticated navigation (no auto sign-out).

## Wave 9 — Legal & product copy

- `src/routes/terms.tsx`: replace min-age language with 18+ block from spec. Clarify `kid_friendly` = children with parent/guardian only; no independent minor access.
- `src/routes/privacy.tsx`: add DOB collection description + "not intended for anyone under 18" section + updated "what we collect".
- Auth form + settings copy per spec. Settings shows "Age confirmed — contact support to correct".
- `kid_friendly` label updated across walk creation/detail to "Children may attend with their parent or legal guardian". No "Youth/Teen walk" labels.
- Small "18+ community" note near signup/footer.

## Wave 10 — Admin safety controls

Extend `src/routes/admin.users.tsx` and `src/routes/admin.safety.tsx`:
- Show eligibility status, age band, attestation date, realm, suspension. Do not show exact DOB by default.
- Filters: pending_age, adult_active, underage_blocked, age_review, safety_suspended.
- Actions (audited): place in age review, suspend, correct DOB (via `admin_correct_user_dob`), restore, delete blocked account, hide public content.
- New report reason "Possible underage user" → transitions target to `age_review` (removes from public views) while preserving evidence.

## Wave 11 — QA & adversarial tests

Playwright + direct DB checks per spec:
- Boundary tests (turns 18 today/tomorrow, 17, 21, Feb 29, future, >120, missing, second submission).
- Signup paths (email + Google + Apple, adult + under-18, pending OAuth, existing accounts w/wo DOB).
- Bypass attempts (deep links, direct createWalk, direct RSVP insert, guest against non-adult event, forged `age_realm` input, direct follow insert, blocked profile URL, browser-console DOB edit) — all must fail safely.
- Regression: adult flows (walk create/RSVP/groups/floors/follows/journal/Radio/Plus/photos/Transparency).
- Privacy: DOB absent from public/profile/event/notification/analytics payloads; blocked content not indexable.
- Final `npm run lint` + `npm run build` clean.

## Technical notes

- Every new `public` schema table (`account_safety`, `account_safety_audit`) gets explicit `GRANT` + RLS in the same migration.
- Helper functions are `SECURITY DEFINER` where they read `user_dob` on behalf of policies, with `search_path=public`.
- All existing server-fn shape rules preserved (`createServerFn`, `requireSupabaseAuth` middleware, thin `.functions.ts` files).
- No changes to Plus/Radio/Transparency/donations/journal/photos beyond eligibility gates.
- No new secrets, no new auth providers, no ID upload / biometrics.

```text
DOB (private)         Age band              Safety realm
user_dob.dob    →     profiles.age_band  ┐
                      (18+,21+,25+,40+,  ├──> account_safety.eligibility_status
                       65+)              │    account_safety.safety_realm
                                         │    (server-authoritative)
                                         └──> RLS + server fns gate all
                                              social reads/writes
```
