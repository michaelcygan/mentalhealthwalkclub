# Guided "Start a Walk" — Music + Podcast refactor

## Context

Right now the Guided picker has two tabs: **Voice guide** and **Podcast**. The Voice tab has four category chips (Ambient, Breath, Voice, Music) and lists `guided_tracks`. There are no voice guides yet — only ambient music is being uploaded — so the current framing misleads users.

## Goal

Reframe the picker around what actually exists today (ambient music) while keeping room for future categories (breath, voice, etc.).

## Changes

### 1. Top tabs: rename "Voice guide" → "Music"

In `src/components/guide-picker.tsx`:
- Tab labels become **Music** and **Podcast** (equal weight, same pill styling).
- Music tab uses a `Music` icon (lucide); Podcast keeps `Headphones`.
- Internal state rename: `tab: "voice" | "podcast"` → `tab: "music" | "podcast"`. Default tab stays whichever was previously default ("voice" → now "music").

### 2. Remove category chip strip on the Music tab (for now)

- Delete the `VOICE_CATS` chip row and the `cat` filter UI from the Music tab.
- Keep the `category` field in the data model untouched — we'll just hard-filter to `category = "ambient"` for the initial list so only ambient music shows.
- Leave a clear single-line code comment noting that the category chip strip should return once breath / voice / music sub-categories are populated. No structural removal of `VOICE_CATS` constant — keep it commented or behind a `false &&` so re-enabling later is one-line.

### 3. List behavior on the Music tab

- Show all active `guided_tracks` where `category = 'ambient'`, ordered by `sort_order` (existing query already pulls all active tracks; just filter client-side).
- Keep the existing row layout (cover thumbnail + title + host/duration + hover preview button via `AmbientPad`).
- Mood-fit sort (`mood_tags.includes(mood)` to top) stays.
- Empty state copy: "Ambient music is being added — check back soon."

### 4. Header copy

- Section heading stays "Choose your guide".
- Subtitle on the Music tab: `mood ? "Ambient music to match <mood>." : "Ambient music for your walk."`
- Podcast tab subtitle unchanged.

### 5. Podcast tab

No changes — already in good shape from the previous pass.

## Out of scope

- No DB migration, no schema changes.
- No changes to playback, walk-runtime, or composer wiring.
- Voice / Breath sub-categories will be re-introduced as a follow-up once content exists.

## Files touched

- `src/components/guide-picker.tsx` — only file. Tab rename, chip strip removal, hard filter to `ambient`.

## Technical notes

- Default tab on first open: `"music"`.
- Filter: `tracks.filter(t => t.category === "ambient")` replaces the `cat`-driven filter.
- Keep the `AmbientPad` preview wiring intact — it's used by ambient tracks specifically.
