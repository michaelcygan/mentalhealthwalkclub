## Goal

Turn Home from a static dashboard into a calm, alive landing surface that rewards opening the app — utility (weather, stats), content (reflections, podcasts, blog posts), and connection (friend activity / high-fives). Built only from primitives already in the codebase, plus a new lightweight blog-feed table that mirrors the podcast pipeline.

## Layout (top → bottom, mobile-first)

```text
┌─ ambient backdrop (lofi gradient + slow drift, weather-tinted) ─┐
│  Greeting · Mike                                                │
│  weather pill                                                    │
│                                                                  │
│  ┌─ Reflection card (rotating prompt, 12s auto-advance) ──────┐ │
│  │  "what is your body asking for in this exact minute?"     │ │
│  │  · · ● · ·     [Save to journal] [Shuffle]                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ This Week (upgraded) ─────────────────────────────────────┐ │
│  │  7 day-bars sized by minutes, today ringed                 │ │
│  │  142 min · 3 walks · 2.4 mi   ↗ +18 min vs last week       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ 7-day weather forecast (horizontal scroll) ───────────────┐ │
│  │  Today  Sat  Sun  Mon …   icon · hi/lo · rain% · walk-score │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ Friend pulse (circles activity) ──────────────────────────┐ │
│  │  avatar · "Jess just finished a 32 min walk"  [👋 high-five]│ │
│  │  avatar · "Tom posted a walk for Sat 8am"     [RSVP →]      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ Listen — podcasts (horizontal rail) ──────────────────────┐ │
│  │  4–6 recent podcast episode cards → /listen/$id            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ Read — blog posts (horizontal rail) ──────────────────────┐ │
│  │  4–6 recent posts from MedlinePlus, SAMHSA, Psych Today    │ │
│  │  cards link to source URL (open in new tab)                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Walks near you (link card)                                      │
│  Journal (link card, keeps last-reflection preview)              │
└──────────────────────────────────────────────────────────────────┘
```

Composer FAB and mobile tab bar unchanged. Ambient music stays exclusive to the walk experience — not surfaced on Home.

## Modules in detail

**1. Ambient backdrop**
Fixed, behind content. Soft 3-stop oklch gradient that drifts ~40s, tinted by current weather tone (clear → warm cream, cloud → cool gray, rain → muted blue, night → deeper indigo). Plus a few floating "dust" specks for lofi feel. CSS-only, GPU-cheap, respects `prefers-reduced-motion`. No video.

**2. Rotating reflection card**
Pulls from `src/lib/reflection-prompts.ts`. 5 prompts per session, weighted to universal + noticing/reflecting. Crossfade every 12s, pause on tap, dots underneath. Actions: **Save to journal** (prefills a new journal entry with the prompt) and **Shuffle**. Tapping the card also opens journal-new with the prompt prefilled.

**3. This Week (upgraded)**
- 7 vertical bars sized by that day's minutes (today gets a ring), not on/off dots.
- Headline numbers: minutes · walks · miles.
- Delta line: "+18 min vs last week" computed from a second 7-day query.
- Empathetic copy stays.

**4. 7-day weather forecast**
- New helper `getDaily(lat,lng,7)` in `src/lib/weather.ts` using Open-Meteo `daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code`.
- Horizontal scrollable row of 7 day chips: weekday short, weather glyph, hi/lo °F, rain%.
- Tiny "walk-score" badge (good / okay / tough) derived from temp + precip + wind.

**5. Friend pulse**
- New `getCircleActivity` server fn in `src/lib/social.functions.ts`: last ~5 events across the user's circles — someone completed a walk or posted one. RLS-scoped to my circle memberships.
- Each row: avatar + one-line text + relative time + one action:
  - Completed walk → **👋 High-five** (new `sendHighFive` server fn).
  - Posted walk → **RSVP →** to `/w/$code`.
- New table `high_fives(id, from_user_id, walk_session_id, created_at, unique(from_user_id, walk_session_id))` with RLS scoped to authenticated users (only circle-mates can send/see). Full GRANTs included in the migration.
- Soft heart pulse on tap; toast confirms.

