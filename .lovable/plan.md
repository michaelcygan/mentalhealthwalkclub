# A concentrated level-up pass

The app already has the right primitives (Walk, Walk & Talk, Friend Walk, Journal, Groups, Events, badges, mood, reflections). This pass is about **squeezing more out of them** — not adding scope. Three principles drive every change:

1. **Mobile is the canvas.** Use haptics, safe-areas, gestures, system share, install, and motion that respects `prefers-reduced-motion`.
2. **Reuse, don't add.** No new tables, no new server functions, no new dependencies. Compose existing components into smarter surfaces.
3. **Calm > clever.** Every visual change should reduce cognitive load, not add ornament.

---

## 1. Quick fixes spotted while exploring (free wins)

These are bugs, not features. Bundling them into this pass.

- `src/routes/index.tsx` line 22 — page title reads `"Walk — Mental Health Mental Health Walk Club"` (duplicated). Fix to `"Mental Health Walk Club"`.
- `src/components/mobile-tab-bar.tsx` lines 141-170 — the **Add to Home Screen** install button is mis-nested *inside* the "Schedule a Friend Walk" `<button>`. That's invalid HTML and breaks both controls on some browsers. Pull the install block out as a sibling.
- `src/routes/__root.tsx` mobile top bar still uses an only-logo header → unauthenticated visitors lose the brand wordmark on mobile. Re-add a small wordmark line under the logo, or switch to a horizontal lockup at 14px.

---

## 2. The Walk tab — one breathing surface, not three steps

Today the home is `step 0 → step 1 → step 2` with the multi-step mood/intention form taking over the screen. On mobile this feels like a flow, not a home. Convert it into **one calm scroll** with a sticky bottom action.

- Replace the step-machine with a single screen that shows: greeting → mood-check chips → primary "Start a walk" → mode pills → friend walks → live now → weekly ring.
- Move mood/intention into a **bottom sheet that slides up from the Start CTA** (reuse the existing `Drawer` from shadcn/ui). The sheet has the existing `MoodCloud` + `WeightBar` + intention textarea — no new code, just relocated.
- Result: home is browse-able at all times, the existing primitives still drive the data, and the "I just want to walk" path is one tap → one drag-to-confirm → walk.
- Keep guided-walk picker as a separate screen (already perfect on its own).

---

## 3. The active walk — make the screen itself the experience

`/walk/active/$id` already has GPS, sparkline, dock, end flow. Tighten it into a true mobile-first surface.

- **Hero gradient + live numbers** at the top. Time and distance get the giant tabular-nums treatment (already have `tabular-nums` available). Mood-before pill sits below.
- **Edge-to-edge `RouteSparkline`** as a soft underlay behind the numbers (currently a small card). Pure CSS — no new component, just reposition + opacity.
- **One-thumb controls** pinned to the bottom safe-area: pause / end. Hidden swipe-up reveals reflection prompts and the Walk & Talk dock (already components).
- **Long-press end button** = haptic + confirmation, instead of a separate dialog tap. Reuse `EndWalkFlow` as the sheet content.
- **Auto-dim** when no interaction for 30s — drop UI to ~40% opacity, tap to bring back. Pure local state, no library.

---

## 4. Mobile system surface (the 2026 part)

These are small but disproportionately premium-feeling and use Web APIs already supported on iOS 17+ / Android 14+:

- **Visual viewport offset** — when the soft keyboard opens (intention textarea, reflection notes, schedule sheet), shift the sticky CTAs above it using `window.visualViewport`. ~15 lines in a `use-keyboard-inset` hook.
- **Web Share Target** — add `share_target` to `manifest.webmanifest` so users can share a podcast / article / image *to* the app and it lands as an intention seed for the next walk. Manifest-only, no new route needed if we accept text into `/?intention=…`.
- **Pull-to-refresh** on Journal and Groups — light, native-feeling, using a `touchstart`/`touchmove` overscroll detector (~30 lines, no library).
- **Edge swipe back** on `/walk/active/$id` to dock the walk into the existing `NowPlayingBar` instead of leaving — uses `pointerdown` near `clientX < 16`.
- **Dynamic theme-color** — flip `<meta name="theme-color">` to `--forest` while a walk is active so the iOS status bar matches the hero. ~5 lines in `walk.active.$id.tsx`.

