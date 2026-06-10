## Goal

1. Rename "Patron" → "Supporter" everywhere (UI + code + DB).
2. Change the policy from "80% funds our nonprofit partner" → "100% of profits go to our nonprofit partner" (real, not just copy).
3. Make each Supporter donation easy to see as a distinct line item in Stripe so you can reconcile donations vs. Plus subscription revenue at any cadence.
4. Note a future Transparency page with linked receipt PDFs (no code this turn).

---

## 1. UI / copy rename (Patron → Supporter)

Update all user-facing strings in:

- `src/components/billing/patron-card.tsx` — "Become a Patron" → "Become a Supporter"; "Giving $X/month"; tagline → **"Monthly donation. You choose the amount. 100% of profits fund our nonprofit partner."**
- `src/components/billing/patron-amount-picker.tsx` — footer line → "100% of profits go to our nonprofit partner. Cancel or change anytime."
- `src/lib/auth-prompt.tsx` — sheet titles, intent labels.
- `src/routes/impact.tsx` — wall heading "Patron wall" → "Supporter wall"; copy mentioning 80%.
- `src/routes/settings.tsx` — section labels.
- `src/routes/admin.membership.tsx` — tiles ("Patrons" → "Supporters", "Patron MRR" → "Supporter MRR"), labels, settings draft labels.
- `src/components/membership/founding-badge.tsx` — title "Founding Patron" → "Founding Supporter".

Also rename component files to keep the codebase tidy:
- `patron-card.tsx` → `supporter-card.tsx`
- `patron-amount-picker.tsx` → `supporter-amount-picker.tsx`
- `patron-checkout.tsx` → `supporter-checkout.tsx`

(Update all imports.)

## 2. Code identifier rename

- `useMembership` hook: rename `isPatron` → `isSupporter`, `patronCents` → `supporterCents`, `patronStatus` → `supporterStatus`. Update consumers (`patron-card`, `auth-prompt`, etc.).
- `auth-prompt.tsx`: `patronOpen` → `supporterOpen`, `openPatronFlow` → `openSupporterFlow`, localStorage `PLAN_INTENT_KEY` value `"patron"` → `"supporter"` (with one-time read of old `"patron"` value for backward compat).
- `billing-analytics.ts`: event names `patron_*` → `supporter_*` (also accept legacy patron_* server-side for already-emitted events; we just add new names going forward).
- `billing.functions.ts`: comments/labels.

## 3. Database rename (migration)

Single migration:
- Add new enum/text value `'supporter'` to `subscription_kind` usage. Since the column is `text` (not enum), just `UPDATE subscriptions SET subscription_kind='supporter' WHERE subscription_kind='patron'`.
- Update `normalizedPriceId` references: `'patron_custom'` → `'supporter_custom'` via `UPDATE subscriptions SET price_id='supporter_custom' WHERE price_id='patron_custom'`.
- Rename table `patron_profile` → `supporter_profile`. Update RLS policies + GRANTs to reapply on new name (ALTER TABLE … RENAME preserves them, but verify).
- Rename `membership_settings` columns: `patron_min_cents` → `supporter_min_cents`, `patron_suggested_amounts` → `supporter_suggested_amounts`, `patron_signups_paused` → `supporter_signups_paused`.
- Update `public.user_membership()` SQL function: return columns `is_supporter`, `supporter_cents`; filter `subscription_kind='supporter'`.

Update all server code that referenced the old names (`billing.functions.ts`, `impact.tsx`, `admin.membership.tsx`, `webhook.ts`, `patron-card.tsx`).

## 4. Real 100%-of-profits policy

In `src/lib/impact.functions.ts`:
- Change `const DONATION_PERCENT = 50;` → `100`. (Note: existing code already labels the field `donation_percent`; bumping to 100 means we donate 100% of estimated **net profit** for the period — gross minus Stripe fees, the same formula already used in `estimateNetCents`.) Recompute logic remains the same shape; just the percent changes.
- Admin recompute UI in `admin.insights.tsx` / `admin.membership.tsx` (if it shows 80%/50%) updated to show 100%.

## 5. Stripe distinguishability for Supporter donations

Goal: at a glance in the Stripe dashboard (or via Search API), you can see Supporter donations separately from Plus subscriptions.

Currently the Supporter checkout uses `price_data` with `product: "patron"` (a Stripe Product id) and stamps `metadata.kind=patron` on session + subscription. Improvements:

- Create a Stripe Product `supporter` via the payments tool (`payments--create_product`) named **"Supporter Donation"** with description "Monthly donation — 100% of profits routed to nonprofit partner." Use the human-readable id `supporter`.
- Update `createSupporterCheckoutSession` in `billing.functions.ts`:
  - `price_data.product: "supporter"` (replaces `"patron"`).
  - Add `subscription_data.description: "Supporter Donation"` so the Subscription object in Stripe shows a clear label (Stripe doesn't propagate this to renewal charges, but the Subscription list view will read cleanly).
  - Keep `metadata.kind="supporter"` on Session + Subscription + Customer for Search API queries (`subscriptions.search query="metadata['kind']:'supporter'"`).
  - Set `subscription_data.metadata.donation: "true"` for an even simpler filter.

After this, in Stripe you can:
- Filter the Subscriptions list by product = "Supporter Donation".
- Run `stripe.subscriptions.search({ query: "metadata['kind']:'supporter' AND status:'active'" })` to sum monthly donations programmatically.

(Old `kind=patron` subscriptions stay searchable too; we'll backfill them via Stripe's `subscriptions.update` to set `metadata.kind='supporter'` in a one-off admin script — call out separately if needed.)

## 6. Transparency page (future)

Not built this turn. Recorded for later:
- Extend `/impact` with a "Receipts" section.
- Add `receipt_pdf_url text` column to `impact_donations`.
- Admin uploads PDF to a new public Storage bucket `donation-receipts`; URL saved on the row.
- Render a "View receipt" link next to each published donation row.

---

## Files touched this turn

- DB migration: rename `patron_profile`, rename `membership_settings` columns, update `user_membership()`, data update on `subscriptions`.
- Renamed files: `src/components/billing/supporter-card.tsx`, `supporter-amount-picker.tsx`, `supporter-checkout.tsx`.
- Edited: `src/hooks/use-membership.ts`, `src/lib/auth-prompt.tsx`, `src/lib/billing.functions.ts`, `src/lib/billing-analytics.ts`, `src/lib/impact.functions.ts`, `src/routes/api/public/payments/webhook.ts`, `src/routes/settings.tsx`, `src/routes/impact.tsx`, `src/routes/admin.membership.tsx`, `src/components/membership/founding-badge.tsx`.
- Stripe: `payments--create_product` for the new `supporter` product.

## Out of scope

- Migrating already-active "patron" Stripe Subscriptions to the new product (Stripe doesn't allow product swap mid-subscription cleanly). They keep working under the old product; metadata-based reads still resolve them.
- Building the receipts/transparency page.
