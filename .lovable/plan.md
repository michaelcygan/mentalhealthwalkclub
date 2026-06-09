## Goal

Reshape `/journal` around the act of writing — a calm tracking header, one unified feed, a single writing flow, and an expandable stats view. Strip everything that assumed GPS/collaborative virtual walks. Keep meaningful walking signal (minutes, days, mood lift, photos) without pretending we have route data.

## What gets removed

- Route map snapshots everywhere on this surface (entry card art, detail pane map, share-card baking using the snapshot).
- Distance/miles UI and computations (mi stat, mood-arc captions referencing miles, share text). Tracking module loses "miles".
- Steps as a hero metric. Replaced by **Steps logged** wherever it shows, with quieter visual weight (acknowledges phone-locked walks under-count).
- `SignalsRow` (badge/rank/streak chips) — the streak now lives in Tracking; latest badge gets one small pill inside the expanded stats. No "rank in group" anywhere.
- "Earned" badge scroller as a top-level section — folded into expanded stats.
- The right-side desktop `WalkDetailPane` and the mobile detail Drawer (replaces with inline entry expansion, see below). The "edit reflection" textarea moves into the unified write sheet.
- Separate `JournalReflections` block above the walks feed — merged into one feed.
- `EntrySearch` mood "Felt lighter / Felt heavier" chips — replaced by a filter row that matches the new entry taxonomy.

## New shape of `/journal`

```text
[ Header: Journal · "Where every walk gets to land." ]

[ Tracking module ]                          <- always-visible glance
  ├─ Showing-up streak (one flame, days)
  ├─ This week ring: 3/7 days · 42 min
  ├─ Period toggle (week / month / all)
  └─ "View more stats" chevron → expands in place
       ├─ Lifetime: entries written · walks · minutes · steps logged
       ├─ 52-week heatmap (intensity = any "showing up" day)
       ├─ 30-day mood arc (after-walk score)
       └─ Latest badge pill (link to /profile)

[ Today's prompt card ]                      <- gentle nudge, one card
  small rotating reflection prompt + "Write" button
  (reuses PROMPTS pool; if already wrote today → "Add another")

[ Entries ]
  ├─ Search input
  ├─ Filter chips: All · Reflections · Walks · With photos
  ├─ Month-grouped feed of unified Entry cards
  └─ Floating "+" FAB → opens write sheet (freeform)
```

## Unified Entry model (client-side)

One `JournalEntry` shape rendered for both sources, sorted by `created_at` / `started_at` desc:

- **Reflection entries** (`journal_entries` rows): kind=`reflection`, shows date, optional prompt (italic serif), body, "Edit"/"Delete" in entry menu.
- **Walk entries** (`walk_sessions` rows where note OR photos OR mood exist): kind=`walk`, shows date + time, duration · steps-logged (when present), mood before→after with delta, optional weather pill, photo strip (up to 3 thumbs from `walk_photos`), optional reflection_note as italic quote, "Add reflection" if missing.
- Bare walks with no note/photos/mood do **not** show as cards — they still count toward tracking minutes and the showing-up streak.

Cards stay distinct visually (a soft "Walk" or "Reflection" eyebrow + icon), satisfying the "keep walks as their own card type" choice while living in one feed.

### Tap-to-expand (no drawer)

Tapping an entry expands it inline: full body, all photos in a 3-up grid, weather, full mood block, share button (text-only — no baked map card). Re-tapping collapses. This removes the desktop side pane and the mobile vaul drawer entirely.

## Writing flow polish

`ReflectionWriteSheet` is already the right primitive. Upgrades:

- Today's date as quiet eyebrow, prompt (if any) in serif italic, soft cream paper background.
- Larger textarea, comfortable line-height, generous max-width, auto-grow up to viewport.
- Inline "Change prompt" link → rotates within the current 5-prompt seed.
- Inline "Skip prompt" → blanks the prompt; entry saves as freeform.
- ⌘/Ctrl+Enter to save (already there); also Esc to confirm-discard if there's unsaved text.
- Auto-save draft to `localStorage` keyed by date so a refresh doesn't lose writing.
- After save: toast + sheet closes + feed updates locally (already wired via `onSaved`).

