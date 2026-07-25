## Wave 6 — remaining polish

Core of Wave 6 shipped (Radio schema + server fns + signed URLs, `RadioRail` on home, `/blog` + `/blog/$slug` with JSON-LD, `/admin/radio` + `/admin/blog`, retired `admin.blogs` and `admin.podcasts` redirect). A few small loose ends before we call it done:

1. **Sitemap**: add `/blog` and each published post slug to the sitemap route so the SEO front door is actually discoverable.
2. **`NowPlayingDock` "radio" affordance**: the dock already plays radio tracks (they route through `PlayerContext`), but the cover fallback + subtitle assume podcast/ambient. Add a light radio branch so the current station name shows as subtitle and station cover shows as art.
3. **First seed**: create one starter station ("Forest") and one starter blog post via the admin UI so the rails aren't empty on first prod visit. (Content only — no code.)
4. **Grep sweep**: remove the last stale references to retired podcast/blog-feed UI (any leftover imports of `PodcastRail`, `BlogRail`, `ListenAndRead`, `ShowsGrid`) so we don't ship dead code.

That closes Wave 6.

---

## Wave 7 — Launch QA & polish

Final pass before promoting the app publicly. No new product surface — only hardening what exists.

### 7A. Performance
- Route-level code splitting audit: confirm heavy admin routes (`admin.radio.$id`, `admin.blog.$id` with marked/sanitize-html) aren't in the public bundle.
- Image discipline: `loading="lazy"` + `decoding="async"` on every non-hero `<img>`; explicit width/height to kill CLS on walk cards, group tiles, radio covers, blog covers.
- Prefetch the top public routes (`/groups`, `/blog`) from the homepage.
- Kill the ambient video autoplay on cellular / reduced-data.

### 7B. Accessibility
- Focus-visible rings on every interactive tile (walk cards, radio stations, group tiles) — several currently rely on hover only.
- `aria-label` on icon-only buttons in the dock, tab bar, and admin toolbars.
- Color-contrast check on `text-muted-foreground` over `bg-card` in the current theme; bump one shade if it fails AA.
- Reduced-motion: the mobile dock already respects it — audit the walk-page confetti, home rails' hover translate, and the reflection rotator.

### 7C. SEO
- Per-route head audit: every public leaf (`/`, `/groups`, `/g/$slug`, `/blog`, `/blog/$slug`, `/u/$username`, `/w/$code`) has a unique title < 60 chars, description < 160 chars, `og:type`, `twitter:card`, and — where an absolute hero URL exists — `og:image` + `twitter:image`.
- `robots.txt` allows crawl of public routes and disallows `/admin`, `/_authenticated`, `/api/public/hooks/*`.
- Sitemap includes: `/`, `/groups`, published blog posts, and public walk share pages that are opted-in.
- Structured data: `Article` on blog posts (already), `Event` on public walk pages, `Organization` on `__root`.

### 7D. Empty & error states
- Homepage with 0 nearby walks: the "New around here" adaptive state is done; verify it also shows for signed-out users, not just cold-start authed users.
- `/blog` with 0 posts: current empty state is a bare "Nothing yet" — replace with a soft CTA that links to `/groups` so the page isn't a dead end.
- `/g/$slug` for a group with 0 upcoming walks: show a "Be the first to post a walk here" affordance for members.
- Route errors: confirm every public route has an `errorComponent` that doesn't leak stack traces.

### 7E. Privacy & safety pass
- Confirm `public_profiles` view is what every public surface reads (walk cards, group member counts, `/u/$username`) — no accidental joins to the raw `profiles` table.
- `/api/public/hooks/*` — re-verify signature checks and rate-limit-friendly responses.
- Guest RSVP: confirm the encrypted email is never returned to the client, only used server-side.

### 7F. Copy & branding
- One pass on all shipped strings — remove any "Lovable App" / "Lovable Generated Project" leftovers.
- Consistent voice for the empty states (currently a mix of "Nothing here yet" and "No walks nearby"). Pick one.
- Favicons + PWA manifest icon set exist and are actually referenced.

### 7G. Final build gates
- Typecheck clean.
- `bun run build` clean (no warnings for unhandled deps in Worker SSR).
- Manual smoke on preview: signed-out home → sign up → post walk → share → guest RSVP → publish blog post → publish radio station → verify all show up.
- Then publish.

---

### Deliverable order for this turn

If you approve, I'll ship Wave 6's four cleanup items first (sitemap, dock radio branch, seed content stub, dead-code sweep), and confirm with a typecheck. Wave 7 is scoped as a follow-up and I'd tackle it in subsections (7A→7G) rather than one giant PR.

### Questions before I start

- **Seed content:** want me to seed one demo Forest station + one launch blog post via the admin UI in this turn, or leave the shelves empty for you to fill?
- **Wave 7 scope:** run all of 7A–7G, or trim (e.g. skip the ambient-video cellular gate, skip PWA icons)?
