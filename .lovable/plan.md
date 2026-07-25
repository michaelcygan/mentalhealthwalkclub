## Wave 5 — Retirement & Pruning

The scaffolding is done. Before Radio and Blog polish, we clear everything the V1 spec explicitly removed. Keeping retired code around leaks into nav, DB queries, and SEO, and it slows every future wave.

### Scope

**Retire from the app (routes, nav, components):**
- Solo walk timer, step counter, mood-before/after, weather capture (`/walk`, `use-step-counter`, mood UI, weather hooks)
- Podcasts everywhere (`/listen`, podcast rails on home, `podcast_feeds` / `podcast_episodes` reads, listen collections/search)
- External blog feeds ingestion (`blog_feeds` reads, aggregated "Read" surface) — keep first-party `blog_posts`
- Circles (`/circles`, circle_members reads, "invite to circle" flows); replace all links with Groups
- Map-first discovery UI (map view on Discover); grid stays
- Paid/Plus gating in UI (Stripe stays wired for later, but no Plus-only walls in V1)

**Keep, tighten, and keep private:**
- Private walk journal (`journal_entries`, reflections) — verify RLS locked to `auth.uid()`, remove any public leak
- Badges — keep as-is
- Ambient tracks — keep (they're the Radio foundation, not "podcasts")

**Navigation cleanup:**
- Mobile tab bar: no changes to primary tabs, but the compose sheet "Walk now" (solo) is removed → replaced with "Post a walk" (group/share)
- `/more`: remove Circles row, add Groups row, remove Listen/Read if pointing at retired surfaces
- Home page rails: drop podcast rail + external-articles rail

**Database (migration):**
- Drop routes' backing tables only if fully unused: `podcast_feeds`, `podcast_episodes`, `listen_collections`, `listen_collection_items`, `listen_events`, `listen_search_log`, `blog_feeds` — after code refs are gone
- Leave `circles` / `circle_members` in place for now (data-preservation) but stop reading from them; drop in a later cleanup wave once we confirm no user impact
- Leave `walk_sessions` intact (badges reference it); the solo *UI* is what disappears, not the historical rows

**Redirects:**
- `/walk` → `/` (public grid)
- `/listen`, `/listen/*` → `/`
- `/read` (aggregated feed) → `/blog` (first-party only)
- `/circles`, `/circles/*` → `/groups`

**SEO:**
- Remove retired routes from any sitemap/head references
- Ensure home + `/groups` + `/blog` + `/u/$username` + `/g/$slug` + `/w/$code` are the shareable canon

### Not in this wave

- MHWC Radio on Cloudflare R2 (Wave 6)
- First-party blog CMS polish + editor (Wave 6)
- Final launch QA pass (Wave 7)

### Deliverable order

1. Redirect stubs for retired routes so nothing 404s mid-refactor
2. Nav + compose sheet cleanup
3. Home page — remove retired rails
4. Delete retired route files + their query hooks/components
5. Migration to drop podcast/listen/blog-feed tables
6. Grep sweep + typecheck to confirm zero dangling imports

Approve and I'll run Wave 5.
