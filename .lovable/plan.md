# Plan: Plus repricing, journal paywall, and client-side media compression

## 1. Reprice Plus to $2.99/mo and ~$29/yr

**New prices** (scaled proportionally from $1.99 / $19):
- Monthly: **$2.99** (299¢)
- Yearly: **$29** (2900¢) — ~$5.88 savings vs 12× monthly, ≈ 2 months free, ~$2.42/mo effective

**Stripe (test → auto-synced to live on publish):**
- Create new prices on the existing `plus` product with **new `lookup_key`s**: `plus_monthly_v2` and `plus_yearly_v2` (Stripe prices are immutable; reusing the old `lookup_key` requires deactivating the old price first, which we'll also do via the dashboard for cleanliness).
- Switch the app's `lookup_keys` to the v2 IDs everywhere we resolve a price (`src/lib/billing.functions.ts`, `src/lib/stripe.ts`, `src/components/billing/plus-checkout.tsx`, `src/components/billing/plan-picker.tsx`, `src/routes/admin.membership.tsx`, webhook normalization in `src/routes/api/public/payments/webhook.ts`).
- Existing subscribers stay on their grandfathered $1.99 / $19 price (Stripe doesn't change live subs when you add a new price). New checkouts and upgrades use v2.
- Webhook normalization keeps mapping `plus_monthly*` / `plus_yearly*` → interval label, so admin tiles still aggregate correctly across old + new subs.

**Copy updates (every $1.99 / $19 mention):**
- `src/components/billing/plan-picker.tsx` — MONTHLY_CENTS=299, YEARLY_CENTS=2900, switch-to-yearly dialog copy ("$29 charged today…").
- `src/components/billing/billing-card.tsx` — main Plus card price line + "Switch to yearly — save $X" button.
- `src/components/membership/upsell-sheet.tsx` — "Upgrade — $2.99".
- `src/components/auth-form.tsx` (2 spots) and `src/routes/auth.tsx` — onboarding pitches.
- `src/routes/terms.tsx` — pricing clause.
- `src/lib/impact.functions.ts` — fee comment recalculated against $2.99.

## 2. Journal paywall

Rule: **active journaling** (creating a journal entry yourself, and attaching photos to journal entries) is Plus. **Walk-derived** entries (auto-populated from a walk you completed/attended) remain free, including any photos uploaded during the walk flow.

**Server (`src/lib/journal-entries.functions.ts`):**
- Add a Plus check (`has_active_subscription` / read from `subscriptions` table) inside the create-entry serverFn. Allow the insert only if (a) the user is Plus, OR (b) the entry is marked `source = 'walk'` (system-created from a walk completion).
- For free users: block any entry where `photo_urls.length > 0` regardless of source = walk-source entries can still carry photos uploaded via the walk flow (those are inserted server-side from the walk completion path, not the journal write path).
- Return a clear `{ error: "plus_required" }` so the client can show the upsell.

**Client:**
- `src/components/home/reflection-write-sheet.tsx` and journal "new entry" entry points: if not Plus, swap the primary CTA for an upsell that opens `upsell-sheet` (Plus required to write a reflection).
- Same sheet: hide / disable the photo attach button for free users with a small "Plus" lock pill; tooltip "Add photos to journal entries with Plus."
- `src/routes/journal.tsx` / `entries-feed.tsx`: free users still see walk-sourced entries and their photos — no change to the read path.
- `auth-prompt.tsx` already exists; add a `journalWrite` / `journalPhoto` reason variant with copy: "Journaling and photo memories are part of Plus."

## 3. Client-side media compression before upload

Goal: shrink every user-uploaded image before it touches storage. Target ~1600px longest edge, WebP, quality ~0.82. Strip EXIF.

**New util: `src/lib/image-compress.ts`**
- `compressImage(file: File, opts?): Promise<File>` — uses `createImageBitmap` + `OffscreenCanvas` (fallback to `<canvas>`), `canvas.toBlob('image/webp', 0.82)`.
- Skips non-images and animated GIFs (passes through). Falls back to original if compression result is larger than original (rare for already-tiny images).
- Defaults: maxEdge 1600, quality 0.82, format `image/webp`. Returns a new `File` with `.webp` extension and `type: 'image/webp'`.

**Wire into upload call sites:**
- `src/routes/_authenticated/walk.index.tsx` (line ~211, walk-photos bucket).
- `src/components/walk-page/memory-strip.tsx` (line ~66, event-photos bucket).
- Future journal photo upload (Plus only) — use the same util.

**Bucket MIME:** confirm `walk-photos` and `event-photos` buckets allow `image/webp` (likely already permissive). If MIME is restricted, update via storage bucket settings.

## Out of scope (call out)
- No retroactive migration of existing user photos.
- No video compression (not currently uploading video).
- Existing $1.99 subscribers are grandfathered; no forced migration.

## Technical notes
- Stripe price creation will be done via the payments tool in build mode (`create_price` on existing `plus` product).
- The `subscriptions` table already has `price_id` denormalized from `lookup_key`, so admin tiles and `useMembership` keep working when new price IDs land.
- Compression util is pure browser code (no deps); WebP is supported in all evergreen browsers + iOS 14+.
