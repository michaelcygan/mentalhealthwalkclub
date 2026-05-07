## What's broken (root causes)

**1. Motion never registers on iPhone in the preview.**
The Lovable preview renders the app inside an iframe. Geolocation in iframes requires `allow="geolocation; microphone"` on the parent `<iframe>`. We can't change Lovable's preview iframe, so on the preview URL `navigator.geolocation.watchPosition` silently fails (or its permission prompt never appears). Walk & Talk currently waits on `hasMoved` to start matching, so it never matches in the preview — the user sees an empty waiting room forever. This works fine once published on a real domain.

**2. 6 "steps" on a laptop with 0.00 mi.**
`walk.active.$id.tsx` accepts every GPS sample and accumulates distance with no minimum-delta gate (it only filters > 200 m teleports). Desktop browsers return Wi-Fi positions that drift several meters per refresh, which slowly accumulates fake meters → `meters/0.78` rounds up to 6 steps even when the device hasn't moved.

**3. Solo end-walk flow.**
- Step 0 ("How are you arriving?") shows a 4-row scrolling MoodCloud — too tall/busy for an end-of-walk screen.
- The whole flow is 4 separate screens (mood → score → reflection → ceremony) with no progress indicator, and "skip" only exists on step 0. If the user loses focus, there's no way out.
- Saving only happens on step 3's "Save to journal" — if a user closes mid-flow, the walk is left in `active` status forever (also breaks the "Walk in progress" card on home).

**4. Walk & Talk dock.**
- Hard-blocks on `hasMoved`. Combined with #1, this is the primary "didn't detect my motion" complaint.
- Mic permission isn't requested up-front; user only finds out it failed after matching.

**5. Guided walk.**
- `GuidedPlayer` autoplays audio in `useEffect` — Safari/iOS will reject this if there's been no recent user gesture between mode pick and active page mount, leaving a silent player with no visible "tap to start" affordance.
- No progress bar / time remaining / scrubbing; `duration_seconds` is fetched but unused.

---

## Plan

### A. Fix motion + step accuracy (`walk.active.$id.tsx`)
- Add an accuracy + delta gate to `watchPosition`: drop samples with `accuracy > 30 m`; only add distance when delta is **between 2 m and 200 m** (kills Wi-Fi jitter, still kills teleports).
- Compute steps from a rolling mean speed × time when GPS is reporting, not from total meters, so fake meters → fake steps is impossible.
- Add a fallback "I'm walking" manual chip in the hero (small, under the timer): if no valid GPS sample arrives within 25 s, surface it. Tapping it sets `hasMoved = true` so Walk & Talk can match in environments without geolocation (preview iframe, indoor, GPS denied). This makes the preview testable without changing real-device behavior.
- Show a tiny GPS status dot (green/amber/grey) in the hero so users can tell whether tracking is live.

### B. Walk & Talk dock (`walk-talk-dock.tsx`)
- Pre-warm mic permission on mount of the in-room phase (request `getUserMedia` early, surface a friendly inline error if denied — instead of silent failure).
- Respect the new manual-walking signal from A so matching kicks off in the preview.
- Tighten the "waiting-to-walk" card copy + add a subtle "Start anyway" link after 25 s.

### C. Solo end-walk flow (`end-walk-flow.tsx`)
- Collapse to **two screens** instead of four: (1) mood + weight + one-line reflection on a single scrollable card with a small progress bar, (2) ceremony + save.
- Always render an "End now, save what I have" button — saving works at any step (mood/score/reflection all optional).
- On unmount **without explicit save**, persist `status='completed'` with whatever fields we have so a closed tab doesn't leave an orphaned active walk. (Also fixes the "Walk in progress" stale state on Home.)
- Use a smaller MoodCloud variant (2 marquee rows instead of 4) for the end-walk so it doesn't dominate the screen.

### D. Guided player (`guided-player.tsx`)
- Replace silent autoplay with a large central play button on first mount; only start audio after the user taps it (works on iOS).
- Add a thin progress bar bound to `audioRef.current.currentTime` / `duration_seconds`, plus elapsed/remaining labels.
- Pause the generative pad / audio when the parent walk is paused (currently it keeps playing).
- When the track ends, fade to "walk continues — your guide is finished" instead of going silent.

### E. Small UI tightening across all three modes
- Unify the sticky bottom Pause/End-walk dock height to 56 px on mobile, 48 px on md+ (currently 56 everywhere — wastes vertical space on desktop).
- Move the "Quick check-in / lighter / same / heavier" pulse card from above the dock to a slide-in toast — currently it pushes the audio dock down and feels modal.
- Hero sparkline: only render once `points.current.length >= 2` (today it draws a spurious diagonal line from origin when there's only one point, visible in the user's screenshot).
- `MoodCloud` end-walk variant: 2 rows, slightly faster cycle so the "after" mood feels distinct from the "before" mood.
- Add `aria-live="polite"` to the timer so screen readers don't re-read every second; only milestones speak.

### F. Verification
- Local: open Solo walk, confirm 0 steps with no GPS movement; open the Walk tab in the preview, tap "Start anyway" after 25 s, confirm Walk & Talk progresses to "matching".
- Browser: screenshot the active walk page on the 390×726 viewport before/after to confirm the spurious sparkline line and the cleaner pulse-as-toast.
- Re-test the solo End walk → Save to journal happy path, plus the new "close tab mid-flow" path (expect the walk to land in Journal anyway).

### Out of scope
- Native iOS step counting (CoreMotion) — requires a real app shell, not a PWA.
- Real-time voice transport changes — Walk & Talk transport stays as-is; only the UX entry point changes.

### Files I'd touch
- `src/routes/walk.active.$id.tsx` — GPS gate, manual-walking chip, GPS status, sparkline guard, pulse-as-toast, sticky-dock height
- `src/components/walk-talk-dock.tsx` — mic pre-warm, "Start anyway" affordance, copy
- `src/components/end-walk-flow.tsx` — collapse to 2 screens, autosave-on-unmount, "End now" always available
- `src/components/mood-cloud.tsx` — add `compact` prop (2 rows) for end-walk
- `src/components/guided-player.tsx` — gesture-gated playback, progress bar, pause sync, end state
