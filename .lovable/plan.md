## Goal

Level up badges, leaderboard, profile, and stickiness into something that feels best-in-class for 2026 — using primitives that already exist (walk_sessions, user_badges, badge_definitions, group_memberships, goals, weather_at_end, route snapshots). Minimal new code, maximum craft.

---

## 1. Profile — make it the centerpiece

Right now `/profile` is a settings form with a route mosaic. Reframe it as a **living identity card**.

**New layout (top to bottom, mobile-first):**

```text
┌─────────────────────────────┐
│  avatar · display name       │  ← long-press avatar → edit
│  city · "47 walks · 12h"     │
│  ▓▓▓▓▓▓▓▓░░  level ring     │  ← cumulative minutes → "Level 7 Walker"
├─────────────────────────────┤
│  badge wall (3-col grid)     │  ← earned in color, locked greyed at 30%
│  tap → sheet w/ how-earned   │
├─────────────────────────────┤
│  route mosaic (existing)     │
├─────────────────────────────┤
│  weekly ring · streak chip   │  ← 🔥 4-week streak
├─────────────────────────────┤
│  stats grid (4 tiles)        │  miles · minutes · groups · weather walked-through
├─────────────────────────────┤
│  settings (collapsed)        │  ← all current edit forms moved into a sheet
└─────────────────────────────┘
```

**Levels** (pure derivation, no schema): `level = floor(sqrt(totalMinutes / 30))`, label from a 12-entry array ("First Steps" → "Quiet Mountain"). Ring shows progress to next level.

**Streak**: derived in one query — count distinct ISO weeks with ≥1 completed walk, walking backwards from this week. No new table.

**Stats tiles** use existing columns: `SUM(distance_meters)`, `SUM(duration_seconds)`, `COUNT(DISTINCT group_id)`, `COUNT(*) WHERE weather_at_end->>'code' indicates rain`.

**Mobile capability**:
- Long-press avatar to edit (haptics.tap on press-in, soft on save)
- Pull-to-refresh on profile (hook already exists)
- Share-sheet button on header → uses existing `share()` helper to share a "Walker card" (re-use `share-card.ts` baker with profile variant)
- Vibrate `success` on level-up detection (compare last-seen level in localStorage)

---

## 2. Badges — from list to ritual

Currently badges live in `user_badges` and are evaluated server-side in `evaluate_badges()`. That works — we just don't surface them well.

**Badge wall component** (`src/components/badge-wall.tsx`, new, ~120 lines):
- 3-col grid of all `badge_definitions`, earned ones in full color with subtle `animate-in` shimmer, locked ones at 30% opacity with the icon outline only
- Tap → bottom sheet showing: large icon, name, "earned on Mar 4 after a rainy walk in Brooklyn" (use `walk_session_id` → date + city + weather)
- Long-press locked badge → "How to earn" hint pulled from `badge_definitions.description`

**New "soft" badges** (data-only, add to badge_definitions via migration — no logic changes since `evaluate_badges()` already handles unknowns gracefully; we extend the function to add ~6 new branches):

| Key | Trigger | Why it sticks |
|-----|---------|---------------|
| `weather_warrior` | 5 walks with rain in `weather_at_end` | Rewards showing up |
| `golden_hour` | walk started within 1h of sunset (we already have lat/lng + start time → derivable client-side, set via small server fn at completion) | Aesthetic/poetic |
| `dawn_patrol` | walk started before 7am local | Identity badge |
| `four_seasons` | walk in 4 distinct meteorological seasons | Long-arc commitment |
| `loop_closer` | finished within 50m of start point | Uses existing route snapshot |
| `companion` | 10 walks with `audio_room_id` not null | Social rewards |

These add up to ~30 lines in `evaluate_badges()` plus 6 rows in `badge_definitions`.

**Badge "earned" moment** (the dopamine hit): when `endWalk` returns and a new badge_id appears, show a full-screen `<BadgeEarnedSheet>` with the badge crystallizing in (reduced-motion respecting), haptic `success`, "Share" button. Currently we don't celebrate at all.

---

## 3. Leaderboard — top 100 walkers

**New route**: `src/routes/leaderboard.tsx`

**New DB primitive**: a single SECURITY DEFINER function `get_leaderboard(_period text, _scope text, _group_id uuid)` returning `{rank, user_id, display_name, avatar_url, city, total_minutes, total_walks, badge_count}`. Aggregates from `walk_sessions` joined to `profiles` and `user_badges`. RLS-safe because function owner bypasses + we only return public columns. Capped at 100.

