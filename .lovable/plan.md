# Reusable LoadingScreen component

## New file
`src/components/loading-screen.tsx` — single source of truth for the app's loading state.

```tsx
interface Props {
  /** "screen" (default) fills the viewport. "inline" fills its parent. */
  variant?: "screen" | "inline";
  /** Visible status text under the mark. Default "Loading…". Pass null to hide. */
  label?: string | null;
  /** Logo size in tailwind units. Default 40 (h-40 w-40). */
  size?: 24 | 32 | 40;
  className?: string;
}
```

- Renders `/logo-stamp.png` with the existing `animate-[loader-breathe_…]` animation.
- Renders the label below in muted, low-key type: `text-xs uppercase tracking-[0.2em] text-muted-foreground`, gently pulsing via `animate-pulse` so it feels alive, not loud.
- `role="status"` + `aria-live="polite"` for a11y; `aria-label` from `label`.
- `screen` variant uses `flex min-h-screen items-center justify-center bg-background`; `inline` uses `flex w-full items-center justify-center py-16`.
- Honors existing `prefers-reduced-motion` rule already in `src/styles.css`.

## Call-site swaps
Replace the three duplicated loader blocks with `<LoadingScreen />`:

- `src/routes/__root.tsx` line 256–267 → `<LoadingScreen />` (screen, size 40).
- `src/routes/walk.active.$id.tsx` line ~451 → `<LoadingScreen size={32} />`.
- `src/routes/w.$code.tsx` line ~178 → `<LoadingScreen size={32} />`.

No styling, animation timing, or layout changes beyond adding the small "Loading…" caption — purely a consolidation.

## Out of scope
- No changes to the keyframes in `src/styles.css`.
- No swap of in-component skeletons (route-level loaders only).
