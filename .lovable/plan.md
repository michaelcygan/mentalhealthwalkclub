Current state of Wave 5:

- 5C Admin ledger + batch tooling — DONE. `src/lib/admin-donations.functions.ts`, `src/routes/admin.donations.tsx`, and the Admin nav link are live.
- 5B Billing portal + settings surfacing — DONE. `src/routes/settings.tsx` renders `BillingCard`, which already opens the Stripe portal, changes the monthly amount, and handles cancel/resume.
- 5A Dedications on recurring Plus — NOT DONE. `PlusAmountPicker` has no dedication UI, `createPlusCheckoutSession` does not accept dedication fields, and `handleSubscriptionUpsert` never writes them to the `subscriptions` row. The webhook's `handleInvoicePaid` already reads those columns and copies them to `donation_allocations`, so only the upstream wiring is missing.
- 5D Plus perks enforcement (Radio) — NOT DONE. `RadioRail` starts stations without checking the free-tier cap or recording usage. `increment_radio_usage(_user uuid, _seconds integer)` exists and is `SECURITY DEFINER`; `membership_settings.radio_free_seconds` is public-readable.
- 5E Retire legacy "Supporter" branding — PARTIAL. User-facing Supporter copy still appears in `admin.membership.tsx`, `analytics-admin.functions.ts`, `founding-badge.tsx`, `auth-prompt.tsx`, and `impact.tsx`.

Wave 5 finish plan

5A. Dedications on recurring Plus
1. Extend `PlusAmountPicker` with an optional "Dedicate this gift" block: dedication type, honoree name, message, display-publicly toggle, and public donor name. Reuse patterns from `OneTimeContributionSheet`.
2. Update `createPlusCheckoutSession` in `src/lib/billing.functions.ts` to accept the dedication fields and attach them to both checkout `metadata` and `subscription_data.metadata`.
3. In `src/routes/api/public/payments/webhook.ts`, update `handleSubscriptionUpsert` to map the subscription metadata into the `subscriptions` columns (`dedication_type`, `honoree_name`, `dedication_message`, `public_donor_name`, `display_donation_publicly`). `handleInvoicePaid` will then copy them into the immutable ledger.
4. Optional: allow editing the dedication in the `BillingCard` change-amount dialog by updating subscription metadata via `updatePlusDonationAmount`.

5D. Radio free-tier enforcement
1. Before `startStation` in `RadioRail`, read the current user's `radio_monthly_usage` and `membership_settings.radio_free_seconds`. If the user is not Plus and the cap is reached, show a soft paywall sheet instead of playing.
2. During playback, call `supabase.rpc("increment_radio_usage", { _user: user.id, _seconds: elapsed })` every ~60 seconds and on track end. Plus users get no cap but still record usage for analytics.
3. Subscribe to realtime changes on `radio_monthly_usage` so the UI updates as usage grows.

5E. Final Supporter-branding sweep
1. Replace user-facing "Supporter" copy in `admin.membership.tsx`, `analytics-admin.functions.ts`, `founding-badge.tsx`, `auth-prompt.tsx`, and `impact.tsx` with "Plus" / "Walk Club Plus" where appropriate.
2. Keep internal column names (e.g. `supporter_min_cents`) unchanged; only user-facing strings change.
3. Leave generated `src/integrations/supabase/types.ts` untouched.

Wave 6 — Launch QA pass (no new features)

1. RLS audit on `donation_allocations`, `donation_transfer_batches`, `radio_monthly_usage`, `subscriptions`, and `membership_settings`: anon only reads published batches and the redacted feed; authenticated users only read their own rows; admin bypasses via `has_role`.
2. Refund/dispute round-trip in sandbox: simulate `charge.refunded` and `charge.dispute.created`; confirm allocations flip status and `transparency_totals` recomputes.
3. Guest one-time end-to-end: sandbox charge on `/contribute`; verify the row appears on `/transparency` with correct dedication redaction.
4. Environment filter sweep: every `subscriptions` read filters `.eq('environment', getStripeEnvironment())`.
5. Grants check on any table touched by anon transparency reads.
6. Copy pass on `/transparency`, `/contribute`, `/impact`, and settings: make the "$2.99 covers costs, everything above is designated to 988" story unmistakable and legally accurate.

Technical notes

- No new tables required.
- All Stripe calls continue through `createStripeClient(env)`.
- Radio usage uses the existing `public.increment_radio_usage(_user, _seconds)` RPC (SECURITY DEFINER).
- Changes stay inside existing files; no new routes.