import { useEffect, useState } from "react";

interface Props {
  minutes: number;
  goal?: number;
  /** id of the element that, when scrolled out of view, reveals this bar */
  watchId: string;
}

/**
 * Tiny progress bar that appears once the full "This week" card has scrolled
 * off-screen. Disappears when the card returns into view.
 */
export function StickyWeekBar({ minutes, goal = 90, watchId }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = document.getElementById(watchId);
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([entry]) => {
      // Show when watched element has scrolled past the top
      const r = entry.boundingClientRect;
      setVisible(!entry.isIntersecting && r.top < 0);
    }, { threshold: 0, rootMargin: "-1px 0px 0px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [watchId]);

  const pct = Math.min(100, Math.round((minutes / goal) * 100));
  const met = minutes >= goal;

  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none fixed inset-x-0 top-[52px] z-20 px-4 transition-all duration-300 md:hidden ${visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`}
    >
      <div className="mx-auto flex max-w-md items-center gap-2 rounded-full border border-border/60 bg-background/85 px-3 py-1.5 shadow-soft backdrop-blur">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ${met ? "bg-clay" : "bg-forest"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
          {minutes}<span className="text-muted-foreground/60">/{goal}</span>
        </span>
      </div>
    </div>
  );
}
