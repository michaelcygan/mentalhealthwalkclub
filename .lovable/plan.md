## Wave 6 — MHWC Radio + Blog CMS (Option B: Lovable Cloud Storage)

Schema is already live from the previous step. This plan wires Radio to Lovable Cloud Storage and builds the Blog CMS end-to-end.

### 1. Storage buckets

- Create private bucket `radio-tracks` (audio files, served via short-lived signed URLs).
- Create public bucket `blog-covers` (post cover images, direct URLs).
- RLS on `storage.objects`: admins can insert/update/delete in both; anyone can read `blog-covers`; `radio-tracks` reads only through signed URLs from server fns.

### 2. Radio server layer

New file `src/lib/radio.functions.ts`:
- `listStations()` — public, returns active stations sorted.
- `getStation(slug)` — public, returns station + track list (without URLs).
- `signTrackUrl({ trackId })` — public, returns a short-lived signed URL (5 min) for one track's storage key.
- Admin: `adminListStations`, `adminUpsertStation`, `adminDeleteStation`, `adminUpsertTrack`, `adminDeleteTrack`, `adminReorderTracks`, `adminSignUpload({ stationSlug, filename })` returning a signed upload URL for direct browser-to-storage PUT.

All admin fns gated by `has_role(auth.uid(),'admin')` via `requireSupabaseAuth` + role check inside handler.

### 3. Radio player integration

- Extend `src/lib/player-context.tsx` (or add a light `radio-context`) to accept a `"radio"` source with `{ stationId, tracks[], index, shuffle }`. Auto-advance on `ended`, refresh signed URL just-in-time per track.
- Persist last station slug in `localStorage`.
- `NowPlayingDock` and `NowPlayingSheet` already render generic title/subtitle/cover — pass radio metadata through the existing player context; no dock redesign needed.

### 4. Home surface

- New `src/components/home/radio-rail.tsx` — horizontal station cards (cover, title, subtitle). Tap = start station in the universal player.
- Mount on `src/routes/index.tsx` in place of the retired Listen section. Public (no auth required).

### 5. Admin — Radio

- `src/routes/admin.radio.tsx` — list stations + "New station" sheet.
- `src/routes/admin.radio.$id.tsx` — edit station (title, subtitle, cover upload to `blog-covers`… actually a small `radio-covers` public bucket — added in step 1), track list with drag-reorder, file upload (browser gets signed PUT URL, uploads directly, then calls `adminUpsertTrack`).
- Add link from `/admin` index.

Correction to step 1: create three buckets — `radio-tracks` (private, audio), `radio-covers` (public, station art), `blog-covers` (public, post art).

### 6. Blog CMS server layer

New file `src/lib/blog-cms.functions.ts`:
- Public: `listPublished({ limit, offset })`, `getBySlug(slug)`.
- Admin: `adminList`, `adminGet(id)`, `adminUpsert` (slug auto-generated from title if missing, unique-checked), `adminDelete`, `adminPublish({ id, publish })`.
- Server-side markdown → HTML via `marked` + `sanitize-html` on save; store both `body_md` and `body_html`.

### 7. Public blog routes

- `src/routes/blog.tsx` — index listing published posts (cover, title, excerpt, date). SEO head with title/description/OG.
- `src/routes/blog.$slug.tsx` — post page. Renders sanitized `body_html`. Per-route head() with `seo_title`/`seo_description`, canonical, `og:image` = `cover_url`, JSON-LD `Article`.
- Add `/blog` and each published slug to the existing sitemap route.

### 8. Admin — Blog

- `src/routes/admin.blog.tsx` — list drafts + published, "New post".
- `src/routes/admin.blog.$id.tsx` — editor: title, slug (auto/editable), cover upload (`blog-covers`), Markdown textarea with live preview pane (client-side `marked` for preview only; server re-renders + sanitizes on save), SEO title/description, publish toggle, delete.

### 9. Retire /read

- `src/routes/_authenticated/read.$postId.tsx` → redirect to `/blog`.

### 10. Verification

- `bun add marked sanitize-html @types/sanitize-html` for CMS.
- `bun add @aws-sdk/s3-request-presigner @aws-sdk/client-s3` NOT needed — Supabase Storage JS client already handles signed URLs.
- Typecheck. Manual smoke: create a station via admin, upload one short mp3, play from home; create a draft post, publish, view at `/blog/<slug>`.

### Not in this wave

- Radio scheduling / live streams (stations are shuffled track lists).
- Blog comments, multi-author permissions, drafts autosave.
- Migration to R2 (can be done later without user-facing changes by swapping the storage helper).

### Technical notes

- Signed URL expiry: 5 min per track; refresh on advance. Avoids exposing raw storage keys.
- Track uploads use `supabase.storage.from('radio-tracks').createSignedUploadUrl(path)` so large files don't route through server fns.
- Sanitize-html allowlist: standard block/inline tags + `img[src,alt]`, `a[href,rel,target]`; strip `<script>`, `<iframe>`, event handlers.
- Sitemap: extend existing sitemap generator to query `blog_posts` where `status='published'`.

Ready to build on approval.
