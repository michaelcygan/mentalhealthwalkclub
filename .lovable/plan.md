# Journal v2 — world-class redesign

Bring the Journal into the same design language as Discover (segmented island, snap rails, cover/list variants, optimistic micro-interactions, tighter mobile rhythm) while making it dramatically more useful as *data for the user and a space for reflection*.

## Goals
- Use the Discover visual system (sticky segmented island, snap carousels, soft cards, motion language).
- Cut chrome, recover vertical space on 390×728.
- Promote real value: today's reflection, streak + week, mood trend, on-this-day, search/filter — without overwhelming.
- Make reflecting itself feel rewarding (1-tap entry from anywhere on the page).

## New page structure (top → bottom)

```
Header (compact)             — "Journal" h1 (no subtitle), Write pill right
Today island                 — combined "today" card: prompt + streak chip + Write
Segmented island (sticky)    — For you · Reflect · Stats · Entries · Memories
[For you]
  Tonight rail (snap)        — "On this day" cards (1y / 1mo ago) + last entry card
  Mood pulse mini            — sparkline + 7-day dots + delta
  Quick prompts row (snap)   — 4–6 prompt chips → opens write sheet pre-filled
[Reflect]
  Daily prompt (full)        — current prompt + shuffle + write
  Theme prompts (snap)       — grief, gratitude, body, work, etc.
  Voice/photo entry tiles    — kept text-only for v1, photo placeholder via existing sheet
[Stats]
  Hero: showing-up streak + week ring (kept, denser)
  Period toggle (week/month/all) — pill, matches Discover
  4-up counters (entries / walks / minutes / active days)
  Year heatmap (existing)
  Mood arc 30d (existing) + new "best day of week" + "avg mood after walk vs no-walk"
  Badges carousel (existing)
[Entries]
  Sticky search + filter chips (All / Reflections / Walks / Photos / Mood↑)
  Month group headers (existing) — denser row variant
  Entry rows use new "compact" + "expanded" variants
[Memories]
  On-this-day grid + photo memories strip (reuse Discover MemoriesStrip styling)
```

Default landing segment: **For you**.

## Space optimization (mobile)

- Remove "A quiet page for the walking life." subtitle.
- Header padding tightened to match Discover (`pt-2 pb-3`).
- Merge today-prompt + tracking hero into a single **Today island** so the fold shows: prompt, streak, week dots, Write — all together.
- Tracking module's "View more stats" expander is replaced by the **Stats** segment (no accordion, no nested borders).
- Entry rows: compact variant by default (tap to expand inline). Move mood/photo/note metadata into a single chip row.
- Section labels use the Discover micro-eyebrow (`text-[11px] uppercase tracking-[0.14em]`) instead of duplicate eyebrow + serif headline.

## New "useful" features

1. **On this day** — surface entries/walks from same date 1mo/3mo/1y ago. Top of For you.
2. **Mood pulse mini** — sparkline of last 14 days' mood-after with weekly delta badge.
3. **Walk vs no-walk mood** — single sentence: "Your mood-after averages **7.2** on walking days, **5.4** otherwise." Computed from existing data.
4. **Best day of week** — "Tuesdays show up most. Sundays have your highest mood-after." Computed client-side from `stats`.
5. **Quick prompt chips** — 1-tap to open ReflectionWriteSheet pre-filled with that prompt.
6. **Search shortcuts** — chips for "Mood↑" (entries where after > before), "With photos", "Walks 30+ min".
7. **Streak save** — when streak is active and user hasn't shown up today, Today island shows "Keep your N-day streak — write one line" (gentle, not alarmist).
8. **Share day** — long-press / menu on an entry already exists; add "Copy to clipboard" + use existing `share()`.

All derived client-side from current `JournalStats` + feed payload. No new server function required for v1.

## Components (new + edited)

New (`src/components/journal/`):
- `today-island.tsx` — merged prompt + streak + week ring + Write.
- `segmented-island.tsx` — sticky segmented control matching Discover.
- `on-this-day-rail.tsx` — snap carousel of historical entries.
- `mood-pulse-mini.tsx` — sparkline + delta + insight line.
- `insights-strip.tsx` — best-day + walk-vs-no-walk insight cards.
- `prompt-chips-row.tsx` — snap row of prompt chips opening the write sheet.

Edited:
- `journal.tsx` — full rewrite around segmented island; default segment "For you".
- `tracking-module.tsx` — slim down: drop accordion, expose just hero+counters; full stats live in Stats segment.
- `stats-panel.tsx` — add `BestDayOfWeek` + `WalkVsNoWalkMood` blocks; keep heatmap/mood arc/badges.
- `entries-feed.tsx` — add Mood↑ chip; tighter sticky month header; compact-default row.
- `entry-row.tsx` — denser default; expand-on-tap; unify metadata chip row.
- `today-prompt-card.tsx` — kept as fallback (used inside Reflect segment); Today island supersedes on For you.

Reused: `ReflectionWriteSheet`, `BadgesCarousel`, `WeatherPill`, `share`/`haptics`, `PROMPTS`.

## Technical notes

- No DB migration. All insights derived from `getJournalStats` (`minutesByDay`, `walkDays`, `entryDays`, `moodArc30`) and the existing `listJournalFeed` payload.
- On-this-day filter runs on `entries` client-side by `at` date components.
- Walk-vs-no-walk mood: pair `mood_after_score` from walk entries vs reflection entries; if reflection data lacks score, fall back to "walking days vs non-walking days" using only walk entries' mood_after_score grouped by `walkDays`.
- Segmented island reuses Discover's `motion.span layoutId` pill pattern for continuity.
- Sticky behavior: header is normal flow; segmented island uses `position: sticky; top: <appHeaderHeight>` like Discover.
- Reduced motion: respect `useReducedMotion()` for all count-ups, sparkline draw, segment transitions.

## Quality bar (390×728)

- Fold shows: Header, Today island (prompt + streak + Write), segmented island. No need to scroll past chrome.
- "Write" round-trip < 200ms feedback (haptic + sheet open).
- Segment switch is instant; segments stay mounted so scroll position is preserved per segment.
- All copy stays in the existing warm/neutral voice; no clinical jargon.

## Out of scope (fast-follow)
- Voice notes, photo-only entries, calendar/grid view, export-to-PDF, AI summary of the month. Stub UI only if there's room; otherwise omit.
