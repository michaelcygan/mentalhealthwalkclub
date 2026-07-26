## Logo replacement — corrected "est. 2025" artwork

Drop-in brand asset replacement. No behavior, layout, size, or copy changes.

### Audit results (all active references to old logo)

- Bundled: `src/assets/logo-stamp.png` → imported by `src/components/logo-stamp.tsx` (used in `__root.tsx` desktop sidebar + mobile header, `src/routes/auth.tsx` brand panel + mobile header)
- Public: `public/logo-stamp.png` → hard-coded `/logo-stamp.png` in `src/components/loading-screen.tsx`
- Icons: `public/favicon.ico`, `public/icon-192.png`, `public/icon-512.png` → referenced in `src/routes/__root.tsx` head links and `public/manifest.webmanifest` (icons + shortcut)
- OG default: `src/assets/og-default.jpg.asset.json` (CDN pointer) → hard-coded absolute URL in 11 route files (`index`, `auth`, `more`, `journal`, `profile`, `shop`, `impact`, `groups`, `g.$slug`, `u.$username`, `blog`, `blog.$slug`). Needs visual inspection — the current OG card visibly contains the old logo art.
- Walk dynamic OG/Story generators (`src/routes/api/public/walk.$code.og.ts`, `walk.$code.story.ts`) do NOT embed the raster logo — text-only, no change.

No other copies (Base64, remote hosts, additional loaders) found.

### Asset prep (from uploaded `MentalHealthWalkClub-Logo-Black-2.png`)

Uploaded file has a white background. Prep pipeline (one-off Bun/Node script using `sharp`, which is already a project dep):
1. Read `/mnt/user-uploads/MentalHealthWalkClub-Logo-Black-2.png`
2. Trim white background to transparency (threshold on luminance, keep black strokes intact; do not touch stroke pixels)
3. Trim to content bbox, then pad to square with transparent margin so the stamp isn't stretched
4. Emit master `logo-stamp-v2.png` (transparent, ~1024×1024, centered)
5. From the master, composite onto warm cream `#f6efdf` with generous safe-area padding (≈12% inset) to produce maskable/touch icons

### Files added

- `src/assets/logo-stamp-v2.png` — corrected transparent master (bundled; Vite hashes URL)
- `public/logo-stamp-v2.png` — corrected transparent master (served for `LoadingScreen`)
- `public/favicon-32-v2.png` — 32×32 transparent (favicon)
- `public/icon-180-v2.png` — 180×180 warm-cream background, padded logo (Apple touch)
- `public/icon-192-v2.png` — 192×192 warm-cream, padded (maskable-safe)
- `public/icon-512-v2.png` — 512×512 warm-cream, padded (maskable-safe)
- New corrected OG default uploaded via `lovable-assets` → `src/assets/og-default-v2.jpg.asset.json` (new UUID / new stable URL)

### Files edited

- `src/components/logo-stamp.tsx`: import switches to `@/assets/logo-stamp-v2.png`. Public API, tone inversion, size, alt, `draggable={false}`, className behavior unchanged.
- `src/components/loading-screen.tsx`: `src="/logo-stamp-v2.png"`. Animation, sizes, caption, a11y, variants unchanged.
- `src/routes/__root.tsx` head `links`: replace favicon + icon + apple-touch entries with v2 filenames; drop `.ico`, use `/favicon-32-v2.png`, `/icon-180-v2.png` (apple-touch), `/icon-192-v2.png`, `/icon-512-v2.png`.
- `public/manifest.webmanifest`: update both `icons[]` entries and the "Start a walk" shortcut icon to v2 filenames. No other manifest fields change (name, theme_color, start_url, share_target, shortcuts all preserved).
- OG image URL swap: replace the 13 occurrences of the old `og-default.jpg` CDN URL with the new v2 URL across `src/routes/index.tsx`, `auth.tsx`, `more.tsx`, `journal.tsx`, `profile.tsx`, `shop.tsx`, `impact.tsx`, `groups.tsx`, `g.$slug.tsx`, `u.$username.tsx`, `blog.tsx`, `blog.$slug.tsx`. (Extract into a single shared `OG_DEFAULT` const only where already inlined per-file — otherwise straight replace to minimize diff.)

### Files removed (after verification)

- `src/assets/logo-stamp.png`
- `public/logo-stamp.png`
- `public/favicon.ico`
- `public/icon-192.png`
- `public/icon-512.png`
- `src/assets/og-default.jpg.asset.json` (deleted via `lovable-assets delete` so the old CDN object is also purged)

### What stays exactly the same

Component APIs, layout, sizes, animations, copy, routes, colors, metadata text, walk OG/Story generators, Supabase, database, backend functions.

### Verification checklist

1. `rg` for `logo-stamp.png`, `favicon.ico`, `icon-192.png`, `icon-512.png`, old og-default UUID `7a90bd38-...` → must return 0 hits in `src/` and `public/`.
2. `bun run build` succeeds.
3. Lint diff limited to touched files.
4. Visual pass in incognito: desktop sidebar, mobile header, `/auth` desktop + mobile, cold-start `LoadingScreen`, favicon tab, manifest icons (DevTools → Application → Manifest), corrected "est. 2025" legible at 32px.
5. Confirm no white rectangle behind the stamp on dark surfaces (inversion preserved).