# Ambient video banners

Replace the app's hero/banner surfaces that currently use a static gradient or single photo with a quiet, looping ambient walking video. Forward-motion POV / side-tracking shots, mixed environments (suburban Illinois, rural Colorado, NYC), Fincher-style observational stillness — calm, not flashy. Text and overlays are re-tuned for legibility on moving footage.

## Where this applies (audited)

In scope — single banner surfaces:
1. **Home hero** (`src/components/home/hero-band.tsx` via `HeroGradient`) — "Good evening, Mike." Currently a time-of-day gradient with black serif text.
2. **Active walk hero** (`src/components/active-walk/active-walk-shell.tsx` via `HeroGradient`) — same gradient surface around the timer.
3. **Profile header** (`src/routes/profile.tsx` via `HeroGradient`) — same shell.
4. **Entry-flow welcome slide** (`src/components/entry-flow/entry-flow.tsx`) — currently `walk-hero.jpg`, "Take the walk. Let it count."
5. **Demo preview hero** (`src/components/entry-flow/demo-preview.tsx`) — same `walk-hero.jpg` banner.

Out of scope (intentional — would hurt perf or feel wrong):
- City / niche / mood / group cover tiles (dozens per screen, photos are part of their identity).
- Group detail covers, event covers, journal entry cards (per-item imagery, not a single hero).
- Auth page small logo card, welcome dialog (modal, not a banner).

## Asset plan

Generate **3 short ambient clips** (10s, 1080p, no audio) via the video tool, then compress to web-friendly MP4 + WebM:

- `suburban-il.mp4` — tree-lined sidewalk at golden hour, slow forward dolly POV, cicadas-implied stillness.
- `rural-co.mp4` — dirt road through aspens / open foothills, slow side-track of two distant walkers.
- `nyc.mp4` — early morning Brooklyn brownstone block, forward POV, soft sun flare.

Each clip:
- 1920×1080, h.264 + vp9, ~2 Mbps, **muted, loop, playsInline, autoplay**.
- A matching JPG poster at the same first-frame for instant paint and `prefers-reduced-motion`.
- Total budget ~5–7 MB for all three combined after compression.

Stored under `public/videos/ambient/` so they can be `staticFile`-style referenced and cached by the edge.

## New component

`src/components/ambient-video-banner.tsx` — drop-in replacement for the gradient surface:

- Picks a clip per session (stable per-mount; rotates across visits) or per surface (home = suburban, active walk = rural, entry = NYC, etc. — final mapping TBD in implementation).
- Renders: `<video>` (object-cover, absolute inset-0) → dark-to-transparent **bottom scrim** (`from-black/60 via-black/25 to-transparent`) → top vignette (`from-black/30`) → children slot.
- Honors `prefers-reduced-motion`: shows poster JPG only, no `<video>`.
- Pauses via `IntersectionObserver` when offscreen and on `document.visibilitychange` to save battery.
- Lazy-mounts `<video>` after first paint (poster shows immediately).
- Accepts `className`, `children`, optional `clip` override, optional `tone="light" | "dark"` to flip text color.

## Surface-by-surface changes

**HeroGradient** (`src/components/hero-gradient.tsx`): refactored to compose `AmbientVideoBanner` underneath, keeping its existing API so `HeroBand`, `ActiveWalkShell`, and `ProfileHeader` get the new look for free. Time-of-day gradient becomes a fallback color/scrim.

**HeroBand** (`src/components/home/hero-band.tsx`):
- Switch greeting + microcopy from black serif to **white serif** with subtle text-shadow (`drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]`).
- Italic eyebrow line opacity bumped to `text-white/85`.
- LevelRing: outer ring stroke becomes `white/70`, inner avatar stays forest. Ring contrast verified against all three clips.
- Padding unchanged so layout doesn't shift.

**ActiveWalkShell** hero region: same white-on-video treatment for the timer and meta row; numerals already large enough — only color tokens change.

**ProfileHeader**: same — name/handle to white, secondary chips get a `bg-black/25 backdrop-blur-sm` pill so they read on any clip.

**Entry-flow Welcome slide**: drop `<img src={heroImg}>`, mount `AmbientVideoBanner` at `h-40 md:h-56`. Existing forest scrim is replaced with the component's built-in scrim. Headline already white — no copy changes.

**DemoPreview hero**: same swap at `h-56 md:h-72`. Buttons keep current styling (cream + outline) which already works on dark scrim.

## Performance & a11y

- Video tags: `muted autoplay loop playsInline preload="metadata"` plus `poster={posterJpg}`.
- `aria-hidden="true"` on the `<video>`; no captions needed (silent ambience).
- Reduced-motion users see the poster only — no autoplay surprise.
- Mobile data: clips are short and looped; no progressive download beyond first segment.
- iOS Safari quirks handled (`playsInline`, muted-before-play, user-gesture not required since muted).

## Out of scope / not changing

- No new business logic, hooks, or routes.
- City/niche/mood photo grids stay as-is.
- No audio — ever — on these banners.
- `walk-hero.jpg` stays in repo as the entry-flow poster fallback.

## Risks

- Autoplay blocked on some battery-saver setups → poster shows; acceptable.
- Bandwidth on first load of unauthenticated landing → mitigated by short clip + WebM + `preload="metadata"` and the fact only one clip mounts per surface.
- Color contrast across three different clips → built-in scrim is tuned to WCAG AA for white serif at the sizes used; verified against poster stills before shipping.

## Deliverable order

1. Generate 3 ambient clips, compress, drop into `public/videos/ambient/` with posters.
2. Build `AmbientVideoBanner` + reduced-motion + IO pause.
3. Refactor `HeroGradient` to use it; flip `HeroBand` text to white-on-video.
4. Swap entry-flow + demo-preview banners.
5. QA on the three real surfaces at 390px and desktop.
