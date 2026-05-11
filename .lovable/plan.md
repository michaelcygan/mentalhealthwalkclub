## Audit findings

**Bug 1 — Slide 5 buttons do nothing.** `SlideFirstWalk` writes `profiles.onboarded_at` and navigates to `/`, but `HomeRoute`'s `onboarded` state was loaded once on mount and isn't refetched. Since the user object hasn't changed, `HomeRoute` keeps rendering `<EntryFlow startAtOnboarding />`, so the navigate to `/` is a no-op visually. The flow appears frozen.

**Bug 2 — Slide 4 group suggestions ignore the city the user just typed.** The query only filters by `themes` from sessionStorage, ordered by `member_count`. Location from Slide 2 is saved to `profiles` but never used for ranking. No GPS option offered.

**Other small issues spotted**
- "Start a walk" passes `search: { start: "1" }`, but `/` route has no `validateSearch` — fine but fragile; the WalkTab already reads `searchParams` directly so it works once HomeRoute actually mounts WalkTab.
- "Maybe later" should land on the home (WalkTab), not loop back into the flow.

---

## Fix plan

### 1. Unblock end-of-onboarding navigation

`src/routes/index.tsx`
- Lift onboarded state into a refreshable shape: add `onCompleted` callback passed to `<EntryFlow startAtOnboarding onCompleted={() => setOnboarded(true)} />`.
- Also re-check `profiles.onboarded_at` whenever `user.id` OR a local `tick` changes.

`src/components/entry-flow/entry-flow.tsx`
- Add optional `onCompleted?: () => void` prop on `EntryFlow`.
- In `SlideFirstWalk`, change `onStart` / `onLater` to:
  1. `await` the `onboarded_at` update (instead of fire-and-forget in `useEffect`),
  2. clear `wc_flow_step` and `wc_flow_themes` / `wc_flow_location` from sessionStorage,
  3. call `onCompleted()` so HomeRoute swaps to `<WalkTab />`,
  4. then `navigate({ to: "/", search: start ? { start: "1" } : {} })`.
- Move the `onboarded_at` write OUT of the `useEffect` so it only fires on intentional CTA tap (prevents marking onboarded if user backs out).
- "Maybe later — go home" navigates to `/` with no search params; WalkTab renders.

### 2. Make Slide 4 location-aware

`src/components/entry-flow/entry-flow.tsx` — `SlideLocation`
- After saving to `profiles`, also stash `{ city, region, country, lat, lng }` in `sessionStorage["wc_flow_location"]` so Slide 4 can read it without a profile fetch.
- Add a small "Use my current location" link under the autosuggest. On tap: call `navigator.geolocation.getCurrentPosition`, reverse-geocode via the existing weather/geolocation helper (`useGeolocation` already exists in `src/hooks/use-weather.ts`), prefill the autosuggest field. Graceful failure → silent.

`SlideGroups` — replace the simple ordering with a ranked merge:
- Read `wc_flow_location` and `wc_flow_themes` from sessionStorage.
- Run up to 3 parallel queries against `groups` (all `is_active=true`):
  1. **City match**: `ilike("city", city)` limit 6
  2. **Region/Country match**: `ilike("city", `%${region/country}%`)` OR fallback `country` column if present, limit 6
  3. **Theme match**: `.in("theme", themes)` limit 6
  4. **Global / popular** (always-on safety net incl. "everywhere" groups like The Commons): order by `member_count` limit 6
- De-dup by id; rank score = `(cityHit?3:0) + (regionHit?2:0) + (themeHit?2:0) + log(member_count+1)*0.3`. Take top 6.
- Empty location → fall back to themes + popular (today's behavior). Empty themes → city + popular.
- Search input still overrides with raw `ilike("name", …)` query.
- Subtitle dynamically reflects context: "Near {city}" or "Matched to your themes" or default.

### 3. Files touched
- `src/components/entry-flow/entry-flow.tsx` (SlideLocation, SlideGroups, SlideFirstWalk, EntryFlow signature)
- `src/routes/index.tsx` (HomeRoute: add `onCompleted` wiring)

No schema or RLS changes. No new files. No changes to other slides or the welcome card.

### 4. QA after changes
- New signup → walk through name → location (try GPS link) → themes → groups (verify city-matched groups appear at the top, e.g. typing "Tokyo" surfaces Tokyo Chapter first, themes still influence) → Slide 5 → tap "Start a walk" → drawer opens on home. Tap "Maybe later" → home renders WalkTab.
- Refresh on Slide 5 → still resumes correctly; tapping CTA still completes.
