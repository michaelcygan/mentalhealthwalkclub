Wave 7 first pass is in, but a codebase audit shows it is not fully closed. I recommend finishing the remaining Wave 7 gaps as the opening act of **Wave 8: V1 Launch Readiness**, then moving into final pre-flight work.

## Verified current state
- Build (`vite build --mode development`) passes.
- Public routes `/`, `/blog`, `/blog/$slug`, `/groups`, `/g/$slug`, `/u/$username`, `/impact` have `head()` metadata.
- Default branded OG image exists and is wired into most public leaf routes.
- Sitemap includes `/`, `/groups`, `/blog`, public groups, public profiles, and upcoming public walks.
- Security scan has stale warnings (last update 2026-06-04) around `SECURITY DEFINER` function grants, public bucket listing, social-graph exposure on `follows`, and realtime topic scoping.

## Remaining Wave 7 gaps
1. **Root `__root.tsx` head has no `og:image` / `twitter:image`.**
2. **`/shop` head has only title + description** — missing full OG/Twitter/canonical set.
3. **`/w/$code/recap` head uses a relative `/api/public/walk/$code/og` path** for `og:image`; must be absolute.
4. **`/auth` page still markets retired V1 features** (Solo, Guided, Walk & Talk) in meta description and brand panel.
5. **Image performance**: 12 `<img>` tags in routes, only 5 use `loading="lazy"`; most lack explicit `width`/`height` or aspect-ratio containers.
6. **Accessibility**: 106 `<button>` elements in `src/components`, only 43 `aria-label` instances. Icon-only controls in `now-playing-sheet.tsx`, `media-panel.tsx`, `audio-source-picker.tsx`, `badge-wall.tsx`, and `journal/*` need labels or `aria-hidden` if decorative.
7. **No PWA manifest** despite root links to `icon-192.png` / `icon-512.png`.

## Wave 8: V1 Launch Readiness

### 8A — Close Wave 7 metadata & copy gaps
- Add default `og:image` and `twitter:image` to `src/routes/__root.tsx`.
- Complete `head()` for `/shop` with canonical, OG, and Twitter tags.
- Make `/w/$code/recap` `og:image` absolute (`https://mentalhealthwalkclub.com/api/public/walk/$code/og`).
- Rewrite `/auth` meta description and brand panel to match V1 scope: public walks, groups, journal, radio, blog.
- Add `description`/`og:description` to `/more`, `/journal`, `/profile`, and `/auth` if missing.

### 8B — Accessibility sweep
- Audit every `<button>` in `src/components` that contains only an icon and add `aria-label` (or wrap with visible text).
- Ensure `now-playing-sheet.tsx`, `media-panel.tsx`, `audio-source-picker.tsx`, `badge-wall.tsx`, and journal icon controls are labeled.
- Add `focus-visible` rings where custom-styled buttons currently suppress them.
- Respect `prefers-reduced-motion` for any remaining non-essential motion (most already use `useReducedMotion`).

### 8C — Performance pass
- Add `loading="lazy"` to below-the-fold images in routes (`/w/$code`, `/g/$slug`, `/blog.$slug`, `/shop`).
- Wrap images in aspect-ratio containers and add `width`/`height` attributes where possible to reduce CLS.
- Add `decoding="async"` to non-hero images.
- Verify route-level code splitting is preserved; no new heavy libraries are imported at module scope in public routes.

### 8D — PWA manifest
- Create `public/site.webmanifest` (or `manifest.json`) with app name, short name, theme color `#2c5340`, background color, and icon references.
- Add `<link rel="manifest" …>` in `src/routes/__root.tsx`.
- Verify `icon-192.png` and `icon-512.png` exist in `public/`.

### 8E — Security scan & triage
- Run a fresh security scan.
- Triage findings into:
  - **Fix now**: realtime topic scoping, follows table SELECT policy scoping, public bucket listing.
  - **Accept with memory note**: legitimate `SECURITY DEFINER` helper functions (e.g., `has_role`) that are intentionally public/authenticated-callable.
- Update `@security-memory` for any accepted risks.

### 8F — Launch copy sweep
- Remove user-facing references to retired V1 features from `src/components/auth-form.tsx` and `src/routes/auth.tsx`.
- Grep for "Solo", "Guided", "Walk & Talk" in user-facing copy and replace with V1 language or remove.
- Verify no user-facing "Lovable" strings remain outside integration internals.

### 8G — Critical flow smoke tests
- Sign-up → onboarding → create walk → share walk page → guest RSVP.
- Public homepage → nearby grid → group discovery → group join.
- Radio play → dock persists across navigation.
- Blog index → blog post → canonical/OG render.

### 8H — Final build & publish
- Run `vite build` in production mode.
- Verify no console/runtime errors on public routes.
- Publish and confirm custom domain + preview URLs.

## Out of scope for Wave 8
- New features (badges refinement, push notifications, email flows, maps).
- Major UI redesigns beyond the polish listed above.
- Data migrations (schema is stable for V1).

## Decision needed
Should I proceed with Wave 8 as scoped above, or do you want to add/remove any section (e.g., skip the PWA manifest for now, or prioritize the security scan fixes first)?