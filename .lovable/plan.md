## Wave 3: Stripe webhook + immutable allocation accounting

Wave 2 is complete — checkout, hook, billing UI, and amount-change flow are wired to the unified base + donation model. Moving to Wave 3, which is entirely webhook + ledger work. No user-facing UI changes here.

### Goal
On every successful Plus renewal (and one-time contribution), post a single immutable row to `donation_allocations` splitting the invoice into $2.99 (membership) and the delta (988 designation). Also mirror the current donation amount onto the subscription row so the app can render it without recomputing.

### Changes

**1. `src/routes/api/public/payments/webhook.ts` — expand handler**
- Handle new events:
  - `invoice.paid` (or `invoice.payment_succeeded`) — write ledger row + refresh subscription mirror fields.
  - `charge.refunded` / `charge.dispute.created` — mark matching allocation as `refunded` / `partially_refunded` / `disputed`.
- On `customer.subscription.created` / `.updated`:
  - Detect the donation line item by product (resolve `plus_donation` product ID via `stripe.products.list({...})` cached in-module).
  - Compute `base_cents = 299`, `donation_cents_monthly = donation_item.price.unit_amount || 0`, `monthly_amount_cents = 299 + donation`.
  - Write these to `subscriptions` (`base_cents`, `donation_cents_monthly`, `monthly_amount_cents`, `stripe_base_item_id`, `stripe_donation_item_id`, `selected_total_cents`, `allocation_model_version = 'v2_unified'`).
  - Drop legacy `supporter_profile` mirroring — retired in Wave 2.
- Retire `kind === "supporter"` branch. Everything is `plus` in v2.

**2. Ledger write logic (new `handleInvoicePaid`)**
- Idempotency: unique key is `stripe_event_id` (already unique in schema). Use `upsert` with `onConflict: "stripe_event_id"` and `ignoreDuplicates: true`.
- Skip invoices where `billing_reason` is `subscription_create` AND `amount_paid = 0` (trial signup, already retired but defensive).
- For each paid invoice on a Plus subscription:
  - `gross_payment_cents = invoice.amount_paid`
  - `membership_allocation_cents = min(299, gross)` (base always $2.99)
  - `donation_allocation_cents = max(0, gross - 299)`
  - Copy dedication/public-donor fields from the subscription row so the transparency feed can render them PII-safely.
  - `source = 'plus_overage'` when donation > 0, `'legacy_plus_commitment'` otherwise.
  - `status = 'designated'`, `paid_at = invoice.status_transitions.paid_at * 1000`.
  - `stripe_payment_intent_id` / `stripe_charge_id` from `invoice.charge` and `invoice.payment_intent`.

**3. Refund + dispute handling**
- `charge.refunded`: look up the allocation by `stripe_charge_id`. If `amount_refunded == amount`, set `status = 'refunded'`; otherwise `'partially_refunded'`. Preserve the original amounts (immutable) — status change only.
- `charge.dispute.created`: set `status = 'disputed'`. Dispute won → keep `'disputed'` (admin later moves to `'reversed'` via Wave 6 admin flow, not automated).
- Both refuse to touch rows already in a transfer batch (`transfer_batch_id IS NOT NULL`) — log a warning; batches are immutable once cut. Wave 6 handles clawback accounting.

**4. Idempotency + ordering guards**
- Keep existing `last_event_at` guard on subscription upserts.
- Ledger uses `stripe_event_id` uniqueness — retries are safe.
- Wrap each event handler in try/catch so one failure doesn't 400 the whole webhook (Stripe will retry the failed one via a separate event).

**5. Nothing changes on the client**
No UI, hook, or route edits in this wave. `useMembership` already reads `donation_cents_monthly` and `monthly_amount_cents` from the subscription row — the webhook simply starts populating them.

### Verification after build
- Load `invoke-server-function` against the webhook URL with a signed test payload from Stripe CLI (sandbox) → confirm one `donation_allocations` row per invoice with correct split.
- Run `SELECT * FROM public.transparency_totals('sandbox')` after seeding a test subscription — expect `designated_cents` to increase by exactly the donation delta.
- Force a partial refund via Stripe CLI and check the allocation status flips to `partially_refunded` while amounts stay untouched.

### Explicitly out of scope for Wave 3
- Transparency page UI (Wave 4).
- One-time contribution checkout (Wave 4).
- Admin transfer batching (Wave 6).
- Any schema changes — Wave 1 already provisioned every column and index this handler needs.
