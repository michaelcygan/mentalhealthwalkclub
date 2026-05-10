## Reframe

The walk is the soul. The Journal is where that soul accumulates — part **tracking dashboard** (daily pull), part **reflection space** (weekly/monthly pull). Photos and writing are quiet accents, not the headline. Each walk is a single entry; the entry card itself should be beautiful enough that 90% of users never need to open it.

Two passes, scoped tighter than before.

---

## Pass 1 — In-walk: pull back, don't expand

The current "Capture this moment" pill stays as a single, optional, quiet affordance. **No always-open notebook** — that pulls attention away from the walk. Only two real changes:

- **Rename** the pill from "Capture this moment" → **"Note this"** (one icon: a small pen, not a camera). Photos are still reachable inside the sheet but not the primary verb.
- **Auto-collapse** to a tiny floating dot in the corner after 8s of no interaction; tap re-expands. Writing/shooting remains possible but never courts the user.

That's it for the walk screen. The walk is left alone.

---

## Pass 2 — Journal tab: tracking + reflection, one surface

Reorganize around three layers, top to bottom. Nothing here adds new data — it's a UI pass that makes the existing analytics and walk history feel like a complete tool.

### Layer A — Tracking header (the daily-return hook)

Replace the current stats card + heatmap with a denser, Strava-grade **tracking strip** that rewards opening the tab.

```text
┌─────────────────────────────────────────────────────────────┐
│ Journal                                  [ week ▾ month all]│
│                                                             │
│  ●●●○●●●  this week · 4 of 7   ↑ 18 min vs last week        │ ← week ring
│                                                             │
│   142          11.4         18,402        +1.6              │
│   minutes      miles        steps         mood arc          │
│   ── 12 wk heatmap ──   ── 30d mood arc ──                  │
│                                                             │
│  🏅 Sunday Reset · #12 in your circle · 3-week streak       │ ← signals row
└─────────────────────────────────────────────────────────────┘
```

- **Period toggle** (week / month / all) drives every number above the entry feed — the same one filter, no per-card duplication.
- **Week ring** (reuse `WeeklyRing`) becomes the focal "did I show up" object; the dot pattern matches days walked.
- **Vs. previous period delta** — small but addictive. Pulled from the same query, no new endpoint.
- **Heatmap + mood arc** kept, but shrunk and side-by-side instead of stacked, so the whole header fits one viewport on mobile.
- **Signals row** (one line, scrollable): newest badge · current leaderboard rank in user's primary group · streak · any unread `group_signals`. This is where the lite social lives — never a tab, always a glance. Tapping a chip deep-links (badge → wall, rank → leaderboard, signal → sender's walk). No new components beyond a thin chip wrapper.

### Layer B — Memory ribbon (unchanged, slimmed)

Keep today's 8-week ribbon, shrink to ~88px tall, and snap-scroll. It's the bridge between dashboard and entries — a calendar with feeling.

### Layer C — Entries feed (the walk-as-entry primitive)

Each completed walk = one **EntryCard**. Most users will live here visually without ever tapping in.

#### The standard EntryCard (the hero design)

A 16:10 card with the **monochrome route snapshot as the background** (mono `mapStyles.mono()` already exists — the snapshot pipeline in `route-snapshot.ts` already paints in this style; we just surface it bigger). Soft duotone overlay (forest → cream) for legibility. No traffic, no labels, no pins — just the line of where you walked, treated as art.

```text
┌─────────────────────────────────────────┐
│  ░░░ monochrome route snapshot ░░░░░░░░ │
│  ░░░░░░░╱─────╲░░░░░░░░░░░░░░░░░░░░░░░ │
│  ░░░░░░╱       ╲░░░░░░░░░░░░░░░░░░░░░░ │
│                                         │
│  Sun · Nov 9 · 7:14am          ☁ 48°    │ ← top meta
│                                         │
│  42 min   ·   2.8 mi   ·   4,210 steps  │ ← stat trio (serif tabular)
│                                         │
│  solo · Riverside loop                  │ ← context
│  anxious → settled    +2                │ ← mood delta chip (only if set)
│  "the wind shifted halfway through"     │ ← reflection one-liner (only if any)
│  · 2 photos                             │ ← thin marker if photos exist
└─────────────────────────────────────────┘
```

