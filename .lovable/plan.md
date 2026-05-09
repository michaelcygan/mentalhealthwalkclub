## Stripe billing for Plus ($4.99/mo, 30-day free trial)

Use Lovable's built-in Stripe payments with **full compliance handling** (Stripe is the merchant of record — handles tax calculation, collection, filing, remittance, and chargebacks globally). Adds ~3.5% per transaction on top of base Stripe fees.

### 1. Enable Stripe + create the product
- Call `enable_stripe_payments` to provision the test environment.
- Create a single Stripe product **"Walk Club Plus"** with a recurring price of **$4.99/mo**, a **30-day free trial**, and a tax code matching digital wellness/SaaS (looked up against Stripe's tax-code catalog — not hardcoded).

### 2. Database — `subscriptions` table (migration)
Track each user's Plus state, synced from Stripe webhooks (Stripe is source of truth):
- `user_id` (unique, FK to auth.users via id)
- `stripe_customer_id`, `stripe_subscription_id`
- `status` (`trialing` | `active` | `past_due` | `canceled` | `incomplete`)
- `current_period_end`, `trial_end`, `cancel_at_period_end`
- RLS: user can `SELECT` their own row; only the service role (webhook) writes.
- Helper SQL function `public.is_plus(user_id)` returning true when status ∈ (`trialing`,`active`).

### 3. Server functions (`src/lib/billing.functions.ts`)
- `createCheckoutSession` — protected by `requireSupabaseAuth`. Creates/reuses a Stripe Customer keyed off the user's id, then opens a Checkout Session in `subscription` mode with `managed_payments: { enabled: true }` (full compliance), 30-day trial, success → `/welcome?upgraded=1`, cancel → `/`.
- `createBillingPortalSession` — opens Stripe's hosted portal so users can update card / cancel.
- `getMySubscription` — returns the row from `subscriptions` for UI gating.

### 4. Webhook (`src/routes/api/public/stripe-webhook.ts`)
- Verify `stripe-signature` with `STRIPE_WEBHOOK_SECRET`.
- Handle `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed` → upsert `subscriptions` via `supabaseAdmin`.
- Returns 200 fast; logs failures.

### 5. UI wiring
- **Welcome dialog**: "Start your 1-month free trial" → sign up first, then on first auth, if `wc_plan_intent === "plus"`, call `createCheckoutSession` and redirect to Stripe Checkout. Free path is unchanged.
- **`useSubscription()` hook** wrapping `getMySubscription` for gating.
- **Plus-gated features** (in-person Local Walk RSVPs, unlimited Walk & Talks beyond 5/mo): show an upgrade sheet for free users with a "Start free trial" button.
- **Profile → Billing**: shows current plan, trial-ends date, "Manage billing" button → portal.

### 6. Going live (later, your action)
- Claim the Stripe account and complete verification in the Lovable Cloud dashboard.
- Flip checkout sessions from `sandbox` to `live` (env-driven, no code change needed).

### Technical notes
- All Stripe SDK calls happen in server functions / server route — `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are never bundled to the client.
- Stripe is the source of truth; we never trust the client to mark a user as Plus.
- Free tier's "5 Walk & Talks/mo" limit is enforced separately (out of scope here — flag it if you want it in this pass).