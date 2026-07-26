# Unified Plus + 988 Transparency — Layered Renovation Plan

Implement in sequential waves against the existing TanStack Start / Supabase / Stripe app. After each wave: `npm run lint && npm run build`, fix errors, verify acceptance, then continue. If context runs out, stop at a clean wave boundary and state which wave is next.

## Guiding rules

- One membership class only: **Walk Club Plus**, minimum $2.99/mo, voluntary higher amounts.
- First $2.99 → MHWC. Every cent above → designated for 988. MHWC absorbs processing fees.
- All Plus members get identical benefits regardless of amount.
- No new: Supporter tier, yearly plan, free trial, tiered perks.
- Existing paid customers are never silently canceled or converted.
- Server is source of truth for allocation math; webhook-led immutable ledger.

---

## Wave 0 — Audit & migration safety

Read-only inventory before any code change.

- Query `subscriptions`, `impact_donations`, existing webhook, `user_membership` fn, billing-events tables, admin routes, storage policies (`event-photos`, `radio-tracks`).
- Report counts: live Plus, live yearly, live Supporter, active trials, published impact rows, per-env split (sandbox vs live).
- Define **`allocation_model_cutover_at`** timestamp — boundary between legacy accounting and new `plus_overage_v1`.
- Decide fate of legacy Supporter rows (archive as `legacy_supporter` source; keep manageable if live rows exist, else retire UI).

Acceptance: written audit; no data mutated; cutover timestamp chosen.

---

## Wave 1 — Database foundations (migration)

Single migration with GRANTs + RLS in the required order.

**Extend `subscriptions`** with: `selected_total_cents`, `membership_allocation_cents`, `donation_allocation_cents`, `stripe_base_item_id`, `stripe_donation_item_id`, `dedication_type`, `honoree_name`, `dedication_message`, `public_donor_name`, `display_donation_publicly`, `allocation_model_version`, `allocation_model_cutover_at`.

**New tables**:
- `donation_allocations` — immutable ledger (fields per spec; `stripe_event_id` unique; source ∈ {plus_overage, one_time_contribution, legacy_supporter, legacy_plus_commitment}; status ∈ {designated, transferred, refunded, partially_refunded, disputed, reversed}).
- `donation_transfer_batches` — admin batches with `published boolean`, receipt path, status ∈ {draft, transferred, verified}.
- `radio_monthly_usage (user_id, month_start, seconds_used)` PK composite.
- Extend `membership_settings`: `plus_base_cents=299`, `plus_max_monthly_cents=100000`, `radio_free_seconds=18000`, `donation_org_name`, `donation_org_url` (988 defaults).

**Constraints**: allocation can only belong to one batch (FK + partial unique). Ledger financial fields not client-writable.

**Postgres functions**:
- `increment_radio_usage(_user, _seconds)` — atomic upsert.
- `public_transparency_feed()` — returns only opted-in public rows (no PII/Stripe IDs).
- `public_transparency_totals()` — designated / transferred / awaiting.

**RLS**: anon can only read via the security-definer feed functions; admin (`has_role`) manages batches; webhook writes via service role.

Acceptance: idempotent migration, no PII exposed via anon, atomic usage increment works.

---

## Wave 2 — Unified Plus checkout (frontend + server fn)

Refactor billing surfaces to a single amount-picker flow.

**Server (`src/lib/billing.functions.ts`)**:
- Replace `createPlusCheckoutSession` / `createSupporterCheckoutSession` with `createPlusCheckoutSession({ selectedTotalCents, dedication })`.
- Server clamps 299 ≤ amount ≤ 100000, recomputes allocations, creates Stripe Checkout with two subscription items: base Plus price ($2.99) + inline recurring price for `(total-299)` on the configured **988 contribution product** (env-scoped product IDs stored in `membership_settings` or env vars).
- Store both item IDs on session metadata; final persistence happens in webhook.
- Add `updatePlusMonthlyAmount({ newTotalCents, dedication })` — updates/creates/removes the contribution item on the existing subscription, no proration, next-renewal apply.
- Remove yearly + trial code paths from *new* checkouts (keep read paths for legacy rows).

**Client**:
- New `PlusAmountPicker` (presets 2.99 / 5 / 10 / 25 / Custom) with live allocation breakdown.
- Dedication controls only when amount > 299; public display off by default; 280-char message cap.
- Update `src/lib/auth-prompt.tsx`: `openPlusCheckout()` → amount picker directly. Rename `openSupporterFlow` → `openOneTimeContributionFlow` (impl in Wave 3).
- Update `billing-card.tsx` to show selected total + designated portion + renewal date; actions = Change amount / Update payment / Cancel / Invoices. Remove "Switch to yearly".
- Retire `plan-picker.tsx`, `supporter-checkout.tsx`, `supporter-amount-picker.tsx`, `supporter-card.tsx` from active flow (delete or keep behind a legacy flag only if live Supporter rows exist).
- Preserve signup-intent handoff.

Acceptance: new subs are single Stripe subscription with correct 2-item structure; amount changes don't create a second sub; no new yearly/trial/Supporter.

---

## Wave 3 — Webhook + immutable ledger + one-time contributions

Extend the existing `src/routes/api/public/payments/webhook.ts` (do not add a second webhook).

