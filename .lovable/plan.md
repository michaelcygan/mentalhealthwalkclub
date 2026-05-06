## Goal
Another concentrated pass — unlock latent flow inside primitives we already have, modernize a few high-traffic surfaces, and use desktop space properly. No new tables. Net new code is small.

---

## 1. Active Walk screen — the single most important moment
Today the in-walk screen is a nice timer card and that's it. There's so much more we can do with data we already track.

- **Live mood pulse**: a gentle one-tap "how's it feeling?" chip strip that appears every 10 minutes. Stores nothing new — just the latest tap becomes the prefilled `mood_after` on the end screen, so reflection takes 1 tap instead of 3 steps.
- **Pace + cadence**: we already accumulate distance + time. Show current pace (min/mi) and average cadence (steps/min) in the stats grid. Zero new state.
- **Map preview**: small SVG path drawn from `points.current` (no map tile, no API). Gives tangible feedback that the walk is being captured. ~30 lines.
- **Milestone toasts**: at 5, 10, 20, 30 min and 1 mi → a soft toast ("first mile · take a breath"). Pure client-side, uses existing `elapsed`/`meters`.
- **Audio room discovery** is currently gated behind `hasMoved` (good) but invisible until then. Replace the "Confirming you're walking…" placeholder with a live **steps-needed indicator** + a preview list of rooms that are unlocking soon — keeps people engaged.

## 2. Walk completion → reflection becomes a delightful moment
Today it's three stacked inputs. Make it feel like a gift.

- **Three-card swipe-style step**: feeling → number → reflection, each full-bleed, with the previous mood shown as context ("You started anxious. Now…?"). Same data, better feel.
- **Mood delta payoff**: on save, show a 2-second animated reveal — "anxious → okay · +3" in a celebration card, then route to journal. Uses existing `mood_before_score`/`mood_after_score`.
- **Auto-suggest reflection chips** based on mood delta (e.g. positive delta → "what shifted?", negative → "what felt hard?"). Just static suggestions, no AI.

## 3. Desktop two-pane on Journal & Events
The biggest wasted space on `lg+` viewports.

- **Journal**: at `lg+`, walks list collapses to a left rail (320px); right pane shows the selected walk in detail (route map preview, full reflection, mood delta arc). Click a walk → updates local state, no route change.
- **Events**: same shape. Left = grouped event cards. Right = the selected event's detail rendered inline (reuses existing detail markup as a component). Mobile keeps the route-based detail page; desktop avoids the navigation context loss.

## 4. Groups detail — make it a destination
`/groups/$slug` is currently stubby. Without adding tables:

- **"Walkers here this week"** — count of distinct `walk_sessions.user_id` with `group_id = g.id` in the last 7 days. One number, big visual impact, signals life.
- **Recent shared walks** — last 5 `walk_sessions` with this `group_id` (anonymized: just first name + minutes + city). Builds proof.
- **"Walk with this group"** CTA on top — starts a solo walk with `group_id` pre-attached (already a column on `walk_sessions`), so it feeds the count above. Closes the loop.

## 5. Home — small but high-leverage tweaks
- **Mood prompt as the entry**: replace the four mode pills' position with a one-line mood chip strip at the very top ("How are you arriving?"). Tapping a chip jumps directly into a Solo walk with mode preselected — kills the funnel for the most common path. Mode pills move below as "Other ways to walk."
- **Time-of-day hero**: subtle background gradient that shifts by hour (dawn / day / dusk / night) using existing forest/clay/cream tokens. Zero asset cost, big "alive" feeling.
- **Streak tile**: today the dots are subtle. Add the count ("3-day streak · keep it gentle") with a quiet flame icon — but explicitly never shame skips ("rest is part of walking").

## 6. Welcome / onboarding micro-improvements
- **Skip to walking**: add "Just let me walk" link on every onboarding step. Reduces drop-off, all data is optional anyway.
- **First-walk callout** on home for users with `walks.length === 0`: a single soft card "Your first walk is the hardest. 5 minutes counts." with a 5-min preset CTA.

## 7. Visual polish (focused, not sprawl)
- **Card system pass**: standardize on three card depths — `flat` (border only), `soft` (current default), `elevated` (active/hero). Replace the ~12 ad-hoc combinations.
- **Numeric typography**: `tabular-nums font-serif` everywhere stats appear (already partly done). Locks the visual rhythm.
- **Empty states**: add a shared `<EmptyState icon={...} title="..." action={...} />` component. Today every empty state is a different div.
- **Breathing animation** on the active walk's elapsed timer (subtle 4s scale 1 → 1.02). Reinforces the calm tone.

## 8. Tiny perf + correctness wins
- **Realtime on `audio_rooms`**: subscribe in the sidebar pill + Live Now strip so live counts update without 30s polling. Free, since the table is small.
- **Default city on home Live Now strip**: only show events in user's city (we already have `profiles.city`).
- **`useEffect` cleanup** on the sidebar pill — currently fine, but we should add an unsubscribe when realtime is added.

---

## Out of scope (call out)
No new tables, no payments, no notifications system, no avatar uploads, no real maps. If you want any of those, that's the next plan after this one.

---

## Files touched (estimated)
- `src/routes/walk.active.$id.tsx` — pulse, pace, map preview, milestones (~80 lines net).
- `src/routes/walk.active.$id.tsx` end-screen — split into 3 micro-steps + delta reveal (~40 lines).
- `src/routes/journal.tsx` — desktop two-pane (~30 lines).
- `src/routes/events.tsx` + tiny detail extract — desktop two-pane (~50 lines).
- `src/routes/groups.$slug.tsx` — walkers count + recent walks + CTA (~40 lines).
- `src/routes/index.tsx` — mood entry strip, time-of-day hero, streak text (~30 lines).
- `src/components/empty-state.tsx` — new, ~15 lines, used everywhere.
- `src/components/route-sparkline.tsx` — new SVG path renderer (~25 lines).
- `src/components/live-now-strip.tsx` — realtime subscribe (~10 lines).

Net: ~3 small new components, 6 route edits, no schema changes.

---

## Suggested order
1. Active walk upgrades (pulse, pace, map preview, milestones) — biggest emotional payoff.
2. Reflection flow + delta reveal.
3. Desktop two-pane on Journal & Events — biggest desktop win.
4. Groups detail destination.
5. Home entry pivot + time-of-day hero + streak text.
6. Realtime + polish.

Proceed with all, or trim?