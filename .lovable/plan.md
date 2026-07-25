## Wave 7 — Launch QA & polish

One wave, delivered in sub-passes 7A → 7G. No new product surface. Two small content additions the user approved: seed "Mental Health Walk Club Radio" station + one sample blog post; generate one branded default OG image used as sitewide fallback.

### 7A. Performance
- Audit `admin.radio.$id`, `admin.blog.$id` code splits — confirm `marked` + `sanitize-html` are not in the public bundle (they're only imported in `blog-cms.functions.ts` / admin routes, which is fine, but verify via `bun run build` chunk report).
- Add `loading="lazy" decoding="async"` + explicit `width`/`height` to every non-hero `<img>`: walk cards, group tiles, radio covers, blog covers, avatar tiles.
- `<Link preload="intent">` is default; add explicit prefetch of `/groups` and `/blog` from the homepage hero so first tap is instant.
- Gate ambient video autoplay behind `navigator.connection?.saveData !== true` and `effectiveType !== "2g"/"slow-2g"`.

### 7B. Accessibility
- Add `focus-visible:ring-2 focus-visible:ring-ring` to walk cards, group tiles, radio stations, blog cards.
- `aria-label` audit for icon-only buttons: dock ✓ already done, tab bar composer, admin toolbars, notifications bell.
- Contrast: verify `text-muted-foreground` on `bg-card` meets AA; bump one shade in `src/styles.css` if not.
- Reduced-motion: confirm home rails and reflection rotator respect `prefers-reduced-motion` (dock already does).

### 7C. SEO
- Per-route `head()` audit on every public leaf: `/`, `/groups`, `/g/$slug`, `/blog`, `/blog/$slug`, `/u/$username`, `/w/$code`, `/impact`, `/support`, `/privacy`, `/terms`, `/auth`, `/welcome`.
  - Unique `<60ch` title, `<160ch` description, `og:type`, `og:url`, `twitter:card`, canonical on leaf only.
  - `og:image` + `twitter:image`: real absolute URL when the route has a cover (blog posts, groups with cover, walks with cover); **branded default fallback** everywhere else.
- Generate one branded default OG image via `imagegen` (1200×630, MHWC wordmark on a soft forest gradient) → `src/assets/og-default.jpg` → externalize with `lovable-assets` so it has an absolute CDN URL usable in meta tags.
- Wire the default into `__root.tsx` head as fallback `og:image`/`twitter:image`; leaves override.
- `robots.txt`: already good — verify.
- Sitemap: already includes `/blog` posts and public groups. Add `/u/$username` for users with `is_public = true` profiles (query `public_profiles`) and public `/w/$code` walks (opted-in `share_public = true` on events).
- Structured data: `Article` on blog posts ✓ already; add `Event` JSON-LD on `/w/$code`, `Organization` on `__root`.

### 7D. Empty & error states
- `/blog` with 0 posts: soft CTA linking to `/groups` and "Follow along" prompt instead of bare "Nothing yet".
- `/g/$slug` with 0 upcoming walks (members only): "Be the first to post a walk here" affordance linking to `/walk/new?group=$slug`.
- Every public route has an `errorComponent` that doesn't leak stack traces (root `DefaultErrorComponent` covers unhandled — spot-check leaf routes).

### 7E. Privacy & safety
- Grep-verify every public surface reads `public_profiles`, not raw `profiles`, for: walk cards, group member lists, `/u/$username`, homepage friend pulse.
- Re-verify `/api/public/hooks/*` signature checks (walk RSVP, blog/podcast sync).
- Guest RSVP: confirm encrypted email is never in responses.

### 7F. Copy & branding
- Grep sweep: remove "Lovable App" / "Lovable Generated Project" leftovers.
- Unify empty-state voice: pick "Nothing here yet" as the standard; replace variants.
- `public/manifest.webmanifest` + favicons: verify icons exist and are referenced. Add `apple-touch-icon` if missing.

### 7G. Seed content (user-approved)
- Create one radio station named **"Mental Health Walk Club Radio"** via a migration (station row + minimal metadata; no track audio — user uploads later via `/admin/radio`).
- Insert one sample blog post via migration: slug `welcome-to-mental-health-walk-club`, status `published`, short markdown body introducing the club — so `/blog` isn't empty on first prod visit.

### 7H. Final build gates
- `bun x tsc --noEmit` clean.
- `bun run build` clean.
- Quick Playwright smoke: signed-out `/` → `/blog` → `/groups` → `/g/$slug` → `/auth` render without console errors, and OG tags present.

### Delivery order this turn
7G (seed) + 7C (OG default + head audit + sitemap) first — they unblock a shareable launch. Then 7B, 7A, 7D, 7E, 7F, 7H. If any sub-pass balloons unexpectedly I'll stop and check in rather than push through.

### Technical notes
- OG default: generate JPEG (smaller than PNG for photographic gradient), upload via `lovable-assets` CLI to get a stable absolute URL, reference from `__root.tsx` `head().meta` as fallback only.
- Seed migration will INSERT into `radio_stations` and `blog_posts` — literal rows, not seeded from a server fn (per project rules).
- Sitemap will read `events` for `share_public = true` walks; keeping the URL count well below any prerender cap since these are runtime-generated, not build-time files.