**Handle**:
- `invoice.paid` (Plus recurring) → verify sub metadata `kind=plus` + `allocation_model=plus_overage_v1`; read live sub items from Stripe; base must be 299; donation = `paid_amount - 299`; upsert one `donation_allocations` row keyed by `stripe_event_id`; snapshot dedication + public display from subscription; sync `subscriptions` row.
- `payment_intent.succeeded` (one-time) → allocation with `source=one_time_contribution`, full amount to 988.
- `charge.refunded` / `charge.dispute.created` / `charge.dispute.closed` → mutate existing allocation status (refunded/partially_refunded/disputed/reversed), preserve audit if already transferred.
- `customer.subscription.updated/deleted` → keep existing behavior, update selected/allocation fields.

Idempotency via unique `stripe_event_id`. Never trust client math. Retire `recomputeImpactForPeriod` as source of truth (leave read-only for legacy view).

**One-time contribution**:
- `createOneTimeContributionCheckoutSession({ amountCents, dedication })` — min $5, presets 5/10/25/50/custom, mode=payment, metadata on PaymentIntent.
- Client sheet reused from Plus dedication controls.

Acceptance: duplicate events no-op; $10 Plus → $7.01 row; refund flips status; sandbox/live isolated.

---

## Wave 4 — `/transparency` page + `/impact` redirect

- New route `src/routes/transparency.tsx` (public, SEO head, OG image).
- Summary cards: Designated / Transferred / Awaiting (from ledger functions).
- Public contribution feed: date, public name or Anonymous, donation portion only (not gross), source label (Monthly Plus / One-time), dedication if public, status.
- Transfer batches list with receipt link when published.
- Legacy `impact_donations` shown in separate "Legacy impact reports" section if any.
- "Make a one-time contribution" CTA opens new flow.
- Methodology note: not tax-deductible; designated vs transferred; link to official 988 donation channel.
- `src/routes/impact.tsx` → 301 to `/transparency` (retain existing head metadata redirect via loader).
- Remove NAMI defaults; org name from `membership_settings`.

Acceptance: public feed shows no Stripe/PII; totals match ledger; `/impact` redirects.

---

## Wave 5 — Simplified entitlements

### 5A — Free journal
- `src/lib/journal-entries.functions.ts`: remove Plus gate from create/update; keep auth + ownership + body limits.

### 5B — Photo uploads (Plus-only) + free viewing
- Refactor `memory-strip.tsx` upload path.
- New server fns `createEventPhotoUploadIntent` + `finalizeEventPhotoUpload` — verify Plus + event permission (host/RSVP/group) + MIME + size + path; return short-lived signed upload URL; finalize inserts `event_photos` row after re-check.
- Viewing: public/link_only walks accessible to signed-out users; private/group scoping preserved.
- Free user tap → upsell copy per spec.
- Tighten storage bucket policies: reads follow walk visibility, writes only via signed URL from server fn.

### 5C — Radio quota + JIT signing
- Add `"radio"` PlayableKind in `src/lib/player-context.tsx`; stop classifying Radio as `guided`.
- Server: `getRadioEntitlement`, `recordRadioUsage` (calls SQL fn), `signRadioTrack` (single track, short TTL ~5min, checks Plus or remaining seconds).
- Remove batch station pre-signing in `radio.functions.ts` / `radio-client.ts`.
- Client: 60s heartbeat while actually playing (not paused/loading); at cap, finish current track, block next, show upsell + reset date.
- Public station browsing OK; playback requires auth.

Acceptance criteria per spec bullets in each sub-wave.

---

## Wave 6 — Admin transfer workflow + cleanup

- New/updated admin route `src/routes/admin.transparency.tsx` (rename from admin.impact if present): list designated allocations, filter by date/env, multi-select → create batch (server fn); mark transferred with date + receipt upload; publish toggle.
- Guards: allocation ↔ batch 1:1; can't publish without amount; sandbox/live isolation; audit trail on amount change.
- Update `use-membership.ts` / `use-subscription.ts`: expose `isPlus`, `selectedMonthlyCents`, `monthlyDonationCents`, `plusInterval`; keep `isSupporter` only as legacy read.
- Admin revenue: split `gross_billing` / `platform_recurring` / `988_recurring`; stop multiplying subs × hard-coded price.
- Repo-wide copy sweep for: Supporter/supporter/Patron/patron/"50%"/"Half of every"/"profits"/"30-day"/"free trial"/"yearly"/NAMI/impact — replace or remove per final copy block. Keep legacy DB support for real active customers only.

Acceptance: admin can transfer + publish; totals reflect new model; no new-user flow references retired concepts.

---

## Wave 7 — QA + launch validation

Sandbox matrix (checkout amounts, subscription changes, webhook events including duplicates/out-of-order, refunds/disputes, sandbox/live separation), privacy checks (no Stripe IDs / no name leak / snapshot immutability), entitlement matrix (free vs Plus for walks/RSVP/journal/photo view/photo upload/radio quota).

Run `npm run lint && npm run build`; fix all introduced errors. No TODO/placeholder in security or financial paths.

## Final copy

Use the spec's final copy verbatim across Plus summary, processing costs, benefits list, one-time contribution, transparency status, equal-membership statement.

## Technical notes

- Stripe API version pinned by `stripe.server.ts` (2026-03-25.dahlia). Use `subscription.items.create/update/del` for donation item changes.
- 988 contribution product IDs configured per env (sandbox/live) in `membership_settings` or env vars — never hardcoded `"supporter"`.
- Server functions calling Stripe wrap errors via `getStripeErrorMessage` and return `{ error }` rather than throwing (per project rule).
- All new public-schema tables include GRANTs + RLS + policies in the same migration.
- `subscriptions` reads keep `.eq('environment', env)` filter everywhere.