**6. Listen — podcasts (content rail)**
- Reuse `podcast_episodes` (already powered by the RSS pipeline). New server fn `recentPodcastEpisodes({ limit: 6 })` returns the latest published episodes across active feeds with cover + title + publisher + duration.
- Horizontal rail of cards; tap → `/listen/$id`. Ambient mixes intentionally excluded — those belong to the walk surface only.

**7. Read — blog posts (content rail, NEW)**
- New tables that mirror the podcast pattern:
  - `blog_feeds(id, rss_url, title, publisher, image_url, is_active, last_synced_at, last_sync_error, created_at)`
  - `blog_posts(id, feed_id → blog_feeds, guid, title, summary, link, image_url, published_at, created_at, unique(feed_id, guid))`
- Seed three feeds via migration:
  - https://medlineplus.gov/feeds/topics/mentalhealth.xml
  - https://www.samhsa.gov/blog/rss
  - https://www.psychologytoday.com/us/blog/mental-health-nerd/feed
- New `src/lib/blogs.server.ts` — parses RSS via the existing `fast-xml-parser` (already used by `podcasts.server.ts`). Mirrors `syncFeedById` / `syncAllActiveFeeds`. Skips items missing a link; cap 50 per feed; strips HTML from summaries; first image lifted from `media:content` / `media:thumbnail` / `<enclosure type=image/*>` / first `<img>` in content.
- New `src/lib/blogs.functions.ts` — `recentBlogPosts({ limit: 6 })`: public-safe server fn using `supabaseAdmin` returning only safe columns (title, summary, link, image_url, publisher, published_at). Plus an admin `syncBlogFeeds` matching the podcast admin shape.
- New cron route `src/routes/api/public/hooks/sync-blog-feeds.ts` (mirrors `sync-podcast-feeds.ts`) — separate cron schedule registered (every 6h).
- Card → opens source URL in a new tab (`target="_blank" rel="noopener noreferrer"`). Small chip on the card shows publisher.

**8. Walks near you + Journal**
Same behaviors, restyled to match the new spacing. Journal card keeps the last-reflection blockquote.

## Files

New:
- `src/components/home/ambient-backdrop.tsx`
- `src/components/home/reflection-rotator.tsx`
- `src/components/home/week-summary.tsx`
- `src/components/home/weather-forecast.tsx`
- `src/components/home/friend-pulse.tsx`
- `src/components/home/podcast-rail.tsx`
- `src/components/home/blog-rail.tsx`
- `src/hooks/use-daily-weather.ts`
- `src/lib/blogs.server.ts`
- `src/lib/blogs.functions.ts`
- `src/routes/api/public/hooks/sync-blog-feeds.ts`

Edited:
- `src/routes/index.tsx` — compose the new Home; logged-out hero unchanged.
- `src/lib/weather.ts` — add `DailyPoint` + `getDaily()`.
- `src/lib/social.functions.ts` — add `getCircleActivity()` and `sendHighFive()`.
- `src/lib/podcasts.functions.ts` — add `recentPodcastEpisodes()` (public-safe).
- `src/styles.css` — keyframes for backdrop drift + dust, gated behind `prefers-reduced-motion: no-preference`.

Migrations:
- `blog_feeds`, `blog_posts` (with GRANTs + RLS: public SELECT on safe columns via a security-definer fn used by `recentBlogPosts`; writes locked to `service_role`).
- `high_fives` (with GRANTs + RLS scoped to circle-mates).
- Seed the three RSS feeds; trigger an initial sync via the new cron route after the migration runs.

## Technical notes

- Reads happen client-side from a signed-in component (Home is not under `_authenticated/`, so guard by `useAuth().user`). Server fns are called via `useServerFn` + `useQuery`.
- Reflection picks are seeded in `sessionStorage` to avoid repeats.
- Weather reuses `weather.ts`'s in-module cache.
- Blog RSS sync runs server-side (Worker-safe, `fast-xml-parser`, identical to podcasts).
- No new npm dependencies.
- High-five action is idempotent thanks to the unique constraint; UI flips to "✓ Sent" after success.
- All animations respect `prefers-reduced-motion`.

## Out of scope

- Push notifications, real-time presence, comments threads.
- Ambient mixes on Home (kept exclusive to walks per your call).
- In-app blog reader view (cards link out to the source — can be added later if you want to keep readers in-app).
