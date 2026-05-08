import { useEffect, useState } from "react";

/**
 * Returns the number of CSS pixels the on-screen keyboard is occluding at the
 * bottom of the visual viewport. Use it to lift sticky CTAs above the
 * keyboard on iOS/Android. Returns 0 when no keyboard is open or when
 * visualViewport isn't available.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const occluded = window.innerHeight - vv.height - vv.offsetTop;
      setInset(Math.max(0, Math.round(occluded)));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}
