## What changes

### 1. Settings membership buttons
In `src/components/billing/billing-card.tsx` (the not-yet-Plus state), change the CTA from **"Become a supporter"** → **"Join now"**. The Supporter card's "Give monthly" stays as-is.

### 2. Rewrite Walk Club Plus copy (human, specific to the actual product)
Replace the current generic line ("Unlimited circles, custom walk pages, and Plus playlists. 50% of every dollar funds our nonprofit partner.") with copy that reflects what Plus actually unlocks today and reads like a copywriter wrote it — not a feature list.

Proposed (open to your edit):

> **Walk Club Plus**
> Walk more, scroll less. Plus opens up unlimited circles for the people you actually want to walk with, a custom page for every walk you host, and the full Listen library — calming playlists, podcasts, and reads to take on the trail.
> *$1.99/month. Half of every dollar goes straight to the 988 Suicide & Crisis Lifeline. Cancel anytime.*

### 3. Name 988 as the beneficiary everywhere
Replace "nonprofit partner" / "our nonprofit" wording with "the **988 Suicide & Crisis Lifeline**" (or "988" on second mention) across:
- `src/components/billing/billing-card.tsx` (the new copy above)
- `src/components/billing/supporter-card.tsx` ("100% of profits fund our nonprofit partner" → "100% of profits go to the 988 Suicide & Crisis Lifeline")
- `src/components/billing/supporter-amount-picker.tsx`
- `src/routes/impact.tsx` (page copy, default `organization_name` shown in UI)
- `src/lib/auth-prompt.tsx`, `src/components/auth-form.tsx`, `src/routes/auth.tsx` — any inline Plus/Supporter pitch
- `src/routes/terms.tsx`, `src/routes/privacy.tsx` — only the descriptive sentence, not legal terms

I will **not** change the default `organization_name` value stored in past `impact_donations` rows or the admin default — only the user-facing strings. The admin recompute form will still let you pick the org name per period.

### Out of scope
- No DB/migration changes.
- No Stripe product changes.
- Transparency / receipts page still deferred.

### Files touched
`src/components/billing/billing-card.tsx`, `supporter-card.tsx`, `supporter-amount-picker.tsx`, `src/routes/impact.tsx`, `src/lib/auth-prompt.tsx`, `src/components/auth-form.tsx`, `src/routes/auth.tsx`, `src/routes/terms.tsx`, `src/routes/privacy.tsx`.
