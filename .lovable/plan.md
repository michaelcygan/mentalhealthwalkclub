## Two changes

### 1. Standardized location autosuggest (keyless, free)

**Provider:** Use **Photon** (https://photon.komoot.io) — keyless, free, no signup, OpenStreetMap-backed, returns structured `{city, state, country}`. Fallback option: Nominatim, but Photon has better autosuggest UX and a more permissive usage policy for client-side calls.

**Storage shape:** Stop storing free-text city. Normalize to:
- `city` (string, e.g. "Chicago")
- `region` (string, e.g. "IL" / "Illinois")  
- `country` (string, ISO-2, e.g. "US")
- `location_label` (string, display form: "Chicago, IL, US")
- `lat`, `lng` (numeric, for nearby filtering later)

Migration: add `region`, `country`, `location_label`, `lat`, `lng` to `profiles`, `events`, `groups`. Keep existing `city` column for backward compat. Backfill `location_label` from existing `city` where present.

**New component:** `src/components/location-autosuggest.tsx`
- Debounced (300ms) Photon query as user types
- Dropdown of suggestions; selecting one populates all 5 fields
- Cannot submit with raw free-text — must pick a suggestion (prevents blanks/typos)
- "Skip" still allowed where currently optional (onboarding step 1)

**Wire it into:**
- `src/routes/welcome.tsx` step 1 (onboarding)
- `src/routes/profile.tsx` (profile edit — replace plain Input)
- `src/routes/events.tsx` filter (replace text city chips with location picker, filter by `city` match)
- `src/routes/groups.tsx` (display `location_label`)
- Any admin event/group create forms

### 2. Rename "Audio walks" → product naming pass

User dislikes "Audio walks" but "Group Walks" collides with IRL. Proposal:

| Current term | New term | Why |
|---|---|---|
| Audio walks (product/feature) | **Companion Walks** | Captures the "walk together via voice" feel without claiming "group" (which IRL owns) |
| Walk modes (Solo / Guided Solo / Audio / IRL Event) | Solo / Guided Solo / **Companion** / In-person | Consistent vocabulary |
| `audio_rooms` table | keep table name (internal) | No DB rename needed |
| Onboarding step 4 heading "Audio walks" | "Companion walks" | |
| Active walk panel "Audio room" | "Companion room" | |

I'll ask you to confirm "Companion Walks" vs alternatives (Walk & Talk, Voice Walks, Together Walks) before doing the rename — that's a question for the build phase, not exploration.

## Technical notes

- Photon endpoint: `https://photon.komoot.io/api/?q={query}&limit=5&layer=city` — returns GeoJSON with `properties.name`, `properties.state`, `properties.country`, `properties.countrycode`, plus `geometry.coordinates [lng, lat]`.
- Client-side fetch only; no server function or secret needed.
- Migration adds nullable columns — no data loss, no breaking change.
- Search params on `/events` switch from `?city=Chicago` to `?city=Chicago&region=IL` for disambiguation.

## Files

**Create:** `src/components/location-autosuggest.tsx`, migration  
**Edit:** `welcome.tsx`, `profile.tsx`, `events.tsx`, `groups.tsx`, `index.tsx` onboarding mini-flow, `welcome-dialog.tsx` copy

## Open question for build phase
Confirm rename target ("Companion Walks" vs other) before I run the find/replace.