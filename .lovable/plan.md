# Wave 4 — Transparency Page & One-Time Contributions

Builds on Waves 1–3 (ledger + webhook are live). Goal: expose the immutable allocation data publicly and let anyone (signed in or not) make a one-time 988-designated contribution.

## 1. Public transparency route

New route: `src/routes/transparency.tsx` (public, indexable, own `head()` with title/desc/og).

Sections:
- Hero: plain-language explanation of the $2.99 split ($2.99 → MHWC, everything above → 988 Suicide & Crisis Lifeline).
- Totals strip: pulls `transparency_totals` SECURITY DEFINER fn (lifetime designated, lifetime transferred, pending balance, active Plus contributors count).
- Transfer batches table: last N rows from `donation_transfer_batches` where `status = 'completed'` — date, amount, reference URL/note. Empty state explains "first transfer will appear here after our initial batch."
- Recent designations feed: `transparency_feed` fn — timestamp, amount, optional dedication line (honoree first name only, PII-safe). Paginated (load more, 25/page).
- FAQ accordion: "Where does the money go?", "How often are transfers made?", "Can I cancel?", "Is my dedication public?".
- Footer CTA: "Contribute once" + "Become a Plus member".

Data access: two new server fns in `src/lib/transparency.functions.ts` (unauthenticated, use server publishable client per template rules):
- `getTransparencyTotals()` → wraps `transparency_totals` rpc.
- `listTransparencyFeed({ cursor, limit })` → wraps `transparency_feed` rpc.

Wire with `queryClient.ensureQueryData` in the route loader + `useSuspenseQuery` in the component.

## 2. Footer/nav link

Add "Transparency" link in the site footer (root layout footer component) and inside the `impact.tsx` route so members can jump from their dashboard.

## 3. One-time contribution flow

New server fn `createOneTimeContributionSession` in `src/lib/billing.functions.ts`:
- Input: `amount_cents` (min 100, max 100000), optional `dedication_name`, `dedication_message`, `dedication_visibility` ('public' | 'anonymous'), optional `email` for guest checkout.
- Creates a Stripe Checkout Session in `payment` mode with a single ad-hoc line item (`price_data`, product = existing `plus_donation` product's 988 designation, or a new `one_time_988` product — will use existing `plus_donation` product with `price_data`).
- Metadata: `kind=one_time_988`, dedication fields, `user_id` if authenticated.
- Success URL → `/transparency?contribution=success`, cancel → `/transparency?contribution=cancelled`.

Webhook update in `src/routes/api/public/payments/webhook.ts`:
- Handle `checkout.session.completed` where `metadata.kind === 'one_time_988'`:
  - Insert a `donation_allocations` row with `membership_allocation_cents = 0`, `donation_allocation_cents = amount_total`, `kind = 'one_time'`, dedication fields copied from metadata, `subscription_id = null`, `stripe_event_id` idempotency key.
- Handle `charge.refunded` for one-time rows the same way subscription refunds are handled.

New UI component `src/components/billing/one-time-contribution-sheet.tsx`:
- Amount picker (preset chips: $5 / $10 / $25 / $50 / custom).
- Optional dedication fields (name, short message, public/anonymous toggle) — copy explains only first name shows publicly.
- Guest email field when not signed in.
- Launches Stripe Embedded Checkout on submit.

New route: `src/routes/contribute.tsx` — thin wrapper that mounts the sheet inline (also linked from the transparency CTA). Public. Own SEO head.

## 4. Impact/settings integration

- `src/routes/impact.tsx`: add "Contribute once" secondary CTA next to the Plus CTA.
- `src/components/billing/billing-card.tsx`: small link under the picker: "Prefer to give once? →" → opens the one-time sheet.

## 5. QA / verification

- Build check.
- Manually invoke `getTransparencyTotals` and `listTransparencyFeed` via `stack_modern--invoke-server-function` to confirm shape.
- Confirm SECURITY DEFINER functions never leak `stripe_customer_id`, `email`, or full names — only first-name dedication + amount + timestamp.
- Check that `/transparency` renders unauthenticated (no `requireSupabaseAuth` on the fns, no protected loader).
- Verify webhook idempotency for a simulated `checkout.session.completed` replay (dedup by `stripe_event_id`).

## Out of scope (Wave 6)

Admin transfer batch creation UI, exporting CSVs, marking batches paid — that's the Wave 6 admin workflow. Wave 4 only reads batches; it doesn't create them.

## Technical notes

- All new server fns are public (no `requireSupabaseAuth`); one-time flow accepts guest email so anyone can contribute without an account.
- The `donation_allocations.kind` column already exists from Wave 1 (`'subscription' | 'one_time'`); no schema change needed if so — will verify before writing code, and add a lightweight migration only if missing.
- Uses existing Stripe `plus_donation` product with ad-hoc `price_data` — no new price object required for one-time.
- Route loaders use `context.queryClient.ensureQueryData` + `useSuspenseQuery` per template conventions.
