# When picker — second pass

## Reduce date row to 3 affordances

Replace the scrollable preset list with exactly three equal-width tiles in a single non-scrolling row that fits any phone width:

```text
[ Today ] [ Tomorrow ] [ Pick a date ]
```

- `grid grid-cols-3 gap-2`, each tile a full pill with same height as the time row beneath it.
- Active date highlights whichever tile owns it (Today/Tomorrow auto, else "Pick a date" lights up and its label swaps to the selected date, e.g. "Sat, Jun 13" — so the user always sees their chosen date on the trigger).
- Tap "Pick a date" → open the existing `Calendar` popover. On screens < `sm`, render it as a bottom `Sheet` instead of a popover so the calendar isn't cramped or clipped on mobile.
- Remove Sat / Sun / Next week presets entirely (the calendar covers them; three options keeps cognitive load low).

## Make the time row obviously tappable

The current "5:00 PM · America/Chicago" row reads like static text. Three changes:

1. **Label the action**: prepend a small lozenge on the right that reads "Tap to change" in tiny uppercase; replaces the plain chevron. After the user opens the wheel once, the lozenge fades out and a plain chevron remains.
2. **Animated nudge**: the right-side chevron gently bounces (subtle 6px translateY loop, 1.6s, ease-in-out, infinite) until the user has either opened the time sheet at least once OR moved the time off the default. Stops immediately on first interaction. Respects `prefers-reduced-motion` (static chevron).
3. **Soft pulse ring**: a one-shot, very low-opacity forest ring (`ring-2 ring-forest/30`) pulses on the time row for ~2 seconds after the date changes, then stops — a visual handoff from "you picked a day" to "now pick a time."

Persistence: store `mhwc.walk.time.touched = "1"` in localStorage so the nudge never re-appears on subsequent visits.

## Why this is calmer, not lazier

- 3 tiles always fit a 320px viewport — no horizontal scroll, no clipped chips.
- "Pick a date" tile doubles as the selected-date display, so there's no information lost from dropping Sat/Sun/Next week.
- The animated chevron + handoff pulse are the cheapest possible "do this next" hint — no copy, no modal, no friction.
- All animation stops on first interaction. No bounce-inducing motion lingering on the page.

## Files

- `src/components/walk-page/when-picker.tsx` — restructure date row to 3 tiles; conditionally render calendar in Sheet on mobile, Popover on `sm+`; add animated chevron + pulse handoff; add localStorage touched flag.
- `src/styles.css` — add a small `@keyframes wp-chevron-nudge` and `@keyframes wp-pulse-ring` plus matching utility classes scoped to the picker, gated behind `@media (prefers-reduced-motion: no-preference)`.

No DB changes. No new deps.