## Tracking module rewrite (`tracking-strip.tsx`)

- Replace "miles" tile with "entries this {period}".
- Showing-up streak (days, computed from union of walk dates and journal_entry dates) moves up next to the week ring as the hero number.
- "Steps logged" stat: smaller, with a `?` tooltip explaining it's a partial count.
- The card itself becomes the expand surface — chevron toggles the stats panel inline (heatmap, mood arc, badge pill). The standalone "Lifetime stats" section is removed.

## Data + server work

- New server fn `listJournalFeed` in `src/lib/journal-entries.functions.ts` returning `{ entries: JournalEntry[] }` already-unified server-side: pulls `journal_entries` + qualifying `walk_sessions` for the user, signs `walk_photos` URLs in batch, and returns a single sorted list. This replaces three separate browser-side fetches and all the per-walk URL signing loops in `journal.tsx`.
- New server fn `getJournalStats` returning `{ entriesCount, walksCount, minutes, stepsLogged, showingUpStreak, weekDots, monthlyMinutes, twelveWeekHeatmap, moodArc30, latestBadge }`. Tracking module and expanded stats both read from this single payload.
- New server fn `deleteJournalEntry` (for the entry overflow menu).
- `updateWalkReflection` server fn so the inline "Add reflection" on a walk entry doesn't need to call `supabase` from the component.
- `journal.tsx` becomes a thin route shell that uses these two queries; no direct `supabase.from(...)` calls, no signed-URL juggling, no `bakeShareCard` import.

## File changes

- **Edit** `src/routes/journal.tsx` — strip ~600 lines, become a layout that renders `<JournalHeader />`, `<TrackingModule />`, `<TodayPromptCard />`, `<EntriesFeed />`. Delete `WalkDetailPane`, `MoodArcSection`, `YearHeatmapSection`, `HeatmapCaption`, `Heatmap`, `MoodArc`, `contextLineFor`, local `Stat`.
- **New** `src/components/journal/tracking-module.tsx` — replaces `tracking-strip.tsx`, owns expanded stats panel.
- **New** `src/components/journal/today-prompt-card.tsx` — small surface with one rotating prompt + Write button (reuses `ReflectionWriteSheet`).
- **New** `src/components/journal/entries-feed.tsx` — search, filter chips, month groups, renders `EntryRow`.
- **New** `src/components/journal/entry-row.tsx` — unified card with inline expand for both kinds; subsumes `entry-card.tsx`.
- **New** `src/components/journal/stats-panel.tsx` — heatmap + mood arc + lifetime numbers + latest badge, mounted inside Tracking module.
- **New** `src/lib/journal-entries.functions.ts` additions: `listJournalFeed`, `getJournalStats`, `deleteJournalEntry`, `updateWalkReflection`.
- **Edit** `src/components/home/reflection-write-sheet.tsx` — auto-save draft, change/skip prompt controls, polish.
- **Delete** `src/components/journal/tracking-strip.tsx`, `src/components/journal/signals-row.tsx`, `src/components/journal/journal-reflections.tsx`, `src/components/journal/entry-card.tsx`, `src/components/journal/entry-search.tsx`. (Home reflection rotator is untouched.)

## Out of scope (deliberately)

- No new tables, no schema migrations. `journal_entries`, `walk_sessions`, `walk_photos` are sufficient.
- No new badges or gamification.
- No reminders / push / notification work.
- No export/PDF; that's a future ask.

## Verification

- Build passes, route loads at `/journal`, expanded stats opens and closes.
- Writing a reflection from `TodayPromptCard` appears at the top of Entries immediately.
- Filter chips narrow correctly; search matches both reflection bodies and walk notes/moods.
- A walk with photos shows the photo strip; a walk with no note/photos/mood does not appear in the feed but its minutes still appear in Tracking.
- Streak number reflects unioned days (a journal-only day keeps it alive).
