
# Groups tab — 2026 level-up

Goal: make Groups feel **alive, local, and personal** without inventing new tables. Everything below uses primitives already in the database (`groups`, `group_memberships`, `audio_rooms`, `events`, `walk_sessions`, `profiles`).

## What changes for the user

1. **Sticky search + filter chips at top** — instant client-side fuzzy match across name, description, theme, city. Chips: *Near me · Live now · Has upcoming · Quiet · Audio-friendly*.
2. **"Pulse" hero strip** — one horizontally-scrolling row of groups that are *live right now* or *starting soon* (joins `audio_rooms` + `events` already loaded by `LiveNowStrip`'s pattern). Tap → group detail with the join CTA primed.
3. **Your groups, redesigned** — pill row replaced with a compact carousel of "presence cards": each shows last-7-days walker count + a tiny sparkline of live activity. One-tap "Walk with this group" right from the card (reuses the same insert as `groups.$slug`).
4. **Discover, restructured** — three calm sections instead of one long grid:
   - **For you** (themes matching `user_preferences.preferred_themes` + city match)
   - **Near you** (city match on profile, fallback to country)
   - **Browse all** (collapsed by theme: Anxiety · Burnout · Grief · Chapters · Connection · Quiet · Reset)
5. **Richer group cards** — show *N walking this week*, *next scheduled walk time*, *N live now* — all from data already fetched in one round trip. Replace solid Join button with a quieter `+ Join` ghost that becomes `✓ Joined` inline (no list reflow).
6. **Mobile gestures** — swipe-left on a joined group card = leave (with undo toast). Long-press = preview sheet with upcoming walks. Pull-to-refresh re-runs the merged query.
7. **Empty/seed state** — when zero groups joined, show a one-screen "pick 3 to get started" onboarding card driven by `user_preferences.preferred_themes`.

## More seeded groups

Add ~12 new rows to `groups` so the discover grid feels populated. All use existing themes/columns (no schema change). Examples:

```text
Morning Light       theme=reset       — "First-light walks before the day claims you."
After Work Wind-down theme=burnout    — "Decompress on foot. 20 minutes is enough."
New Parents Walk    theme=connection  — "Stroller-friendly. Coffee optional."
Long-Distance Friends theme=connection — "Walk together over audio across cities."
Sober Walkers       theme=connection  — "A community on the move, one day at a time."
Neurodivergent Walkers theme=quiet    — "Stim-friendly, low-demand, no small talk required."
Creative Block      theme=quiet       — "Walk it out. The idea is in your legs."
Postpartum          theme=grief       — "For the in-between season."
Breakup Recovery    theme=grief       — "One foot, then the other."
Brooklyn Chapter    theme=chapter, city=Brooklyn
LA Chapter          theme=chapter, city=Los Angeles
London Chapter      theme=chapter, city=London
```

## Data plumbing (one query, no new tables)

Replace the three sequential calls in `groups.tsx` with **one parallel batch** plus a single derived map:

```ts
const [groupsQ, mineQ, liveQ, upcomingQ, weekQ] = await Promise.all([
  supabase.from("groups").select("...").eq("is_active", true),
  user && supabase.from("group_memberships").select("group_id").eq("user_id", user.id),
  supabase.from("audio_rooms").select("group_id,id").eq("status","open").gt("current_participant_count",0).is("parent_room_id", null),
  supabase.from("events").select("group_id,starts_at,event_type").eq("status","published").gte("starts_at", nowIso).lte("starts_at", in7dIso),
  supabase.from("walk_sessions").select("group_id,user_id").eq("status","completed").gte("started_at", weekAgoIso),
]);
```

Build one `Map<groupId, { live, nextStart, walkersWeek }>` and render. No N+1.

## Files touched

- **`src/routes/groups.tsx`** — full rewrite around new layout (still ~180 LOC; trades the flat grid for three composable sub-sections that share one data hook).
- **New `src/components/group-card.tsx`** — single source of truth for compact + expanded variants (replaces inline `<li>`s, used by Pulse strip and Discover).
- **New `src/hooks/use-groups-feed.ts`** — the merged loader above; re-usable on home if we want a "Your groups" tile later.
- **One migration** — `INSERT INTO groups (...) VALUES (...)` for the 12 seeds. No column changes.

## Out of scope (intentionally)

- No new tables, no group chat, no posts/feeds.
- No push notifications.
- No map view (city pill is enough; map can come once we have lat/lng on most groups).

---

## "World class for 2026" — bigger picture (separate, optional follow-ups)

If you later want to push beyond this pass, here's where I'd go next, in order of leverage:

1. **Presence-first home** — Replace the static "Now & next" with a single ambient *Pulse* surface: live walker count globally, a few avatars walking *right now*, the next thing you could join in one tap. Borrows the design language of Strava's *Beacon* and Apple's Live Activities.
2. **One-tap join from anywhere** — Any group / event / audio room becomes joinable from the dock without leaving the current screen. The walk session is already the universal primitive — surface it everywhere.
3. **Spatial audio pods** — Pods already exist; layer in WebRTC spatial audio so 6-person breakouts feel like walking three abreast. Big perceived-quality jump for ~one library swap.
4. **AI walk companion (opt-in)** — A gentle on-device prompt every ~10 min ("notice one thing green"). Uses Lovable AI Gateway (`google/gemini-2.5-flash-lite`), no new infra.
5. **Local rituals** — Sunday Reset, Morning Light, After-Work Wind-down become *recurring scheduled audio walks* per chapter — auto-generated via the cron we already have. Groups become living, not lists.
6. **Quiet social graph** — Replace explicit follows with *"walked alongside"* — anyone you've shared a pod or IRL event with appears softly in your feed. No friend requests, ever.
7. **Beautiful exports** — End-of-month "walking portrait" PDF/share card generated from existing reflection + route data. Drives organic growth without ads.

Want me to proceed with the Groups pass exactly as scoped above?
