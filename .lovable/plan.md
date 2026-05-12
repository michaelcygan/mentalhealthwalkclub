# Make podcasts a first-class part of the Guided Walk

The plumbing from the previous pass is solid (tables, RSS sync, admin pages, GuidePicker integration). What's missing is **discoverability, content, and in-walk control**. This plan fixes all three with small, surgical changes — no new primitives.

## Why the user can't find it today
1. Podcasts are the 5th chip inside GuidePicker — only visible *after* tapping "Guided" → Proceed → scrolling a chip row. A 60-year-old will never get there.
2. The 9 recommended feeds were never inserted, so even if found, the list is empty.
3. The active walk page has no way to start, switch, or browse a podcast mid-walk.

## Changes

### 1. Composer: Guided opens a 2-tab picker (Voice vs Podcast)
Drop the 5-chip row inside `GuidePicker`. Replace with **two prominent tabs at the top**: `Voice guide` and `Podcast`. Voice tab shows the existing 4 categories (ambient/breath/voice/music). Podcast tab shows the 6 mood sub-categories.

This keeps the composer as simple as before (still just 3 tiles: Solo / Walk & Talk / Guided) — but once inside Guided, podcasts have equal visual weight to the original guides instead of being a hidden 5th chip.

`src/components/guide-picker.tsx` — restructure: top tabs `voice | podcast`, then content. Mood-fits pill and attribution stay as today.

### 2. Seed the 9 recommended feeds
A migration inserts the curated feeds (APA Speaking of Psychology, NPR Life Kit, TED Health, Hidden Brain, The Happiness Lab, 10% Happier, Huberman Lab, On Being, the goop podcast) into `podcast_feeds` with `is_active = true` and the right category mapping. Admin can deactivate any in `/admin/podcasts` if they don't like one.

After insert, trigger a one-time sync so episodes populate immediately (call the existing `/api/public/hooks/sync-podcast-feeds` endpoint, or run `syncAllActiveFeeds` from the migration via a follow-up server fn the first time `/admin/podcasts` loads if any feed has `last_synced_at IS NULL`).

### 3. Active walk page: podcast affordance
On `/walk/active/$id`, when the walk has no audio attached (`!guided_track_id && !podcast_episode_id && walk_type !== 'audio'`), show a small **"+ Add a podcast"** chip in the action bar. Tapping opens a lightweight bottom sheet with the same Podcast tab UI, and on selection updates `walk_sessions.podcast_episode_id` and re-renders `GuidedModule`.

When a podcast *is* playing, the existing `GuidedModule` already renders the player — we'll add a tiny "Change episode" link below the player title that re-opens the same sheet.

`src/routes/walk.active.$id.tsx` + a new small `src/components/active-walk/podcast-picker-sheet.tsx` that wraps the podcast portion of `GuidePicker`.

### 4. Copy + intuitive cues (small)
- In the composer's "Guided" tile body, change `"A voice in your ear"` → `"A voice or a podcast"`.
- In the Voice/Podcast tab header inside GuidePicker, add one line of subcopy when Podcast is selected: *"Curated for reflection while you walk."*

## Out of scope (intentionally)
- No changes to home, journal, groups, or friend walk flows.
- No new player — still `GuidedPlayer`.
- No playlist/queue, no resume-across-walks, no downloads.
- No mini-player outside the active walk page (the Live Activity pill already covers minimize-state).

## Files
- **Edit** `src/components/guide-picker.tsx` (Voice/Podcast tabs)
- **Edit** `src/components/walk-composer/walk-composer.tsx` (one-line copy)
- **Edit** `src/routes/walk.active.$id.tsx` (mount podcast sheet + chip)
- **New** `src/components/active-walk/podcast-picker-sheet.tsx`
- **New** migration: seed 9 feeds + small server fn to update an active walk's `podcast_episode_id`

## Acceptance
- Tapping Guided → instantly see Voice/Podcast as equal tabs.
- Podcast tab is non-empty on first load (seeded + auto-synced).
- On an active solo/guided walk with no audio, an "Add a podcast" chip is visible.
- Tapping it picks an episode, the player appears in-walk, attribution is shown.
