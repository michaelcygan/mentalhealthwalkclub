All implementation waves of the Solo Walk V1 plan are in place. The only remaining work is Wave 9 — a focused QA and verification pass before calling the plan complete.

## What is already done
- Waves 1–2: server-authoritative end flow, 4-hour hard cap on client and server, `timed_out` state.
- Waves 3–5: single-page Ready → Active → Timed out → Finish state machine, mobile-first cream/forest UI, sticky bottom actions, compact Radio module + active strip, collapsible in-walk journal with localStorage draft.
- Waves 6–8: finish screen with optional mood/reflection save, loading/error recovery, accessibility attributes, reduced-motion support, 44px tap targets.

## Remaining: Wave 9 — QA pass
Run the following checks and fix any regressions found.

1. **Build & typecheck**
   - `bun run lint` (or `npm run lint`)
   - `bun run build` / `bun run build:dev`
   - Fix any errors before moving on.

2. **Timer lifecycle matrix**
   - Start a walk → timer increments.
   - Background the tab for 30–60s → return to foreground; timer jumps to correct elapsed time.
   - End walk → server-computed duration used, finish screen shows correct minutes.
   - Start, wait a few seconds, kill and reopen app → resumes active session.

3. **4-hour timeout**
   - Simulate a session `started_at` > 4 hours ago (local dev tweak or DB update) → loads in `timed_out` state.
   - Timer frozen at `4:00:00`.
   - Finish walk completes with capped duration.
   - Discard abandons the timed-out session.

4. **Radio integration**
   - Free user hits monthly cap → paywall sheet appears.
   - Plus user taps station → plays; active strip shows title/subtitle.
   - Play/Pause toggles.
   - Ending or discarding the walk does not stop Radio.
   - No audio button stops current audio.

5. **Journal privacy**
   - Draft persists across reloads while active.
   - Draft is cleared after successful end + save, or after discard.
   - Reflection saved on end appears in private journal.
   - Finish-screen save updates mood/reflection independently.

6. **Error & edge cases**
   - Block network on initial load → error UI with Try again / Return home.
   - Try again reloads active session.
   - Start while already active → resumes existing session.
   - Complete an already-completed session → idempotent, enters finish.

7. **Accessibility & mobile**
   - Screen reader announces "Walk started", "Walk ended", "Timer stopped" via the polite live region.
   - All buttons reachable with keyboard; focus rings visible.
   - Verified at 390px width; sticky End clears tab bar + Now Playing dock.
   - Reduced motion disables entrance animation.

## Expected outcome
No console/runtime errors, clean build, and all matrix cases pass. Once Wave 9 passes, the Solo Walk V1 plan is complete.