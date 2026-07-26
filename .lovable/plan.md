## Plan: Plus Copy Refinement + Wave 6 Launch QA

### Wave 0: Plus copy sweep (quick edit)

Update user-facing Plus messaging to lead with **MHWC Radio access** as the primary value, and frame the **$2.99 base as keeping the service running**. Anything above $2.99 remains designated to 988.

Files to update:
- `src/components/auth-form.tsx`
  - Signup subtitle under "Start your free month of Plus" → emphasize unlimited/expanded Radio + $2.99 keeps the service running.
  - Plus plan card helper text → lead with Radio, then service-running framing.
- `src/components/billing/plus-amount-picker.tsx`
  - JSDoc and subtext → "$2.99 keeps Plus (and Radio) running. Anything above goes to 988."
  - Preset labels → "base only" becomes "keeps Plus running" or similar.
- `src/components/membership/upsell-sheet.tsx`
  - CTA button → "Upgrade — $2.99/mo" plus maybe a micro-line about Radio.
- `src/components/billing/billing-card.tsx`
  - Any Plus description lines → align with Radio-first, service-running framing.

Copy principles:
- Lead with Radio access / MHWC Radio.
- $2.99 = service-running (not "base" or "keeps Plus running" in a vague way).
- Above $2.99 = 988 donation (unchanged).
- Keep it under 2 lines per surface.

### Wave 6: Launch QA

A focused, launch-blocking QA pass across the V1 surface. Goal: identify and fix anything that would break the first-time user flow or the Plus conversion flow before promoting the app.

#### 6.1 Security & RLS audit
- Review RLS policies on new donation/membership tables:
  - `donation_allocations`
  - `subscriptions`
  - `billing_events`
  - `radio_monthly_usage`
  - `membership_settings`
- Verify no table leaks PII or allows cross-user writes.
- Confirm `service_role` grants are present where edge functions/server functions need them.
- Spot-check `increment_radio_usage` RPC permissions and input validation.

#### 6.2 Critical user journey E2E verification
Run browser-driven checks for:
1. **Anonymous landing** → sees public walk grid, can view a walk, can tap to RSVP/sign up.
2. **Signup / onboarding** → Google OAuth, plan selector (Free/Plus), account creation.
3. **Create a walk** → form validation, weather strip, posting, sharing sheet.
4. **Share flow** → link copied / shared, guest RSVP preserved across signup.
5. **Group creation/join** → create group, invite link, membership list.
6. **Journal** → private entry create/read, prompt saved.
7. **Profile & follows** → directional follow, mutuals, public profile view.

#### 6.3 Plus billing journey
- Free user hits radio cap → upsell sheet opens.
- Upsell CTA → amount picker/checkout.
- Stripe checkout session created with correct base + donation metadata.
- Webhook persists subscription, donation cents, and dedication fields.
- Billing portal opens; cancel/resume/update amount flows work.
- `useMembership` returns correct `isPlus` / `donationCents` / `monthlyCents`.

#### 6.4 Radio free-tier enforcement
- Confirm `radio_monthly_usage` increments correctly during playback.
- Confirm cap is read from `membership_settings.radio_free_seconds`.
- Confirm non-Plus user is blocked at cap and shown UpsellSheet.
- Confirm Plus users bypass cap.
- Seed at least one track for the seeded station so the rail renders in QA.

#### 6.5 Mobile polish & responsive pass
- Audit `/index`, `/discover`, `/walks/new`, `/groups`, `/profile`, `/radio` on 390px viewport.
- Fix any overflow, tap-target, or bottom-sheet issues.
- Verify footer/tab bar composer button is visible and not overlapping.

#### 6.6 SEO / social metadata
- Every leaf route has unique `head()` with title, description, og:title, og:description, og:type, twitter:card.
- `/blog/*` uses article markdown excerpt for meta.
- `/walks/:id` public route includes walk title/description in meta when shared.
- Logo/social images use cache-busted `-v2` filenames.

#### 6.7 Error boundaries & fallback states
- Confirm global error boundary captures runtime errors.
- Confirm loading skeletons exist for async routes.
- Confirm empty states are helpful (especially `/discover` cold-start already built).

#### 6.8 Final copy & brand consistency sweep
- Remove any remaining "Supporter" references that should be "Plus" or "Legacy Supporter".
- Remove any stale solo-walk/step-tracking/mood-analysis copy.
- Ensure 988 disclaimer appears where donations are mentioned.

#### 6.9 Build & type check
- `bun run build` passes.
- `tsgo` or typecheck passes.
- No runtime errors in console during E2E checks.

### Deliverables
- Updated Plus copy in the listed components.
- A short launch-readiness report: what passed, what was fixed, any remaining non-blockers.
- If anything is broken, a follow-up plan to fix before publish.

### Open question
Do you want me to treat Wave 6 as a full "fix everything" pass, or a read-only audit with a separate plan for fixes? I recommend fixing small issues inline and surfacing larger ones for approval.