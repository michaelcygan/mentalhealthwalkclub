# Bottom Nav → Floating Pill Island

Modernize the mobile tab bar (the bar circled in your screenshot) into a floating "pill island" — the dock pattern trending into 2027. Edge-to-edge bar becomes a centered, rounded, glassy capsule that hovers above content.

## What changes

**`src/components/mobile-tab-bar.tsx`** — full rewrite (still 4 tabs: Home, Discover, Journal, Profile).

- Floating capsule: centered, ~max 360px, `mx-auto`, `bottom: env(safe-area-inset-bottom) + 12px`, `rounded-full`, height ~60px.
- Glass surface: `bg-background/70 backdrop-blur-xl` with a hairline border (`border-border/60`) and soft drop shadow (`shadow-[0_10px_30px_-12px_rgba(0,0,0,0.25)]`).
- Active indicator: a forest-tinted rounded pill that slides between tabs using `motion/react` `layoutId="tab-active-pill"` (spring) — same pattern the journal period toggle already uses.
- Active tab: icon scales subtly + label appears; inactive tabs collapse to icon-only for breathing room (label fades in only on active). Keeps a11y labels via `aria-label`.
- Icon tap: existing `haptics.tap()` + `whileTap={{ scale: 0.9 }}`.
- Reduced motion: respect `prefers-reduced-motion` (skip layout spring, use opacity only).

**`src/components/home-compose-fab.tsx`** — reposition only.

- Move the FAB up so it no longer overlaps the new island: change `bottom: calc(env(safe-area-inset-bottom) + 72px)` → `+ 88px`. The compose stays a separate circular FAB to the right (it expands to "Walk solo / Plan a walk") — not merged into the dock, since the island works better visually with even tab spacing.

**`src/routes/__root.tsx`** — padding tweak.

- Bump bottom padding on `<main>` from `pb-[calc(7rem+…)]` to `pb-[calc(8rem+env(safe-area-inset-bottom))]` so the last card never tucks under the floating island.

## Visual spec

```text
                ┌──────────────────────────────────┐
                │  ●Home    Discover  Journal  Profile  │   ← capsule, glass, shadow
                └──────────────────────────────────┘
                          ↑ active pill slides
```

- Active pill color: `bg-forest/12` with `text-forest`; inactive icons `text-muted-foreground`.
- Spring: `{ type: "spring", stiffness: 380, damping: 32 }`.
- Pill island ignores swipes to/from edges (purely visual hover, no fullscreen bar).

## Out of scope

- No new tabs, no reorder, no removal.
- Desktop sidebar unchanged.
- No changes to header, compose actions, or routes.
