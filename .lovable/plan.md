## Reflection prompts across the walk

A new shared library of reflection prompts, surfaced as gentle, slow-moving slideshows in three places — most prominently in Walk & Talk's quiet/music waiting state, where the screen otherwise sits empty.

### The library

- Take your 100 prompts as the seed corpus, lightly edited to match the app's voice (short, lowercase-ish, second-person, never clinical).
- Expand to **~250 prompts** by writing variants in the same voice, organized by **mood family** so we can serve ones that fit the walker:
  - `heavy` — for anxious / overwhelmed / sad / numb
  - `tender` — for fragile / restless / wistful / unsettled
  - `steady` — for okay / focused / present
  - `light` — for hopeful / grateful / open / curious
  - `connection` — for need-to-vent / need-company / lonely
  - `universal` — works for any state (the largest bucket)
- Each prompt also gets a **depth tier**: `noticing` (surface, body-aware, no commitment), `reflecting` (a memory or pattern), `imagining` (future-oriented, hopeful). The slideshow always opens with `noticing`, drifts to `reflecting`, only occasionally to `imagining` — same shape as a real walk.
- Stored in `src/lib/reflection-prompts.ts` as a typed array. No DB migration needed (these are content, not user data). A small `pickPrompts(mood, count)` helper matches the walker's `mood_before` to a family with universal fallback.

### The slideshow component

New `<ReflectionDrift>` component:
- Shows one prompt at a time, large, serif, centered.
- Auto-advances every **18 seconds** with a slow crossfade (no swipe-style snap — feels like thoughts surfacing).
- A barely-visible progress hairline under the prompt fills over the 18 s.
- Tap to **pause / resume** the drift; long-press to **save** the prompt to the walker's reflection (fed into End-Walk Flow's reflection field as a starting line).
- "Skip" arrow on the right for the impatient; "next" never has urgency styling.
- A tiny "✿ for you" chip when the prompt was matched to the walker's mood, so the personalization is felt without being announced.
- Respects `prefers-reduced-motion`: crossfade replaced with instant swap.

### Where it appears

1. **Walk & Talk — alone, quiet chosen** *(primary surface)*
   Replaces the empty constellation circle copy with the drifting prompts; the constellation shrinks to a small badge in the corner so users still know the room exists. Returns to full constellation the moment another walker joins.

2. **Walk & Talk — alone, music chosen**
   Same drift, but tinted toward "noticing" prompts and slowed to 24 s between prompts so it pairs with the ambient pad rather than competing.

3. **Solo / Guided — at the 7-minute mark**
   A single prompt slides up as a soft sheet over the hero (not a toast), dismissable. Doesn't interrupt audio. Same long-press-to-save behavior.

4. **End-walk reflection step**
   The "A line for future you" textarea gets a "need a starting line?" link that reveals 3 prompts matched to the walker's `delta` (got lighter / no change / heavier). Tap to seed the textarea.

### Data flow & persistence

- Saved prompts are kept in component state during the walk and folded into `reflection_note` on End walk, prefixed as quoted lines, e.g. `"What helped you feel grounded today?" → I noticed my breath`.
- No new tables. No realtime. No user input leaves the device until End walk.

### One bug to fix on the way through

The current Walk & Talk preview screenshot shows a runtime error toast. Most likely cause from the last pass: `EndWalkFlow`'s autosave-on-unmount fires when the component first unmounts as part of route reuse, calling `onSave` with empty fields and triggering navigation/state churn. Fix by gating autosave on a `hasInteractedRef` (only autosave if the user actually engaged with mood/score/reflection), and by guarding `onSave` against being called when the parent has already navigated. Also wrap `toast.custom` returning JSX in a function `(t) => …` strictly typed — sonner's signature change can throw if the id arg is missed.

### Files I'd touch

- new `src/lib/reflection-prompts.ts` — corpus + `pickPrompts(mood, count, depth?)`
- new `src/components/reflection-drift.tsx` — the slideshow primitive
- `src/components/walk-talk-dock.tsx` — render `<ReflectionDrift>` in the alone state (both quiet and music branches), shrink constellation when drifting
- `src/routes/walk.active.$id.tsx` — slide-up sheet at 7-min mark for Solo / Guided (no extra audio interruption)
- `src/components/end-walk-flow.tsx` — "need a starting line?" prompt picker; bug fix for autosave guard
- `src/styles.css` — `@keyframes reflection-fade` (550 ms ease) + reduced-motion override

### Out of scope

- AI-generated prompts (you specified pre-recorded only).
- Cross-walker prompt voting/curation.
- Saving prompts to a personal library outside a single walk's reflection.

### Verification

- Open Walk & Talk in the preview, hit "I'm walking — start the room", confirm the drift renders with mood-matched prompts and the constellation shrinks to a corner badge.
- Confirm long-press saves a prompt and that it shows up pre-filled in End-Walk's reflection field.
- Confirm the error toast no longer fires on entering / leaving the active-walk route.
- Re-screenshot at 390×726 to verify the prompt fits with safe margins and doesn't overlap the cockpit.
