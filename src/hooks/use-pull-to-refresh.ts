import { useEffect, useRef, useState } from "react";

interface Options {
  onRefresh: () => Promise<unknown> | void;
  threshold?: number; // px the user must drag past the trigger
  enabled?: boolean;
}

/**
 * Lightweight, library-free pull-to-refresh for mobile pages. Attach `bind`
 * to the scrollable container (usually the page wrapper). Reports `pull`
 * (0..1+) so the caller can render a soft indicator.
 */
export function usePullToRefresh({ onRefresh, threshold = 64, enabled = true }: Options) {
  const startY = useRef<number | null>(null);
  const armed = useRef(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0) { startY.current = null; armed.current = false; return; }
      startY.current = e.touches[0].clientY;
      armed.current = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!armed.current || startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) { setPull(0); return; }
      // resistance curve
      setPull(Math.min(1.4, dy / threshold));
    };
    const onEnd = async () => {
      if (!armed.current) return;
      armed.current = false;
      const triggered = pull >= 1;
      setPull(0);
      if (triggered && !refreshing) {
        setRefreshing(true);
        try { await onRefresh(); } finally { setRefreshing(false); }
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [enabled, onRefresh, pull, refreshing, threshold]);

  return { pull, refreshing };
}
