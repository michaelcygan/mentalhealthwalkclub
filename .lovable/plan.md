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

8. ✅ **Walk recap softlanding** — `w.$code.recap.tsx` now opens with a staggered fade, a single serif-italic sentence keyed to the walk's most meaningful stat, h-display title, shadow-rest CTA. Honors reduced motion.
9. ✅ **Today Island time-of-day shift** — `AmbientBackdrop` carries a phase wash (dawn warm / day neutral / dusk amber+lavender / night cool), 1.2s eased transition between phases. 7-dot streak already shipped.
10. 🟡 **Now Playing sheet refinements**
    - ✅ **Sleep timer** — Moon pill cycles Off → 15 → 30 → 60 → Off with fade-out auto-stop.
    - ⬜ Inner glow on cover (color extraction)
    - ⬜ Thinner scrubber, larger thumb on press
11. ✅ **Page transitions** — `RoutedOutlet` cross-fade, ~180ms, respects `prefers-reduced-motion`.
12. ⬜ **Pull-to-refresh** — home & journal (post-launch nice-to-have).
13. ✅ **Share cards (OG)** — Fraunces serif title with -1 letterspacing, warmer gradient, soft sun glow, grain overlay, italic tagline footer. Matches in-app voice.

---

## Tier 3 — Optional craft (post-launch)

14. ⬜ Haptics map (success/soft variants beyond tab bar)
15. ⬜ Long-press preview on listen tiles
16. ⬜ Quiet mode toggle
17. ⬜ Breathing logo loading screen
18. ✅ **404 / error rewrites** — both 404 and `defaultErrorComponent` use h-display + serif-italic voice ("A small stumble", "Take a breath").

---

## Launch readiness

All launch-blocking items shipped. What remains is genuinely post-launch:
- Pull-to-refresh (#12) — native polish
- Cover glow + scrubber refinements (#10b/c)
- Haptics expansion, long-press preview, quiet mode, breathing logo (#14–17)

