
# Plus + Patron membership plan

## Direction

Two membership shapes, neither one gating the core product:

- **Plus** — $1.99/mo or $19/yr. The functional tier: unlimited Circles/Groups/Trails today, plus gentle unlocks for the new Listen/Home surfaces.
- **Patron** — name-your-price monthly donation ($3+ minimum). The mission tier. Stacks on top of Plus or stands alone. Bigger nonprofit share, Founding badge, early access. No extra feature gates.

Soft caps on free stay gentle — value-led conversion, not friction.

## What Plus gates (existing + new)

Already enforced server-side:
- Unlimited Circles (free cap)
- Unlimited private Groups (free cap)
- Unlimited Saved Trails (free cap)

New gentle nudges (added this round):
- **Saved reads** — free cap 15, Plus unlimited
- **Custom playlists** — free cap 3, Plus unlimited
- **Follow collections** — free cap 5, Plus unlimited
- **Best walking window** — free shows today; Plus shows the 7-day window with hourly precision
- **Walk recap share cards** — Plus unlocks themes + remove watermark
- **Journal export** — Plus only

Every cap surfaces a soft upsell sheet (not a hard wall) with a "Maybe later" dismiss. Caps are enforced server-side too (re-using `isPlus`/`requirePlus` from `plus-guard.server.ts`).

## What Patron unlocks

Mission-aligned, not feature-gating:
- Founding Patron badge on profile + on every walk/post (small leaf icon)
- Listed (optional) on `/impact` Patron wall
- Patron-only monthly thank-you email with impact recap
- Early access flag (`is_patron_early_access`) for opt-in beta features
- 80% of every Patron dollar to nonprofit (vs 50% for Plus) — explicit in copy

Patron does **not** imply Plus. Two separate subscriptions. UI nudges Patrons to add Plus if they hit a cap.

## Checkout & upgrade flow

### Plan picker

`PlusCheckout` dialog gets a segmented control: **Monthly $1.99** / **Yearly $19** (save 20%, "1 month free"). Yearly already exists in `billing.functions.ts` as `plus_yearly` — just needs to be exposed and registered as a Stripe price.

### Patron flow

New `PatronCheckout` component using Stripe `price_data` with `recurring: { interval: "month" }` and a custom `unit_amount` chosen by the user. Embedded checkout, same look as Plus.

Entry points:
- `/impact` page primary CTA: "Become a Patron"
- Profile → Billing card: "Give monthly" link under Plus card
- After Plus purchase success screen: "Want to give more? Become a Patron"

Amount picker: $3 / $5 / $10 / $25 chips + custom field. Minimum $3 (covers Stripe fee floor).

### Billing card

`billing-card.tsx` becomes two stacked sub-cards:
1. **Plus** — current behavior, with new "Switch to yearly" CTA when monthly
2. **Patron** — shows current amount + "Change amount" / "Pause" / "Cancel" actions

Both use the same Stripe billing portal underneath.

## Admin

`/admin/membership` (new route under existing admin layout):
- Tier breakdown: free / Plus monthly / Plus yearly / Patron (by amount bucket)
- MRR + nonprofit-share running total (live from `billing_events`)
- Toggle: pause Patron signups, edit minimum amount, edit suggested amounts
- Toggle: pause/resume each free cap (in case we want to A/B loosen)
- Read-only list of recent Patron subscribers (with opt-in-to-wall flag)

Cap thresholds (saved reads 15, playlists 3, collections 5) live in a `membership_settings` row so admin can tune without a deploy.

## Telemetry

Extend `billing-analytics.ts` event vocabulary:
- `patron_intent_selected`, `patron_amount_chosen`, `patron_checkout_opened`, `patron_subscribed`
- `cap_hit` with `{ surface: "saved_reads" | "playlists" | ... , action: "upsell_shown" | "dismissed" | "converted" }`
- `plan_switch_yearly_clicked`, `plan_switch_yearly_completed`

Insights dashboard (existing `/admin/insights`) gets a "Membership" panel: cap-hit funnel, conversion by surface.

## Technical details

### Schema (one migration)

- `membership_settings` — singleton row (`id boolean primary key default true`) with `saved_reads_cap`, `playlists_cap`, `collections_follow_cap`, `patron_min_cents`, `patron_suggested_amounts int[]`, `patron_signups_paused boolean`
- `patron_profile` — `user_id`, `display_on_wall boolean`, `early_access boolean`, `joined_at` (filled from webhook)
- Add `tier` derived column logic via SQL helper `public.user_membership(uuid)` returning `{ is_plus, is_patron, patron_cents, plan }`

Existing `subscriptions` table reused for both Plus and Patron rows. Distinguish via `price_id` prefix: `plus_*` vs `patron_*` (Patron uses dynamic `price_data` — store `"patron_custom"` in `price_id` and `unit_amount` in a new `monthly_amount_cents` column on `subscriptions`).

RLS: `membership_settings` readable by `anon` + `authenticated`, writable by admin role only. `patron_profile` readable by anyone (for wall), writable by owner.

### Server functions

New in `src/lib/billing.functions.ts`:
- `createPatronCheckoutSession({ amountCents, returnUrl, env })` — embedded checkout, dynamic `price_data`, `subscription_data.metadata: { userId, kind: "patron" }`
- `updatePatronAmount({ amountCents, env })` — cancels current and creates new subscription (Stripe portal route)
- `getMembershipState()` — returns `{ isPlus, isPatron, patronCents, planInterval }` for one client call

New in `src/lib/plus-guard.server.ts`:
- `requireUnderCap(supabase, userId, { surface, currentCount })` — central helper used by the new soft-cap call sites

### Webhook updates

`src/routes/api/public/payments/webhook.ts` — when `subscription.metadata.kind === "patron"`, insert/update with `price_id = "patron_custom"`, set `monthly_amount_cents` from the line item's unit_amount, and populate/refresh `patron_profile`.

### Components

- `src/components/billing/plan-picker.tsx` — monthly/yearly segmented control
- `src/components/billing/patron-checkout.tsx`
- `src/components/billing/patron-amount-picker.tsx`
- `src/components/billing/patron-card.tsx`
- `src/components/membership/upsell-sheet.tsx` — generic soft-cap sheet (title, body, CTA, "maybe later")
- `src/components/membership/founding-badge.tsx` — small leaf icon used everywhere a user is rendered
- `src/hooks/use-membership.ts` — superset of `use-subscription.ts`, exposes Plus + Patron flags

### Routes

- `src/routes/admin.membership.tsx` — new admin route
- `src/routes/impact.tsx` — add Patron section + (optional) wall
- `src/routes/_authenticated/profile.tsx` — billing card renders both sub-cards

### Stripe products

Need to create:
- `plus_yearly` price ($19) on existing `plus` product (one-time setup via `payments--create_price`)
- `patron` product (no fixed price — dynamic via `price_data`)

Compliance handling (`managed_payments: { enabled: true }`) stays on for both; Stripe handles tax/fraud/disputes.

## Out of scope

- Mid-cycle Plus → Patron prorating (use end-of-period switch)
- Gift Plus / Patron
- One-time donations (Patron is recurring only)
- Family / Duo plan
- Wall moderation tools beyond the opt-in flag
