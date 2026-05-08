import { useEffect, useRef } from "react";

/**
 * setInterval as a hook. Pauses automatically when the document is hidden
 * (saves battery on mobile). Pass `null` to pause manually.
 */
export function useInterval(callback: () => void, delay: number | null) {
  const saved = useRef(callback);
  useEffect(() => { saved.current = callback; }, [callback]);

  useEffect(() => {
    if (delay === null) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (id === null) id = setInterval(() => saved.current(), delay); };
    const stop = () => { if (id !== null) { clearInterval(id); id = null; } };
    const onVis = () => (document.visibilityState === "visible" ? start() : stop());
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, [delay]);
}
