## Radio rail redesign (pre-launch polish)

Scope: `src/components/home/radio-rail.tsx` + one generated cover image. No data or backend changes.

### Changes

1. **Rename header** — "MHWC Radio" → "Radio" (keeps the broadcast icon + free-minutes meter to the right).

2. **Generate a station cover image** — use `imagegen--generate_image` (standard tier) to create a warm, hand-drawn / textured graphic that fits the app's cream + forest palette. Saved to `src/assets/radio-cover-default.jpg` and imported as a fallback whenever a station has no `cover_signed` URL. This replaces the current empty gray tile with the small broadcast glyph.

3. **Desktop layout** — right now the rail renders 40-unit square cards in a horizontal scroller even on desktop, leaving the huge empty band shown in screenshot 1. On `md:` and up, switch to a responsive grid (`md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-4`) so cards fill the available width. Cards become landscape-ish (aspect-[5/3] cover + title/subtitle strip) for better use of horizontal space. Mobile keeps the current horizontal snap scroller.

4. **Mobile card polish** — same card component, but the cover area now always shows an image (station cover OR generated fallback) with a subtle gradient overlay and the broadcast icon pinned top-left. Title uses the serif face, subtitle sits below in muted tone. Slight shadow lift + rounded-3xl for a more designed feel.

### Out of scope
- No changes to `startStation`, usage tracking, paywall, or server functions.
- No new per-station images — one shared generated fallback for now.

### Technical notes
- File edited: `src/components/home/radio-rail.tsx`.
- New asset: `src/assets/radio-cover-default.jpg` (generated).
- Uses existing `Card`, `Shimmer`, `UpsellSheet`, `usePlayer`, hooks — no new dependencies.
- Tailwind responsive: mobile flex-scroller preserved via `md:hidden` wrapper, desktop grid via `hidden md:grid`.
