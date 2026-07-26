# Unified Plus / 988 — Waves 5 & 6

Recap: Waves 1–4 delivered the ledger schema, unified $2.99+ Plus checkout, revenue-splitting webhook, and the public `/transparency` + guest `/contribute` surfaces. Two waves remain.

## Wave 5 — Member self-service, dedications, admin ledger

Scope covers everything you selected. Structured smallest-risk-first so each step can ship on its own.

### 5A. Dedications on recurring Plus
Right now `PlusCheckout` collects the amount but not the honoree/message/public-name fields that `/contribute` already collects. Bring the same fields into monthly Plus so recurring gifts show up in the transparency feed.

- Extend `PlusAmountPicker` / `PlusCheckout` with a collapsible "Dedicate this gift (optional)" block reusing the shape from `OneTimeContributionSheet`.
- Pass `dedicationName`, `dedicationMessage`, `displayPublicly` into `createPlusCheckoutSession` in `src/lib/billing.functions.ts` → attach to session metadata.
- Update the subscription webhook branch in `src/routes/api/public/payments/webhook.ts` so each monthly invoice's `donation_allocations` row copies the dedication fields from `subscription.metadata` (persisted on session creation).
- Verify `transparency_feed` already surfaces these rows — it does (source-agnostic).

### 5B. Billing portal + settings surfacing
Members need a way to change amount / cancel without a support ticket.

- Add `createPlusPortalSession` server fn (mirrors the standard Stripe portal pattern) protected by `requireSupabaseAuth`.
- New `src/routes/_authenticated/settings.membership.tsx` (or extend existing settings): shows current status from `user_membership`, monthly amount, next renewal, "Change amount" (opens `PlusAmountPicker` prefilled) and "Manage in Stripe" (opens portal in new tab).
- "Change amount" flow: cancel-at-period-end current sub + open new checkout at chosen amount. Simpler and safer than a proration dance.

### 5C. Admin ledger + batch tooling
Internal-only page so you can actually cut checks and prove it on `/transparency`.

- New route under `src/routes/_authenticated/admin/donations.tsx`, gated by `has_role(auth.uid(),'admin')`.
- Server fns in `src/lib/admin-donations.functions.ts`:
  - `listUnbatchedAllocations({ environment })` — designated rows with `transfer_batch_id IS NULL`.
  - `createTransferBatch({ allocationIds, environment })` — inserts a `donation_transfer_batches` row (unpublished), stamps `transfer_batch_id` on selected allocations, sums cents.
  - `markBatchTransferred({ batchId, transferredAt, receiptUrl, notes })` — sets `transferred_at`, `receipt_url`, flips allocations to `status='transferred'`.
  - `publishBatch({ batchId })` — sets `published=true` so it appears on `/transparency`.
- UI: three-panel page — Unbatched queue (checkbox multi-select → "Create batch"), Draft batches (edit / mark transferred), Published batches (read-only, unpublish).
- Guardrails: all mutations verify admin role via `has_role`; batch totals recomputed server-side, never trusted from client.

### 5D. Plus perks enforcement (Radio)
`radio_monthly_usage` + `increment_radio_usage` exist but nothing calls them.

- In the radio player component, on each track completion (or every 60s while playing), call `increment_radio_usage` with elapsed seconds.
- Non-Plus users: cap at `membership_settings.free_radio_seconds_per_month` (already a column). Show a soft paywall sheet when they hit the cap that opens `PlusAmountPicker`.
- Plus users: no cap, but still record usage for internal analytics.
- Read `is_plus` from `user_membership(auth.uid(),'live')` on mount; cache in a lightweight context.

### 5E. Retire legacy branding
Sweep the codebase for `supporter_profile` / "Supporter" copy that still leaks through, and either hide the surfaces or rewrite them to point at unified Plus. (Backend rows stay — read-only.)

## Wave 6 — Launch QA pass (final)

Short, verification-heavy wave. No new features.

- **RLS audit** on `donation_allocations`, `donation_transfer_batches`, `radio_monthly_usage`, `subscriptions`, `membership_settings` — confirm anon can only read `published=true` batches and the redacted feed; authenticated can only see their own rows; admin RPCs bypass appropriately via SECURITY DEFINER.
- **Refund/dispute round-trip** in sandbox: simulate `charge.refunded` and `charge.dispute.created`, confirm allocations flip status and totals in `transparency_totals` recompute correctly.
- **Guest one-time end-to-end**: sandbox charge on `/contribute` → row visible on `/transparency` with correct dedication redaction rules.
- **Environment filter sweep**: every `subscriptions` read filters `.eq('environment', getStripeEnvironment())` — easy source of "worked in preview, broke live" bugs.
- **Grants check** on any table this project touches with anon (transparency reads).
- **Copy pass** on `/transparency`, `/contribute`, `/impact`, settings — ensure the "$2.99 covers costs, everything above goes to 988" story is unmistakable and legally accurate ("designated for" vs "donated to" — you're the intermediary until batch transfer).

## Technical details

- No new tables needed; schema from Wave 1 already supports everything.
- One migration in 5C to add an admin-callable RPC `admin_create_transfer_batch(ids uuid[])` if we want atomic multi-row updates instead of doing it in TS.
- All Stripe calls continue to go through `createStripeClient(env)` per project convention.
- Radio enforcement lives client-side for UX + server-side via `increment_radio_usage` (already RLS-guarded to `auth.uid()`).

## Answer to "how many waves"
Six total. After Wave 6 you're launch-ready on the Unified Plus / 988 track.
