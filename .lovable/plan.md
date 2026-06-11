# Final UI/UX Pass — Lofi 2027 Polish

Status legend: ✅ shipped · 🟡 partial · ⬜ pending

---

## Tier 1 — Cohesion pass

1. ✅ **Unified motion grammar** — `src/lib/motion.ts` with `easeOut`, `dur`, `springSoft`, `springSnap`. Wired into dock, sheet, tab bar, FAB. Remaining sweep: rails / today-island / walk pages can adopt opportunistically (no urgency).
2. ✅ **Surface & elevation system** — `--shadow-rest/hover/floating` + `--surface-1/2/3` tokens in `styles.css`; floating shadow applied to dock, sheet, FAB, tab bar.
3. ✅ **Lofi grain + warmth** — Already in `body` (SVG noise + warm radial). Verified no extra overlay needed.
4. ✅ **Typography rhythm** — `.h-display / .h-title / .h-section / .t-eyebrow / .t-caption / .t-hand` semantic classes shipped.
5. ✅ **Skeletons that breathe** — `<Shimmer />` with sweep animation; replaces pulse blocks in home, search, rails.
6. ✅ **Empty states with voice** — `<EmptyNote />` primitive shipped; wired into search no-results. (Journal / friend pulse can adopt later — same primitive, no new design.)
7. ✅ **Accessibility & focus** — global `:focus-visible` ring, 44×44 dock tap targets, `aria-live="polite"` on dock title.

---

## Tier 2 — High-impact moments

8. ⬜ **Walk completion screen** — new `walk.recap.tsx` with softlanding flow.
9. ⬜ **Today Island upgrades** — time-of-day color shift on `AmbientBackdrop` + 7-dot streak chip.
10. 🟡 **Now Playing sheet refinements**
    - ✅ **Sleep timer** — Moon pill cycles Off → 15 → 30 → 60 → Off. Player context handles fade-out + auto-stop. Live countdown in pill.
    - ⬜ Inner glow on cover (color extraction)
    - ⬜ Thinner scrubber, larger thumb on press
11. ✅ **Page transitions** — `RoutedOutlet` with `AnimatePresence`, 4px slide + fade, ~180ms, respects `prefers-reduced-motion`.
12. ⬜ **Pull-to-refresh** — wire existing `use-pull-to-refresh` on home & journal with rotating leaf indicator.
13. ⬜ **Share cards (OG)** — audit `walk.$code.og.ts` for typography parity.

---

## Tier 3 — Optional craft (post-launch)

14. ⬜ Haptics map (success/soft variants beyond tab bar)
15. ⬜ Long-press preview on listen tiles
16. ⬜ Quiet mode toggle
17. ⬜ Breathing logo loading screen
18. 🟡 **404 / error rewrites** — 404 now uses h-display, italic serif tone, shadow-rest CTA. Error boundary still default.

---

## What's next

Tier 2 picks, in suggested order:
- **#11 page transitions** ✅ done — feel the difference on any nav.
- **#9 Today Island upgrades** — small, very visible on home.
- **#8 Walk recap** — biggest "moment" lift; needs a route + design pass.
- **#12 pull-to-refresh** — quick, native-feel win.
- **#10b/c cover glow + scrubber polish** — nice-to-have.
- **#13 OG audit** — share leverage.

Say the word on which to pick up next, or "all of Tier 2" and I'll batch.