**UI** (Strava-meets-Apple-Fitness aesthetic):
- Segmented control: `This Week / This Month / All-Time`
- Second segmented control: `Global / My Groups` (when in a group, scope = membership intersection)
- List rows: `#1 ▍ avatar  name · city  ·  124 min  ·  🏅 8`
  - Top 3 get gold/silver/bronze accent on the rank number, no gaudy crown emojis
  - Current user row is sticky-highlighted with a soft `--accent` bg, even if outside top 100 → "You're #247 — 12 minutes from #246"
- Tap any row → opens that user's profile sheet (re-use profile component in read-only mode)

**Performance**: cache per scope+period in a 2-min TanStack Query staleTime; one round-trip per view.

**Stickiness loop**: a small "Climb" pill on home if user is within 30 min of overtaking the next rank in their group's weekly board → "12 min to pass Sara this week."

---

## 4. Stickiness — three small mechanics that compound

All three are pure-derivation, no new tables.

**a) Week-in-review card** on home, Sundays only: minutes, badge earned, longest walk, weather mix, friend count. One "Share my week" button → uses share-card baker with a "week summary" template.

**b) Comeback nudge**: if last walk > 7 days ago AND streak just broke, the home Now & Next slot shows a soft "Welcome back. Two minutes still counts." (no shame, no red, just amber). Uses haptic `tap` on appearance only once per visit.

**c) Goal-met confetti**: when weekly minutes crosses the goal value, the WeeklyRing fills to gold and pulses once. Existing `WeeklyRing` already takes `minutes/goal`; we add a `metGoalThisWeek` prop and a 1.2s ease-out animation. Haptic `success` once per week (localStorage flag).

---

## 5. UI polish — modern, mobile-first, "2026"

These touches across the app cost almost nothing but raise the perceived quality bar:

- **Glass nav**: tab bar gets `backdrop-blur` + 70% surface opacity (currently flat). Already CSS-only.
- **Springy press states**: a `data-[active]:scale-[0.98] transition-transform` on cards/buttons — feels native iOS/Android.
- **Long-press menus** on walk journal entries (rename, delete, share) using a `<Drawer>` instead of nav. We already have drawer + haptics.
- **Skeleton loaders** with content-aware shapes for the badge wall, leaderboard, journal — replaces "loading…" text.
- **Dynamic island-style top toast** for badge-earned and goal-met (already have `sonner`, just custom render with rounded-full + blur).
- **Reduced-motion respect** everywhere new animation lands — `reducedMotion()` helper already exists.

---

## 6. Files to add / edit

```text
src/lib/walker-level.ts         (new, ~40 lines)  — pure deriv: minutes → {level, label, nextAt, pct}
src/lib/profile-stats.ts        (new, ~80 lines)  — single hook returns {minutes, walks, miles, groups, streak, rainyWalks, level}
src/components/badge-wall.tsx   (new, ~140)       — grid + earned sheet
src/components/badge-earned-sheet.tsx (new, ~80)  — full-screen celebration
src/components/leaderboard-row.tsx (new, ~60)
src/components/walker-card-header.tsx (new, ~90)  — avatar/name/level ring/share
src/components/week-in-review.tsx (new, ~80)
src/routes/leaderboard.tsx      (new, ~140)
src/routes/profile.tsx          (edit) — restructure as composition of above
src/routes/index.tsx            (edit) — slot week-in-review + comeback nudge
src/components/weekly-ring.tsx  (edit) — add metGoal animation
src/components/end-walk-flow.tsx (edit) — fire BadgeEarnedSheet on new badge
src/components/mobile-tab-bar.tsx (edit) — add Leaderboard tab? Or keep behind profile.
src/lib/share-card.ts           (edit) — add 'walker' + 'week' templates
src/server/walks.functions.ts   (edit) — endWalk returns newly-earned badge IDs
supabase/migration              (new)  — 6 new badge rows + extend evaluate_badges()
supabase/migration              (new)  — get_leaderboard() SECURITY DEFINER
```

Total new code: ~900 lines, almost all small focused components. No new tables.

---

## 7. Rollout order

1. Walker level + profile stats hook (foundation, zero UI)
2. Restructure profile route around new header + badge wall + stats grid
3. Badge wall + earned sheet + endWalk badge return
4. Leaderboard route + DB function
5. Week-in-review + comeback nudge + goal-met animation
6. Pass over UI polish (glass, springs, skeletons, toast)

Each step ships independently and the app stays usable throughout.

---

## Tone

The whole pass should feel like **care, not gamification**. Levels are named after places of stillness, not "ranks." Leaderboards highlight effort without shame for those below. Comeback copy is gentle. Badges celebrate showing up in hard weather, not crushing PRs. The goal is an app that feels like it understands the user's nervous system, not one that pressures them.
