import { useEffect, useState } from "react";

/**
 * Tracks vertical scroll direction. Returns "up" while at the top so chrome
 * stays visible; switches to "down" only after a small threshold to avoid
 * jitter. Mobile-only callers can gate on viewport.
 */
export function useScrollDirection(threshold = 8) {
  const [dir, setDir] = useState<"up" | "down">("up");

  useEffect(() => {
    let lastY = typeof window === "undefined" ? 0 : window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < 24) {
          setDir("up");
        } else if (Math.abs(y - lastY) > threshold) {
          setDir(y > lastY ? "down" : "up");
        }
        lastY = y;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return dir;
}
