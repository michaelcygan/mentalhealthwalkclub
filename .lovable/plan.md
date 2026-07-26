
# Wave 2 — Unified Plus Checkout

Goal: one Stripe subscription per member with two line items — a fixed $2.99 base and a variable donation delta. Retire Supporter, yearly, and the 30-day trial from the new-user flow. Every dollar above $2.99 is designated to 988 in the ledger created in Wave 1.

## Mental model

- Plus is $2.99/month, monthly only, no trial.
- Members may voluntarily pay more; extra amount is the "donation" line item.
- Ledger row is written on invoice paid (webhook, Wave 3) — base stays, donation is designated to 988.
- One subscription per user. If they already have one, they change the amount via portal / "change amount", not a new checkout.

## Server changes — `src/lib/billing.functions.ts`

Rewrite the checkout + management surface. Preserve `resolveOrCreateCustomer`, portal, resume.

1. **`createPlusCheckoutSession`** (rewrite)
   - Input: `{ returnUrl, environment, donationCents }` where `donationCents >= 0`, integer, `<= 100_000`.
   - Reject if the user already has any active/trialing/past_due Plus subscription (all kinds).
   - Build session with two `line_items`:
     - Base: `price_data` recurring monthly, `unit_amount: 299`, product = existing `plus` product (lookup via `plus_monthly_v2` price → its product), `nickname: "Plus base"`.
     - Donation (only if `donationCents > 0`): `price_data` recurring monthly, `unit_amount: donationCents`, product = new `plus_donation` product ID, `nickname: "988 designation"`.
   - `mode: "subscription"`, `ui_mode: "embedded_page"`, no `trial_period_days`.
   - `metadata`: `{ userId, kind: "plus", base_cents: "299", donation_cents: String(donationCents) }`.
   - `subscription_data.metadata`: same keys — the webhook (Wave 3) reads these to split ledger amounts.
   - `managed_payments: { enabled: true }` retained.

2. **`updatePlusDonationAmount`** (new)
   - Input: `{ environment, donationCents }`, same validation.
   - Loads the user's active Plus subscription, finds the donation item (by product id) — adds, updates `unit_amount`, or removes it.
   - Uses `stripe.subscriptions.update` with `items: [...]` and `proration_behavior: "always_invoice"`. Base item is left untouched.

3. **Retire**
   - Delete `createSupporterCheckoutSession`, `switchPlusToYearly`.
   - Delete `PlusPlan` type and yearly branches. `getMembershipState` stops reading `plus_interval` / `supporter_cents` and just returns `{ isPlus, monthlyCents }` derived from `subscriptions` (base + donation summed).
   - Update `getMembershipSettings` return shape: drop supporter fields, keep caps.

4. **Stripe products**
   - Add a one-time note in the plan (not code): after approval we'll call `payments--create_product` for `plus_donation` (name "988 Designation") so `price_data.product` resolves. Base product reuses the existing `plus` product.

## Client changes

1. **`src/lib/stripe.ts`** — remove `PLUS_TRIAL_DAYS`, keep `PLUS_PRICE_ID` reference only if still used; likely delete.

2. **`src/components/billing/plus-checkout.tsx`** — accept `donationCents` prop instead of `plan`, pass through to server fn. Drop `plan` key remount; remount on `donationCents` change instead.

3. **New: `src/components/billing/plus-amount-picker.tsx`**
   - Presets: $2.99 (base only), $5, $10, $25 + custom input.
   - Copy: "$2.99 keeps Plus running. Anything above goes to 988." Shows the split (e.g. "$5.00 = $2.99 base + $2.01 to 988").
   - Emits `donationCents` (chosen total − 299, min 0).
   - Used inside the upgrade sheet before mounting `<PlusCheckout>`.

4. **`src/components/billing/billing-card.tsx`**
   - Show current monthly (base + donation) and "Contributing $X.XX/month to 988".
   - "Change amount" opens the picker → calls `updatePlusDonationAmount` (no new checkout).
   - Remove yearly-switch CTA, remove Supporter section entirely.

5. **`src/components/billing/plan-picker.tsx`** — delete (yearly toggle no longer needed). Replace usages with the amount picker.

6. **`src/components/billing/supporter-*.tsx`** — delete: `supporter-amount-picker.tsx`, `supporter-card.tsx`, `supporter-checkout.tsx`.

7. **`src/lib/auth-prompt.tsx` / upgrade sheets** — replace "Start 30-day trial" copy with "Join Plus — $2.99/mo". Any "Supporter" CTA is removed.

8. **`src/hooks/use-membership.ts`** — align to new `getMembershipState` shape (`isPlus`, `monthlyCents`); drop `isSupporter`, `plusInterval`.

9. **`src/lib/billing-analytics.ts`** — drop `supporter_*`, `plan_switch_yearly_*` event types. Add `plus_amount_chosen`, `plus_amount_updated`.

## Route touch-ups

- `src/routes/welcome.tsx` and any post-checkout return handling: unchanged behavior, but copy no longer mentions trial.
- `src/routes/settings.tsx` (billing area) — uses new billing-card; no other change.
- Admin membership page (`admin.membership.tsx`) — remove supporter/yearly columns; show base + donation totals.

## Out of scope for Wave 2

- Webhook ledger writes (Wave 3).
- Transparency page UI (Wave 4).
- Radio JIT signing / usage caps (later wave).
- Any migration of the legacy `impact_donations` row (staying as-is; audit already confirmed 0 live subs).

## Technical notes

- Sandbox and live both need the `plus_donation` product; `payments--create_product` syncs to live on publish.
- Base + donation as separate items keeps the ledger split trivial in the webhook: each invoice line's `price.product` tells us which bucket.
- `proration_behavior: "always_invoice"` ensures amount changes bill immediately and produce a webhook we can ledger.
- No DB migration needed this wave — Wave 1 already added `subscription_kind`, `base_cents`, `donation_cents_monthly`, etc.

Reply "continue" to implement.
