# Finish the 18+ Launch (Waves 6, 10, 11)

Close out the remaining pieces of the 11-wave age-gate plan. Everything below builds on the migrations, `EligibilityGate`, `/confirm-age`, DOB signup, guest-RSVP attestation, and `createWalk` preflight that are already live.

## 1. Admin surface — `/admin/users`

Extend `src/routes/admin.users.tsx` and `src/lib/users-admin.functions.ts`:

- **New columns in the row** — eligibility status pill (`adult_active` / `pending_age` / `underage_blocked` / `age_review` / `safety_suspended`) and age band. Read from `account_safety` via a new server fn `adminGetUserSafety` (or extend `adminSearchUsers` to join `account_safety` and `profiles.age_band`).
- **Filter chips** — All / Pending age / Blocked. Backed by a new optional filter arg on `adminSearchUsers`.
- **DOB correction** — button opens a small dialog: date input + reason (required). Calls a new `adminCorrectUserDob` server fn that:
  - Requires `has_role(auth.uid(), 'admin')`.
  - Wraps the existing SQL `admin_correct_user_dob(_user_id, _dob, _reason)`, which already writes to `account_safety_audit` and recomputes eligibility.
  - Returns the refreshed row so the list updates without a full reload.

No new tables or migrations — this is purely wiring the existing `admin_correct_user_dob` and `account_safety` surface into the UI.

## 2. Client-side adult preflights

Trigger-enforced backend stays authoritative; the client just avoids surprise 500s.

- **New hook** `src/hooks/use-is-adult-active.ts` — reads `useEligibility()` and returns `{ isAdultActive, loading }`. No extra fetch.
- **Disable/relabel CTAs** in these components when not adult-active, with a "Confirm your age to continue" toast that links to `/confirm-age`:
  - `src/routes/w.$code.tsx` — RSVP button for signed-in users.
  - `src/lib/follows.functions.ts` callers: profile follow button in `src/routes/u.$username.tsx`, mutual-friend suggestion rows in Discover.
  - Group join buttons in `src/routes/_authenticated/groups.$slug.tsx` and `src/routes/g.$slug.tsx`.
  - "Post a walk" entry points in `src/routes/_authenticated/walk.new.tsx` and any Discover CTA.
- **Server fns** — add lightweight `requireAdultAccount(context.supabase, userId)` at the top of `rsvpToWalk`, `followUser`, and `joinGroup` handlers so RPC errors surface cleanly as `"adult_account_required"` instead of raw trigger errors. No SQL changes.

## 3. QA + build verification

- **Typecheck + lint** (`bunx tsgo --noEmit`, ESLint) after each of the two batches above.
- **Playwright walkthroughs** against `http://localhost:8080`, screenshotting each step:
  1. New signup with DOB ≥ 18 → lands on `/` (adult_active).
  2. New signup with DOB < 18 → `/confirm-age` shows the blocked screen; sign-out works.
  3. Existing account (session restored, no DOB) → any protected route → redirected to `/confirm-age`.
  4. Public walk page → guest RSVP without checking 18+ → button disabled + error; with checkbox → success.
  5. Admin user list → filter Pending, correct a DOB, row moves to Adult active.

## Out of scope (explicit)

- No new tables or migrations.
- No email-template edits.
- No grandfathering: existing accounts confirm on next login, per the earlier decision.
- Youth realm stays feature-flagged off; no UI added.

## Technical notes

- `adminCorrectUserDob` lives in `src/lib/users-admin.functions.ts` alongside the existing `adminSetUserAdmin`, guarded by a `has_role` check in-handler.
- Use `import.meta.env` never `process.env` in components. All new server fns follow the `.middleware([requireSupabaseAuth]).inputValidator(zod).handler(...)` shape.
- Preflights import `requireAdultAccount` dynamically inside handlers to avoid pulling `client.server` into the client graph (same pattern as `createWalk`).
- The gate's allowlist (`/auth`, `/confirm-age`, `/terms`, `/privacy`, `/support`, `/w/`) stays as-is — public shareable walk pages still render for logged-out visitors.
