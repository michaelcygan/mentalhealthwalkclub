# Polish the Plan-a-walk flow

## 1. Fix the "Create walk" crash (root cause of the error toast)

The DB constraint `events_audience_mode_check` only allows
`public | friends | circles_allowlist | friends_except_blocklist | group`.
`createWalk` writes `audience_mode = 'private'` for both `group` and
`link_only` audiences, which fails the check.

Fix in `src/lib/walks.functions.ts` (createWalk handler):
- `open` → `audience_mode = 'public'`, `visibility = 'public'`
- `group` → `audience_mode = 'group'`, `visibility = 'group'`
- `link_only` → `audience_mode = 'public'`, `visibility = 'link_only'`
  (link_only is publicly viewable to anyone with the link; visibility
  already encodes that — audience_mode just needs a legal value)

No migration. No data backfill needed (no successful inserts yet).

## 2. Modernize "When" — mobile-first date + time

Replace the lone `<input type="datetime-local">` with a 2026-style
composite picker built from existing shadcn pieces (no new deps).

### Quick-date chips (always visible)

A single row above the picker with smart presets:

```text
[ Today ] [ Tomorrow ] [ Sat ] [ Sun ] [ Next week ] [ Pick a date ]
```

- Active chip = highlighted forest pill.
- "Pick a date" opens a `Popover` + `Calendar` (already in
  `src/components/ui/calendar.tsx`) for any other date.
- Past dates disabled.

### Time as a drum-wheel sheet

Tapping the time row opens a bottom `Sheet` with three scroll-snap
columns (Hour · Minute · AM/PM) — iOS-style wheels built from a
vertical `overflow-y-auto snap-y snap-mandatory` list with item-height
snapping. Lightweight (~120 LOC), no library.

- Minutes step by 5 (00, 05, 10, …55).
- Pre-selects nearest future :00 or :30.
- Center row is the selection; faded neighbors above/below.
- Sheet footer: large "Set time" button.

### Display row

The collapsed control reads:

```text
Tomorrow, Jun 8  ·  5:00 PM        [chevron]
```

- Tapping the date side scrolls chips/opens calendar.
- Tapping the time side opens the wheel sheet.
- Smart timezone hint underneath ("Times in your timezone — America/Chicago").

### File layout

- New `src/components/walk-page/when-picker.tsx` — exports `<WhenPicker value onChange />` with date chips + wheel sheet.
- `walk.new.tsx` swaps the `<Input type="datetime-local">` block for `<WhenPicker />`.

## 3. First-walk walkthrough (2-3 coach marks)

Show only when the host has never created a walk
(`profiles.walks_hosted === 0`, fetched once on mount via the existing
client).

- Step 1 (on Where): "Start with a place — search a park, trail, or
  neighborhood."
- Step 2 (on When, after place is picked): "Tap to set a time —
  scroll like a phone wheel."
- Step 3 (on Create button, after time is set): "You'll get a
  shareable link — send it to one person, that's enough."

### Implementation

- New `src/components/walk-page/first-walk-coach.tsx` — a tiny
  controlled overlay component. Renders a fixed-position dark scrim
  with a single tooltip card pointing at a ref'd target element via
  `getBoundingClientRect`.
- State: `step: 0|1|2|3` (3 = done). Dismisses to `localStorage`
  key `mhwc.walk.coach.v1 = "done"` so it never re-shows once
  finished or skipped.
- Skip link in every step. Auto-advances when the relevant field is
  filled (place picked → step 2 unlocks; time set → step 3 unlocks).

## 4. Small polish (same pass)

- "Where" search input: add `inputMode="search"` and
  `autoComplete="off"`, and show recent picks (last 3 places from
  `getMyRecentWalkPlaces` if it exists, else skip — read-only check).
- "Title" auto-suggests `Walk at {place}` only if user hasn't typed.
  Already does this — keep.
- Disable "Create walk" until title + startsAt + (audience !== group ||
  groupChoice) are valid — currently relies on toast errors after click.
- Add `aria-label`s on the wheel columns for accessibility.

## Technical summary

**Edited files**
- `src/lib/walks.functions.ts` — fix `audience_mode` mapping.
- `src/routes/_authenticated/walk.new.tsx` — swap When control, mount coach, disable submit when invalid.

**New files**
- `src/components/walk-page/when-picker.tsx` — chips + wheel sheet.
- `src/components/walk-page/first-walk-coach.tsx` — 3-step overlay.

**No DB migration. No new dependencies.** Wheel uses native scroll-snap; calendar uses existing `react-day-picker`-based shadcn `Calendar`; sheet uses existing shadcn `Sheet`.
