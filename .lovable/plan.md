## For You v2 — make it the page you open first

Today the "For You" segment shows four good-but-static modules: On this day, Mood pulse, Insights strip, Quick prompts. It reads more like a stats preview than a personal home. v2 reshapes it into a glanceable, reflective surface that surprises a little each visit, while reusing the Discover "pill island" language already locked in elsewhere.

### Layout (top → bottom)

```text
1. Daily Compass island        ← new (hero)
2. Mood pulse mini             ← kept, tightened
3. Carry forward               ← new
4. Patterns strip              ← kept (InsightsStrip)
5. On this day rail            ← kept, slimmed
6. Reflect in 30s              ← new (replaces PromptChipsRow here)
7. Word cloud / echoes         ← new
8. Gentle next step            ← new (footer CTA)
```

Same rhythm as Discover: one hero island, then snap rails, then a single soft footer prompt. No accordions. Nothing taller than ~200px on mobile.

### New modules

1. **Daily Compass island** — one rounded card that answers "where am I today?" at a glance. Three pieces stacked tight:
   - Greeting tuned to time of day + first name ("Good evening, Sam").
   - One-line read of the user's last 7 days, picked from a small ruleset against `stats` + `entries`: e.g. "3 walks, mood trending up", "A quiet week — your last walk lifted you +1.4", "Two reflections in a row. Keep going."
   - A weather-style mood chip (sun / cloud / mixed) derived from `moodArc30` last-7 average.
   Tap → opens the same Write sheet pre-filled with the matching universal prompt for that read.

2. **Carry forward** — resurfaces one of the user's own past sentences. Picks from reflections + walk reflection notes, prefers entries 30–120 days old with body length 40–280 chars, deterministic per day so it doesn't churn on re-render. Styled as a pull-quote with date + "from your journal". Two small actions: "Save" (pins to memories) and "Reflect on this" (opens Write sheet with the quote as the prompt).

3. **Reflect in 30s** — replaces the generic PromptChipsRow on For You. A single card with one prompt chosen by context (mood trending down → tender family; trending up → light; steady → universal) plus a 3-chip "or try" row. Tapping any chip opens the Write sheet. Eyebrow shows "Today's prompt" with a subtle refresh icon that rotates within today's pool.

4. **Word cloud / echoes** — small strip showing the 5 most-used meaningful words across the user's reflections in the last 30 days, sized by frequency. Built client-side from `entries` (reflection bodies + walk reflection notes) with a built-in stopword list. Tap a word → opens the entries feed filtered to that word (handled in entries segment later; for now tap scrolls to On this day and highlights matching cards). Hidden when fewer than 5 unique qualifying words exist.

5. **Gentle next step** — a single low-pressure footer card with one of: "Take a 10-minute walk", "Write a line about today", "Revisit a memory" — chosen based on what's missing today (no walk, no entry, or both done → "Rest counts too"). Tap routes accordingly (start walk, open Write, scroll to On this day).

### Refinements to kept modules

- **Mood pulse mini**: add a small 7d / 30d toggle (segmented pill, same style as JournalSegmented) and surface the "best day" + "lowest day" as tiny markers on the sparkline. Keeps height the same.
- **InsightsStrip**: unchanged logic, but move under Carry forward so the page leads with reflection, not stats.
- **OnThisDayRail**: keep, but cap to 5 cards on For You (full list stays in Memories segment).

### Behaviour rules

- All new modules render gracefully when data is thin: Daily Compass falls back to a warm welcome; Carry forward hides; Echoes hides; Reflect in 30s always shows.
- Deterministic-per-day picks (Carry forward, Reflect in 30s default) use the same day-seed pattern already in `prompt-chips-row.tsx` so re-renders feel stable.
- No new server reads. Everything derives from the existing `stats` + `entries` already loaded on `/journal`.
- No new tables, no new server functions.

### Files

- New: `src/components/journal/daily-compass.tsx`, `carry-forward.tsx`, `reflect-30s.tsx`, `word-echoes.tsx`, `gentle-next-step.tsx`.
- New small helper: `src/lib/journal-derive.ts` for shared computations (last-7 read, day-seed quote pick, stopword tokenizer).
- Edited: `src/routes/journal.tsx` (For You segment composition only), `src/components/journal/mood-pulse-mini.tsx` (7d/30d toggle + min/max dots).

### Out of scope

- Cross-user comparisons, AI-generated summaries, push notifications, editing past entries from For You, persisting "pinned" memories (Carry forward "Save" is a no-op visual for v2 unless we already have a memories table — check during implementation; otherwise hide the Save action).

Ready to build when you give the word.