- **One layout for all walks.** No variants. Empty fields just don't render — quiet walks become quiet cards. This kills the "is this user a power user?" branching from the previous plan.
- **Walk context line** uses what's already in `walk_sessions`: walk type (solo / guided / walk-talk / friend / event), and any group/event/route name we already store (or "no group" silence).
- **Photos shown as a count** ("· 3 photos"), not a mosaic. Photos belong inside the entry, not on top of it.
- **Share button** floats in the corner (already implemented).
- Cards group under sticky **month** labels (existing pattern).

#### EntryCard tap → detail pane (the reflection space)

The detail pane (existing `WalkDetailPane`) gets one focused upgrade:

- **Story view**: route snapshot at top (same mono treatment), then a single chronological column interleaving photos (when present) and notes (when present) by timestamp. If neither exist, the column is just the reflection paragraph + a "Add a reflection" inline editor.
- **Edit reflection only** (no editing of distance/time/mood — those are walk facts). Inline serif textarea with debounced save, optimistic toast — same plumbing as `end-walk-flow.tsx`.
- Existing share-card flow stays.
- **No "add photos later"** — captures stay tied to the walk as it happened.

### Layer D — Lightweight search & filter (above feed)

- One search input: matches reflection text, walk type, group/event name, mood.
- Three pill filters: **All · Felt heavier · Felt lighter** (uses existing `mood_before_score` → `mood_after_score` delta — turns analytics into curiosity). Keeping it emotional, not categorical.
- State held in URL params for back-button restore.

### Layer E — Badges + leaderboard, woven in (not added)

These already exist in the app. Don't add tabs, don't add cards — surface them inside the Journal:

- The existing **Badges** strip stays where it is, but rendered after the ribbon and before the feed, as a single horizontal scroller with the newest 6 + a "see all" link (route already exists).
- **Non-competitive leaderboard** (`get_leaderboard` already in DB): one collapsed section under badges titled **"Walking with you this week"** — shows user's group rank + 2 above / 2 below, no podium, no medals. Tapping expands to the full list inline.

---

## Technical Details

**Edited files**
- `src/components/walk-notes-sheet.tsx` — pill copy "Note this", icon swap, auto-collapse to dot after 8s idle.
- `src/routes/journal.tsx` — restructure into Layer A→E. Replace stats card + heatmap with the tracking strip; add period toggle (`week | month | all`) state that drives header aggregations only (entries feed always shows full history with search/filters).
- `src/components/journal/entry-card.tsx` *(new)* — single hero card primitive that consumes one `Walk` row + signed snapshot URL + photo count. Mono route snapshot as bg, duotone overlay, stat trio, optional context/mood/reflection lines.
- `src/components/journal/tracking-strip.tsx` *(new)* — Layer A; reuses `WeeklyRing`, existing `Heatmap`, `MoodArc`; computes period totals + previous-period delta from the already-fetched `walks` array (no new query).
- `src/components/journal/signals-row.tsx` *(new)* — chip row (latest badge, group rank, streak, unread signals).
- `src/components/journal/walking-with-you.tsx` *(new)* — calls `get_leaderboard` RPC scoped to user's primary group; shows ±2 around the user.
- `src/components/journal/entry-search.tsx` *(new)* — input + 3 mood-delta filter pills, URL param state.

**No new files for**: photo mosaic, photo essay variants, "add photo later", in-walk notebook. All cut.

**Data**
- Zero schema changes.
- One new lightweight fetch in journal: photo *counts* per walk (`select walk_session_id, count(*) … group by walk_session_id`) so EntryCard can show "· N photos" without N requests. Cached alongside existing snapshot URL bulk fetch.
- `get_my_rank` and `get_leaderboard` RPCs already exist — wire them in.

**Visual rules**
- Map snapshots use `mapStyles.mono()` (already the snapshot default in `route-snapshot.ts`). No labels, no traffic, no POIs — confirm the mono style strips them; if not, add `"visibility": "none"` filters in the snapshot path.
- Card height fixed at 16:10 so the feed has rhythm; reflection text truncates at 2 lines on the card (full text in detail view).
- Stat trio in cards uses the same serif-tabular treatment as `WalkStatTrio` — visual continuity from walking → journaling.

---

## Out of scope (explicit)

- In-walk always-open notebook (cut)
- Photo mosaic / photo essay card variants (cut)
- Add-photos-later (cut)
- Editing walk facts (distance, time, mood) — never
- Full-text search backend, audio notes, drawings — not this pass
- New badges, new leaderboard logic — surface only
