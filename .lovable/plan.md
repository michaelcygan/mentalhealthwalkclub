# Multi-scene ambient banner loop (chained generation)

Stitch a 4-scene looping banner. To get genuine variety, **generate the scenes in sequence** with the video tool (one call per scene, waited on, then the next), rather than relying on the existing three clips alone. The browser still mounts only one `<video>` per banner — all dissolves are baked into a single MP4.

## Scenes to generate (4 fresh, sequential calls)

Each: 1080p, 16:9, 10s, no audio, slow ambient camera.

1. **`suburban-il-2.mp4`** — Slow forward POV down a tree-lined Illinois sidewalk in late afternoon. Long shadows, dappled light, empty street. Cicada-quiet.
2. **`rural-co-2.mp4`** — Side-tracking shot of a dirt road through golden aspens, distant Colorado foothills. One small figure walking far ahead. Gentle parallax.
3. **`nyc-2.mp4`** — Forward POV down a quiet Brooklyn brownstone block at dawn. Soft sun flare between buildings, planters, stoops. Empty sidewalk.
4. **`coastal-pnw.mp4`** — Forward POV along a misty Pacific Northwest beach path, driftwood and ferns, soft gray light. Cooler beat to balance the warm scenes.

The three originals (`suburban-il.mp4`, `rural-co.mp4`, `nyc.mp4`) stay in the repo as build inputs and may be substituted in the final concat if any new generation comes back weaker.

Generation order is **sequential** — wait for each video tool call to finish, eyeball it via `code--view` (first frame), then kick off the next. If a clip comes back wrong (camera too fast, weird artifacts, people facing camera), regenerate that one before moving on.

## Compositing pipeline (one-shot ffmpeg, runs in sandbox)

Script `scripts/build-ambient-loop.mjs`:

1. Re-encodes each chosen scene to **1280×720, ~1.2 Mbps H.264, no audio, 30 fps**.
2. Concatenates the 4 scenes in a fixed order with **0.8s dissolves** between, plus a dissolve from scene 4 back into scene 1 so the loop is seamless.
3. Outputs:
   - `public/videos/ambient/loop.mp4` (~6 MB, ~40s)
   - `public/videos/ambient/loop.webm` (VP9, ~4 MB)
   - `public/videos/ambient/loop-poster.jpg` (frame 0)
4. Idempotent — re-runs from the same source files. Not part of the build; one-time author step.

## Component changes

`src/components/ambient-video-banner.tsx`:
- Drop the per-surface `clip` selection and rotation logic. Every banner plays the same composited loop.
- `<video>` gets two `<source>` children (webm first, mp4 fallback) plus `poster={loopPoster}`.
- IntersectionObserver pause + reduced-motion poster behavior unchanged.

`src/components/hero-gradient.tsx`, `src/components/home/hero-band.tsx`, `src/components/entry-flow/entry-flow.tsx`, `src/components/entry-flow/demo-preview.tsx`: no JSX changes. The `clip` prop becomes a no-op (kept for back-compat).

## Performance budget

- Single `<video>` per banner — same CPU as today.
- ~6 MB transfer per first-time visit (was ~5 MB for one of today's three clips). Edge-cached after.
- Decoded-frame memory is identical to a single clip.
- `preload="metadata"` + IO pause keep cellular use in check.

## Out of scope

- No admin UI to swap scenes (per your note).
- No per-surface clip choice — one cohesive loop everywhere.
- No audio.

## Risks & fallbacks

- A video tool call can return an off-brief clip. Mitigation: spot-check first frame after each call and regenerate that one before concat.
- ffmpeg encode could fail in the sandbox. Mitigation: keep the existing `AmbientVideoBanner` behavior as a fallback (already works with the single clips).

## Deliverable order

1. Generate scene 1 → spot-check → scene 2 → spot-check → scene 3 → spot-check → scene 4 → spot-check.
2. Write and run `scripts/build-ambient-loop.mjs` to produce `loop.mp4`, `loop.webm`, `loop-poster.jpg`.
3. Simplify `AmbientVideoBanner` to point at the composited loop with two `<source>` children.
4. QA on home, active walk, profile, entry flow, and demo preview at 390px and desktop.