---

## 5. Visual system tightening (no new tokens)

The token system in `src/styles.css` is already strong. We're using ~70% of it. Surface the rest:

- Promote `glass` and `glass-dark` (already defined, barely used) to: mobile top bar, NowPlayingBar, and the active walk hero overlay. Removes the flat opaque feel.
- Replace ad-hoc `bg-card/80 backdrop-blur-sm` chips with the `glass` utility.
- Add **one** new utility — `.text-balance { text-wrap: balance }` — and apply to the serif headings in: index hero, welcome dialog, auth, journal empty states. Single line, huge typographic upgrade.
- Standardize card radius to `rounded-3xl` for hero/feature cards and `rounded-2xl` for content rows. Currently mixed.
- Replace the static `breathe` animation on the Start CTA with a **reactive** version: scale paused while the user is not on the home tab (saves battery, less visually noisy when not relevant).

---

## 6. Smarter use of existing data (no new queries)

Everything below is already being fetched on the home screen — we're just composing it differently.

- **Adaptive greeting block.** Today: `"Good evening, name"`. Add a one-line micro-state read from the same weekly walks query already running:
  - 0 walks this week → *"A small one tonight?"*
  - Walked yesterday → *"Two days in a row feels good."*
  - 4+ days streak → *"Eight minutes is enough — your body knows."*
  No new fetches; same `weeklyDots` array.
- **Quick-resume chip.** If the last incomplete walk was within 90 minutes, surface it inline instead of as a separate banner — uses the same `activeWalkId` state.
- **"From your last walk"** — show the last reflection note (already on `walks` query) on the home as a quiet pull-quote in serif italics. One line of UX, huge emotional payoff.
- **Friend Walks merged with Live Now.** Today there are two separate strips. Compose them into a single `<NowAndNext />` carousel using existing `LiveNowStrip` + `UpcomingFriendWalks` — chronological, not categorical. Less visual noise.

---

## 7. Journal — make it a place, not a list

Journal is currently a chronological list with a sparkline. Two reuse-only upgrades:

- **Calendar heatmap** of the last 12 weeks using the data already in `weeklyMins` — replace the line sparkline with a 7×12 dot grid. ~25 lines, zero deps. Apple-Fitness-style.
- **Tap a walk row → opens an existing `Sheet`** with the full reflection, mood-before/after delta, and (if linked) the badge earned that day. We already track all of this; today it's invisible unless you go to Profile.

---

## Out of scope (intentionally)

- No new tables, columns, server functions, or third-party packages.
- No notification system, no push, no AI generation.
- No design-token rename or color overhaul.
- No payment / monetization.

---

## Files touched (estimated)

**Edited (~12, mostly small):**
- `src/routes/index.tsx` — flatten step machine, sticky-sheet mood, adaptive greeting, merged now-strip
- `src/routes/walk.active.$id.tsx` — hero numbers, edge sparkline, dim, dynamic theme-color
- `src/routes/journal.tsx` — heatmap + walk-detail sheet
- `src/routes/__root.tsx` — mobile header wordmark, glass surfaces
- `src/components/mobile-tab-bar.tsx` — fix nested-button bug, glass floor
- `src/components/now-playing-bar.tsx` — glass, swipe-up to expand
- `src/styles.css` — single `.text-balance` utility
- `public/manifest.webmanifest` — `share_target`

**New (3 small files, all <50 lines):**
- `src/hooks/use-keyboard-inset.ts` — visualViewport offset
- `src/hooks/use-pull-to-refresh.ts` — touch-based refresh
- `src/components/now-and-next.tsx` — composes existing strips

That's it — concentrated, reuse-first, mobile-native, and shipped in a single tight pass.