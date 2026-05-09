/** Tiny mobile-native helpers. All no-ops on unsupported platforms. */

export const haptic = (ms: number | number[] = 8): void => {
  try { navigator.vibrate?.(ms); } catch { /* no-op */ }
};

export const share = async (data: ShareData): Promise<boolean> => {
  try {
    if (navigator.share) { await navigator.share(data); return true; }
  } catch { /* user cancel or no support */ }
  try {
    if (data.url && navigator.clipboard) {
      await navigator.clipboard.writeText(data.url);
      return true;
    }
  } catch { /* clipboard blocked */ }
  return false;
};

/** Wraps a state update in document.startViewTransition where supported. */
export const viewTransition = (fn: () => void): void => {
  const d = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (typeof d.startViewTransition === "function") d.startViewTransition(fn);
  else fn();
};

import { useEffect, useRef, useState } from "react";

/**
 * Slowly rotates an active index 0..count-1 with jittered cadence.
 * Pauses when target ref is off-screen, when tab hidden, and when prefers-reduced-motion.
 * Returns [activeIndex, refToObserve, ready].
 *  - `ready` flips true once `enabled` (e.g. base image loaded) so callers can mount alternates lazily.
 */
export function useSlowRotate<T extends Element>(
  count: number,
  opts: { minMs?: number; maxMs?: number; startJitterMs?: number; enabled?: boolean } = {},
): [number, React.RefObject<T | null>, boolean] {
  const { minMs = 7000, maxMs = 11000, startJitterMs = 4000, enabled = true } = opts;
  const ref = useRef<T>(null);
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const inViewRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => { if (enabled) setReady(true); }, [enabled]);

  useEffect(() => {
    if (!enabled || count <= 1) return;
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const schedule = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      const ms = minMs + Math.random() * (maxMs - minMs);
      timerRef.current = window.setTimeout(() => {
        if (inViewRef.current && document.visibilityState === "visible") {
          setActive((i) => (i + 1) % count);
        }
        schedule();
      }, ms);
    };

    const io = new IntersectionObserver(([e]) => { inViewRef.current = e.isIntersecting; }, { threshold: 0.1 });
    io.observe(el);
    const startId = window.setTimeout(schedule, Math.random() * startJitterMs);
    return () => {
      io.disconnect();
      window.clearTimeout(startId);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [count, enabled, minMs, maxMs, startJitterMs]);

  return [active, ref, ready];
}
