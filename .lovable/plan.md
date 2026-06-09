# Listen v2 — a unified audio + reading hub

## The strategic call

Don't spin up a separate Content page. The audience and intent overlap (something to walk with), splitting them would dilute both, and Home already pairs them via `listen-and-read.tsx`. Keep the route at `/listen` but reposition the page as **"Listen & Read"** — one hub for everything you press play on or take with you on a walk. A dedicated `/content` route only makes sense once we have long-form video, courses, or guides; we're not there yet.

This also matches the design language we've been rolling out on Home / Journal / Discover: a single island up top, segmented snap rails below.

## Layout (top → bottom, mobile 390)

```
┌─ Back  ─────────────────────────────────────────┐
│ 🎧 Listen & Read                                │
│ Something for every walk.                       │
│                                                 │
│  ╭─ Today's pick island ───────────────────╮    │
│  │ [cover]  "Quiet morning, slow start"    │    │
│  │          Ambient mix · 32 min           │    │
│  │          ▶ Play   ＋ Add to walk        │    │
│  ╰─────────────────────────────────────────╯    │
│                                                 │
│  [ Listen ][ Read ][ Yours ]   (segmented)      │
│                                                 │
│  — when Listen —                                │
│  Podcasts for walking          → snap rail      │
│  Ambient mixes                 → snap rail      │
│  Guided walks                  → snap rail      │
│                                                 │
│  — when Read —                                  │
│  Fresh from the blogs we follow → snap rail     │
│  Saved for later (if any)       → list          │
│                                                 │
│  — when Yours —                                 │
│  Your queues / playlists  + New playlist        │
│  Recently played                                │
│                                                 │
│ Footer: "Editor's notes update weekly."         │
└─────────────────────────────────────────────────┘
```

The current page's three audio rails + playlist list all stay — they just move under tabs so the page stops feeling like an endless scroll of disconnected sections.

## What's new

### 1. Today's pick island (`today-pick.tsx`)
A single hero card chosen client-side from `listenCatalog`:
- Morning → top guided walk or calm ambient
- Afternoon → top podcast (`walk_fit_score`)
- Evening → ambient mix tagged `wind-down`
Falls back gracefully if a bucket is empty. Two actions: **Play** (opens detail) and **Add to walk** (pre-fills `/walk/new` audio).

### 2. Segmented tabs: Listen / Read / Yours
Replaces the flat stack. Uses the same pill segment control as Journal segments. Tab state lives in the URL (`?tab=read`) so deep links work.

### 3. Read tab — blog posts surface here
Pulls from existing `recentBlogPosts(limit:12)`. Cards mirror the Tile shape (cover, title, publisher · est. read time). Tapping opens the source link in a new tab; a bookmark icon saves it to **Saved for later** (new tiny table `saved_reads`). This is the bridge between the blog feeds (already in Admin via the sync hook) and the user.

### 4. Yours tab
Owns the existing playlists block + a new **Recently played** rail (derived from `walk_sessions.audio_*` we already store). Keeps creation/deletion exactly as today.

### 5. Visual polish to match Home/Journal
- Round corners → `rounded-3xl` islands, `rounded-2xl` tiles (already close)
- Soft dashed empty states → swap the dotted block for the same `border-dashed` pattern used in Journal
- Section headings → align icon + serif heading sizes with `daily-compass`

## How it connects to Admin

Admin already manages **Podcasts** and **Merch / Events**. To make Listen v2 fully editable we add:

1. **`/admin/blogs`** — list `blog_feeds`, toggle `is_active`, add/remove feeds, "Sync now" button calling `syncBlogFeedsNow`. Mirrors the existing `admin.podcasts.tsx` pattern.
2. **Editor's pick flag** — a `is_featured boolean` + `featured_rank int` on `podcast_episodes`, `ambient_tracks`, `guided_tracks`, and `blog_posts`. Admin gets a star toggle on each row. The Listen page's Today's pick prefers featured items before falling back to score-based selection.
3. **Admin nav** — add `Blogs` chip next to `Podcasts` in `admin.tsx`.

No new admin auth — all four admin routes already use the same `user_roles` check in `admin.tsx`'s `beforeLoad`.

## Technical details

- **Files to create**
  - `src/components/listen/today-pick.tsx`
  - `src/components/listen/segmented-tabs.tsx` (or reuse the Journal one if generic enough)
  - `src/components/listen/read-rail.tsx` (uses `recentBlogPosts`)
  - `src/components/listen/saved-reads-list.tsx`
  - `src/components/listen/recently-played.tsx`
  - `src/routes/admin.blogs.tsx`
  - `src/lib/saved-reads.functions.ts` (`listSavedReads`, `toggleSavedRead`)
  - `src/lib/listen-curation.functions.ts` (`setFeatured`, used by admin)
- **Files to edit**
  - `src/routes/_authenticated/listen.tsx` — reshape into hero + tabs, keep playlist CRUD intact
  - `src/routes/admin.tsx` — add Blogs nav chip
  - `src/lib/playlists.functions.ts` — extend `listenCatalog` to return `is_featured` + recently-played rows
- **DB migration (one)**
  - `create table public.saved_reads (user_id uuid, post_id uuid, saved_at timestamptz default now(), primary key (user_id, post_id))` with `GRANT` for `authenticated` + `service_role` + RLS scoped to `auth.uid()`.
  - `alter table podcast_episodes / ambient_tracks / guided_tracks / blog_posts add column is_featured boolean default false, add column featured_rank int`.
- **No new dependencies, no new edge functions.** All data fetched via existing `createServerFn` patterns.

## Out of scope (call out explicitly)

- In-app audio player upgrade (still hands off to the existing detail route).
- AI-generated "for you" picks — today's island uses simple deterministic rules.
- Comments / reactions on blog posts.
- Migration of `/listen` to `/library` or `/content` — defer until the content mix actually broadens (video, courses).
- Moving blog/podcast settings out of Admin into user-facing "Following" controls — future, once we have more feeds.

## Open question before I build

Two small forks I want your call on:
1. **Tabs vs. one long page.** Tabs keep things tight but hide rails behind a tap. The alternative is everything in one scroll with sticky section headers. I'd default to tabs — okay?
2. **Saved reads scope.** Save-for-later inside the app, or just open the article externally and let the browser bookmark it? Saving in-app is a small table but creates a real "library" feeling — worth it?
