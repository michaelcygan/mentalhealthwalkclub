# Finish Plus + Patron integration

A focused second pass to complete what the first pass scaffolded. No new tiering concepts — just wiring the existing pieces into the live flows and verifying.

## 1. Enforce free-tier soft caps (gentle nudges)

Use the existing `requireUnderCap` guard from `src/lib/plus-guard.server.ts` and surface `UpsellSheet` on the client when the server returns the cap error.

- **Saved reads** (`src/lib/saved-reads.functions.ts`): call `requireUnderCap("saved_reads")` in the create/save mutation.
- **Playlists** (`src/lib/playlists.functions.ts`): call `requireUnderCap("playlists")` in the create-playlist mutation.
- **Collections followed** (`src/lib/collections.functions.ts`): call `requireUnderCap("collections_follow")` in the follow mutation.

Client side: catch the typed cap error in the three call sites (saved-reads list/button, playlist create dialog, collection follow button) and open `<UpsellSheet/>` with the matching reason copy. Plus users bypass automatically (guard returns early).

## 2. "Switch to yearly" on the active billing card

`SwitchToYearlyDialog` already exists in `src/components/billing/plan-picker.tsx`. Wire it up:

- Add a `switchToYearly` server fn in `src/lib/billing.functions.ts` that finds the user's active monthly Plus sub and calls Stripe `subscriptions.update` with the yearly price + `proration_behavior: "always_invoice"`.
- In `src/components/billing/billing-card.tsx`, when `useMembership()` reports `plusInterval === "monthly"`, show a "Switch to yearly · save $4.88" button that opens the dialog and calls the new fn. Toast on success and `refresh()` membership.

## 3. Founding badge across the app

Render `<FoundingBadge/>` next to patron display names. Add a tiny `usePatronIds()` hook that fetches `patron_profile` rows where `display_on_wall = true` once and caches in React Query, then drop the badge into:

- `src/components/discover/friends-going-row.tsx` (attendee names)
- `src/components/walk-page/attendee-stack.tsx` (hover/long-press name)
- `src/components/discover/circle-row.tsx` (member names)
- `src/routes/profile.tsx` header (own profile, if patron)

Badge is the small leaf chip — non-intrusive, title="Founding Patron".

## 4. Admin polish

- In `src/routes/admin.membership.tsx`, derive the env tile filter from `getStripeEnvironment()` instead of `window.__env`.
- Add a "Pause Patron signups" check in `createPatronCheckoutSession` so the toggle actually blocks new checkouts (existing patrons unaffected).

## 5. Verify

- `invoke-server-function` the three guarded mutations as a free user to confirm the cap error shape, then as a Plus user to confirm bypass.
- Smoke `createPatronCheckoutSession` (sandbox) at $5/mo and confirm the webhook writes `patron` row + `patron_profile`.
- Hit `createSwitchToYearly` against a sandbox monthly sub and confirm `price_id` flips to `plus_yearly` in the `subscriptions` table.
- Inspect `/impact`, `/settings`, `/admin/membership` in the preview to confirm no console errors.

## Out of scope

- No new tiers, no price changes, no new products.
- No copy overhaul on the upsell sheet beyond reason-specific lines.
- No changes to the auth flow.
