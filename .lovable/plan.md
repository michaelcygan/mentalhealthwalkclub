## What the last logo update did — and didn't — cover

The previous pass replaced the in-app logo, favicon suite, Apple touch icons, and PWA manifest icons with cache-safe `-v2` filenames. It also swapped a generic branded `og-default-v2.jpg` into every route's `og:image`, but that file was generated during Wave 7 (before the corrected artwork arrived) and still uses the older stamp. So: yes, a social share image exists, but it is NOT yet based on the authoritative corrected logo. That's the main gap.

## Plan

### 1. Generate a launch-ready OG social image (1200×630)

Design brief for the new `og-default-v3.jpg`:
- Warm cream background (`#f6efdf`, matches PWA icon backdrop) so it reads as MHWC across iMessage / X / IG / LinkedIn light+dark previews.
- Authoritative corrected black stamp logo, left-anchored, ~460px tall with safe padding.
- Right column: wordmark "Mental Health Walk Club" + tagline "Walk together. Feel better." in the site's serif/sans pairing already used in the header.
- Subtle forest-green accent rule under tagline; no photo, no gradients, no AI-looking abstract art — matches the calm editorial tone of the app.
- Export as JPG (smaller, universally supported by scrapers) at 1200×630.

Ship it via the CDN under a new versioned name (`og-default-v3.jpg`) so Twitter/Meta scrapers refetch instead of serving cached v2.

### 2. Wire the new image into every route's head()

Update the `OG_DEFAULT` constant in each of these leaf routes to the v3 URL, and confirm both `og:image` and `twitter:image` are set (per project head-meta rules — leaf routes only, never `__root`):

- `src/routes/index.tsx`
- `src/routes/auth.tsx`
- `src/routes/profile.tsx`
- `src/routes/journal.tsx`
- `src/routes/more.tsx`
- `src/routes/shop.tsx`
- `src/routes/impact.tsx`
- `src/routes/blog.tsx` and `src/routes/blog.$slug.tsx` (default; per-post covers stay as-is)
- `src/routes/g.$slug.tsx` (default; group covers stay as-is)
- `src/routes/groups.tsx`
- `src/routes/u.$username.tsx` (default; user avatars/covers stay as-is)
- `src/routes/w.$code.tsx` and `src/routes/w.$code.recap.tsx` (default)
- `src/lib/blogs.server.ts` fallback

### 3. Retire the stale asset

Delete `src/assets/og-default-v2.jpg.asset.json` via `lovable-assets delete` so the old CDN object is purged and no route can accidentally point back at it.

### 4. Quick audit of other final-branding touchpoints

While the OG refresh is the main ask, these are the remaining surfaces that carry the logo/brand and are worth a glance for launch:

| Surface | File | Status | Action |
|---|---|---|---|
| In-app stamp component | `src/components/logo-stamp.tsx` | Uses v2 asset | ✅ Correct |
| Loading screen breathing logo | `src/components/loading-screen.tsx` | Uses v2 public path | ✅ Correct |
| Favicon / Apple touch / PWA icons | `public/*-v2.png` + `__root.tsx` links | v2 | ✅ Correct |
| PWA manifest | `public/manifest.webmanifest` | v2 icons + shortcut icons | ✅ Correct |
| Invite card share preview | `src/components/discover/invite-card.tsx` | Uses in-app LogoStamp | ✅ Correct |
| Billing brand mark | `src/components/billing/billing-card.tsx` | Uses in-app LogoStamp | ✅ Correct |
| Social share image | `og-default-v2.jpg` (CDN) | ❌ **Stale artwork** | Replace with v3 |
| Email templates | none — email sending is deferred to v1.5 | — | No action |

Nothing else in the codebase references the old stamp artwork directly.

### 5. Verify

- `bun run build` for a clean typecheck.
- Confirm the v3 URL loads.
- Note in the reply that Meta/X/LinkedIn cache share previews aggressively — the user can force a re-scrape via each platform's debugger (Facebook Sharing Debugger, X Card Validator, LinkedIn Post Inspector) if they want the update visible in already-shared links immediately.

## Technical notes

- Use `imagegen--generate_image` at `premium` quality (typography must be legible in the wordmark) with `transparent_background: false`, save to `src/assets/og-default-v3.jpg`, then upload with `lovable-assets create`, capture the CDN URL, and thread it into the route constants.
- Do not put `og:image` on `__root.tsx` — it would override every child (per the head-meta rules).
- Keep `og:image` and `twitter:image` as absolute `https://mentalhealthwalkclub.com/...` URLs so scrapers accept them.
