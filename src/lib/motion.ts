// Unified motion grammar for the whole app.
// One easing curve, three durations, two springs — so every screen breathes the same.

import type { Transition } from "motion/react";

/** Eased cubic-bezier matching the CSS .calm-transition utility (0.22, 1, 0.36, 1). */
export const easeOut = [0.22, 1, 0.36, 1] as const;

/** Common durations in seconds. */
export const dur = {
  fast: 0.18,
  base: 0.28,
  slow: 0.46,
} as const;

/** Soft, settled spring — sheets, panels, dock entrance. */
export const springSoft: Transition = {
  type: "spring",
  stiffness: 280,
  damping: 30,
  mass: 0.9,
};

/** Snappier spring — tab pills, chips, +/x toggle rotations. */
export const springSnap: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 32,
};

/** Default "fade + tiny lift" enter, honoring reduced-motion when the caller flips `reduce`. */
export function fadeLift(reduce = false) {
  return {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 6 },
    animate: reduce ? { opacity: 1 } : { opacity: 1, y: 0 },
    exit:    reduce ? { opacity: 0 } : { opacity: 0, y: 6 },
    transition: { duration: dur.base, ease: easeOut },
  } as const;
}
