## Walk Onboarding Level-Up Pass

A focused refresh of the **pre-walk flow** (the screens between "Start a walk" and the active timer). Goal: take it from "passable 2013" to a 2026 ambient, mobile-first experience — using existing primitives, motion, and a richer mood vocabulary. Plus contextualize the **Guided Walk** with pre-recorded audio tracks (no AI).

---

### 1. Mood picker — the marquee fix

Currently a static 11-tag grid that wastes vertical space and looks like a 2013 form.

**New mechanic — "Drift Cloud":**
- Expand vocabulary to ~36 words across 3 mood-bands (heavy / tender / light), e.g. *"running on fumes," "low-grade hum," "soft," "tender," "sturdy," "quietly proud," "okay-ish," "wrung out," "static," "open," "raw," "buoyant"…*
- Per-session shuffle: `useMemo(() => shuffle(POOL).slice(0, 14), [sessionSeed])` so the user sees a fresh palette each open. Re-roll button (`↻ shuffle`) animates a re-deal.
- **Motion**: tags drift with subtle staggered float (`@keyframes drift` ±2px on Y, 6–10s, randomized delay/duration per tag). Selection: spring-scale to 1.06, color fill, haptic tap. Pauses motion via `prefers-reduced-motion`.
- **Layout**: `flex-wrap` with variable pill widths and a soft radial-gradient backdrop so it reads like a word-cloud, not a form. Vertical density doubles without feeling busy.
- **Free-typing escape hatch**: ghost input at the bottom — "or type one word…" — saves to the same `mood_before` field.

### 2. Mood scale — replace the slider

The native range input is the ugliest element on the screen. Replace with a **10-segment "weight bar"** — 10 thin vertical capsules, tap any to set, with a smooth fill sweep and the number counting up. Tappable on mobile (44px tall hit area), keyboard-friendly (←/→). About the same code as the current slider + accent-color hack.

### 3. Step cadence — collapse to one screen

Right now: feeling → score → intention. That's three taps before walking. Collapse into **one stacked card** with progressive reveal:
- Mood word (required-ish, but skippable)
- Weight bar fades in once a word is picked
- Intention textarea fades in once weight is set
- Single primary "Begin walking" CTA at the bottom; secondary "skip the rest" link

Net effect: one calm screen, scrolls if needed, fewer taps. We delete `step === 1, 2, 3` branching for solo walks.

### 4. Walk-type chooser — softer pre-screen

When user picks "Guided" / "Walk & Talk" / "Local," we currently land on the same generic mood form. Give each mode a **30-word context preface** (one line) above the mood picker so the experience doesn't feel templated. E.g. Walk & Talk: *"You'll be matched once you start moving."*

### 5. Guided Walk — contextualize with pre-recorded audio

This is the missing soul of the Guided mode. Today it just routes to the same active screen. Make it real.

**New table** (small, no AI):
```sql
guided_tracks (
  id uuid pk,
  title text, host text, host_role text,        -- "Maya, somatic coach"
  duration_seconds int,
  audio_url text,                               -- mp3/m4a in Supabase storage
  cover_url text,
  mood_tags text[],                             -- ["anxious","overwhelmed"]
  category text,                                -- 'ambient' | 'breath' | 'voice' | 'music'
  intro_seconds int default 30                  -- when voice starts; before that = ambient
)
```

**New screen — "Choose your guide":**
- Surfaces 4–6 tracks **filtered by the mood the user just picked** (intersect `mood_tags`).
- Card layout: large cover (square, 1:1), title, host, duration, soft play-preview button (15s).
- Categories shown as tabs at the top: *Ambient music · Breath · Voice · Stories*. Starts with Ambient as the lowest-friction option (works with no content yet — re-uses `AmbientPad` from Walk & Talk; just labelled "Generative ambient").
- Empty/seed state ships with **3 generative options** (re-skinning the existing `AmbientPad` keys: morning / midday / evening) so the feature is live on day one with zero hosted audio.

**Active walk integration**:
- `walk_sessions` gets a nullable `guided_track_id`.
- Active screen detects `walk_type === "guided_solo"` + `guided_track_id` → renders a slim audio player in the same slot the `WalkTalkDock` occupies (waveform-style scrubber, 15s skip, Now Playing on lock-screen via existing `MediaSession` plumbing).
- Generative tracks call `AmbientPad.start(volume, key)` instead of `<audio>` — same player UI.

This scales naturally: today = generative + 1 guest voice; tomorrow = podcaster partnerships, no architecture change.

### 6. Polish (cheap wins)

- **Haptic taps** on mood/weight selection (`navigator.vibrate(8)`).
- **Time-of-day backdrop** for the onboarding card mirrors the home hero gradient — continuity from "How are you arriving?" into the picker.
- **`safe-area-inset-bottom`** on the sticky CTA so it never collides with the tab bar.
- **`prefers-reduced-motion`** kills the drift animation.
- The same Drift Cloud component is reused in `EndWalkFlow` step 0 — one source of truth, fixes the post-walk "How are you arriving?" screen too.

---

### Net new code

- `src/components/mood-cloud.tsx` (~80 lines) — drift cloud + weight bar, used in 3 places
- `src/components/guide-picker.tsx` (~90 lines) — track list + preview
- 1 migration: `guided_tracks` table + RLS read-all, plus `guided_track_id` column on `walk_sessions`
- ~40 lines deleted from `routes/index.tsx` (collapsed steps)
- ~25 lines added to `routes/walk.active.$id.tsx` (guided player slot)

Roughly **+150 / −60 LOC**. No new dependencies.

### Build order

1. `MoodCloud` component (drift + shuffle + weight bar)
2. Collapse step 1-2-3 in `index.tsx` into one progressive card
3. Replace `EndWalkFlow` step-0 with `MoodCloud`
4. `guided_tracks` migration + 3 generative seeds (ambient pad keys)
5. `GuidePicker` screen, gated behind `walk_type === "guided_solo"` after mood capture
6. Active screen — render guided player slot

### Out of scope

- Real hosted audio uploads / podcaster onboarding (table is ready, content comes later)
- AI-generated content
- Changes to the marketing landing
