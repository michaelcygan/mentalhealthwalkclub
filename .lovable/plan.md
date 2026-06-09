# Tab bar, header & spacing refinements

Three focused tweaks to the chrome introduced in the last pass.

## 1. Center the compose "+" in the tab island

Right now the "+" sits between tabs 2 and 3, so it drifts off-center as the active tab's label expands. Pin it dead-center while keeping the label-expand animation.

- In `src/components/mobile-tab-bar.tsx`, change the `<nav>` to use a 3-column layout: left tab cluster · centered compose pill · right tab cluster.
  - Wrap the island in `relative`, render left tabs (`Home`, `Discover`) and right tabs (`Journal`, `More`) as two `<ul>`s with equal flex weight (`flex-1`), and absolutely position the compose button at `left-1/2 -translate-x-1/2`, slightly raised (`-top-1`) so it reads as the focal point.
  - The compose pill stays the same size/shape; the expand-on-active label trick on `TabItem` is unchanged because each side keeps its own `layoutId="tab-active-pill"`-scoped pill — split into `tab-active-pill-left` / `-right` to avoid the shared layout animation flying across the centered "+".
- Keep haptics, escape-to-close, and the popover stack above the pill (anchor the action stack to the center too).

## 2. Full-width persistent header (no pill)

Replace the floating header pill with a full-width sticky bar, matching the screenshot's intent of "anchored chrome, not floating chip."

- In `src/routes/__root.tsx` `TabBar()`:
  - Drop the `flex justify-center` + `max-w-[calc(100%-0.5rem)]` + `rounded-full` pill wrapper.
  - Render `<header>` as `sticky top-0` (mobile only), full bleed: `bg-background/85 backdrop-blur-xl border-b border-border/60`, with `padding-top: env(safe-area-inset-top)` and a compact inner row (`h-12 px-4`).
  - Keep the same contents: logo + wordmark on the left, Support (LifeBuoy) icon or Sign up button on the right. Icon button shrinks to `h-8 w-8`.
  - Because it's sticky and in-flow now, remove the artificial top padding that compensated for the floating island.

## 3. Tighter top padding so the first page header sits closer

- In `AppFrame`'s `<main>` inner container (currently `pt-[calc(env(safe-area-inset-top)+68px)]`), reduce to roughly `pt-3` on mobile — the sticky header already owns the safe-area inset and its own height, so the main content only needs a small breathing gap.
- In `src/routes/index.tsx` `HomeTab`, trim the greeting block: drop the uppercase eyebrow's top margin and tighten the gap between eyebrow and the H1 (e.g. `mt-0.5` instead of `mt-1`), and reduce the outer `space-y-5` → `space-y-4` so the hero quick actions and weather pill pack in tighter.
- Apply the same pattern to other first-screen routes only if they obviously suffer — Discover already has its own sticky segmented control and is fine.

## Out of scope

- No backend, copy, or icon changes.
- Desktop sidebar layout untouched.
- Now-playing dock untouched.
