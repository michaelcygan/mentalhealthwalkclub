# Solo walk flow optimization

## Goal
Turn the solo walk into a calm, polished, movement-friendly experience: uplifting at check-in, useful during the walk without demanding attention, and consistent with the rest of the app.

## Plan

1. **Reframe the mood check-in positively**
   - Reorder mood tags so neutral and positive choices appear first, followed by lower-energy and difficult emotions.
   - Preserve every existing mood option and its saved value; only presentation order changes.
   - Refine the supporting copy so it feels invitational rather than diagnostic.

2. **Redesign the active-walk header**
   - Replace the basic timer/text treatment with a compact, polished session header.
   - Make elapsed time the primary glanceable element, with walk state and supporting metrics clearly secondary.
   - Improve spacing, hierarchy, progress feedback, and pause/resume/end affordances for one-handed outdoor use.
   - Keep the timer and session state persistent across navigation or temporary interruptions so reopening the walk does not incorrectly restart it.

3. **Use the empty space for gentle reflection**
   - Add a calm prompt carousel that fades between short reflection prompts at a restrained interval rather than constantly moving.
   - Let users manually advance, dismiss, or tap a prompt to begin writing.
   - Add a shallow, always-visible journal strip beneath it; tapping expands it into a comfortable writing area.
   - Auto-save draft text locally during the walk and save it with the walk reflection so accidental navigation does not lose writing.
   - Reduce motion when the device’s reduced-motion setting is enabled.

4. **Clarify photo and writing actions**
   - Replace unclear/ineffective compose and photo controls with explicit, accessible actions such as “Reflect” and “Add photo.”
   - Make photo capture visibly acknowledge success and show the attached photo state.
   - Ensure the global footer has a compose action while preventing it from competing with the in-walk reflection control.

5. **Unify all audio into one player**
   - Make the existing player the single source of truth for podcasts, guided audio, music, and solo-walk ambient mixes.
   - Starting an ambient mix will stop or replace the prior spoken-audio item instead of allowing two sources to overlap.
   - During a walk, the dock and expanded player will show the active ambient mix with the same play/pause, volume, progress/state, and dismissal behavior used elsewhere.
   - Preserve playback appropriately when navigating between walk and non-walk screens, while keeping an intentional stop/end behavior when the walk finishes.

6. **Improve the walk footer and navigation behavior**
   - Add the missing compose entry to the global footer using the established navigation style.
   - During an active walk, prioritize the essential walk actions and avoid duplicate controls between the page, audio dock, and footer.
   - Respect safe areas and thumb reach on mobile.

7. **Polish the full journey**
   - Refine transitions between check-in, active walk, pause/resume, reflection expansion, and completion.
   - Keep motion subtle, purposeful, and battery-conscious—soft fades and state transitions rather than decorative animation.
   - Improve touch targets, contrast, loading/empty states, and screen-reader labels.
   - Preserve the existing visual identity rather than introducing a disconnected redesign.

8. **Validate end to end**
   - Test starting, pausing, resuming, navigating away, and completing a walk.
   - Verify timer/session continuity and that a new session begins with clean walk metrics.
   - Verify prompt fading, journal expansion, draft preservation, reflection saving, and photo attachment.
   - Verify podcast-to-ambient and ambient-to-podcast handoff, persistent player controls, and no overlapping playback.
   - Check the flow at the current mobile viewport and a larger mobile/tablet size, including reduced-motion behavior.

## Technical approach
- Consolidate walk audio through the current shared player context instead of creating a second audio system.
- Keep reflection and walk state in the existing walk session model where supported; avoid new backend structure unless the current fields cannot safely represent the final behavior.
- Use the existing design tokens and shared button/navigation components.
- Treat the active walk as the focused mode, while the universal audio dock remains available throughout the wider app.