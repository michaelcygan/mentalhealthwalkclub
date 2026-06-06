import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const LS_KEY = "mhwc.walk.coach.v1";

type Step = {
  ref: React.RefObject<HTMLElement>;
  title: string;
  body: string;
  ready: boolean;
};

export function FirstWalkCoach({ steps, enabled }: { steps: Step[]; enabled: boolean }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined" && window.localStorage.getItem(LS_KEY) === "done") {
      setStepIdx(steps.length);
    }
  }, [steps.length]);

  // auto-advance when current step's `ready` becomes true (but never go backwards)
  useEffect(() => {
    const s = steps[stepIdx];
    if (s && s.ready) {
      // small delay so user can read
      const t = setTimeout(() => setStepIdx((i) => Math.min(steps.length, i + 1)), 400);
      return () => clearTimeout(t);
    }
  }, [stepIdx, steps]);

  const current = steps[stepIdx];

  useLayoutEffect(() => {
    if (!current) return;
    const update = () => {
      const el = current.ref.current;
      if (el) setRect(el.getBoundingClientRect());
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [current, stepIdx]);

  // scroll target into view
  useEffect(() => {
    current?.ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [current]);

  if (!enabled || !mounted || !current || !rect) return null;

  function dismiss(done = true) {
    if (done && typeof window !== "undefined") {
      window.localStorage.setItem(LS_KEY, "done");
    }
    setStepIdx(steps.length);
  }

  const top = rect.bottom + 12;
  const placeAbove = top > window.innerHeight - 220;
  const cardTop = placeAbove ? rect.top - 12 : top;
  const transform = placeAbove ? "translateY(-100%)" : undefined;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/40" onClick={() => dismiss(false)}>
      {/* highlight ring */}
      <div
        className="pointer-events-none absolute rounded-2xl ring-2 ring-cream ring-offset-2 ring-offset-transparent"
        style={{
          top: rect.top - 6,
          left: rect.left - 6,
          width: rect.width + 12,
          height: rect.height + 12,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)",
        }}
      />
      {/* card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute z-10 max-w-[calc(100vw-32px)] rounded-2xl border border-border bg-card p-4 shadow-lg"
        style={{
          top: cardTop,
          left: Math.max(16, Math.min(rect.left, window.innerWidth - 320)),
          width: 300,
          transform,
        }}
      >
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Step {stepIdx + 1} of {steps.length}
        </div>
        <div className="mt-1 font-serif text-lg leading-tight">{current.title}</div>
        <p className="mt-1 text-sm text-muted-foreground">{current.body}</p>
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => dismiss(true)}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Skip tour
          </button>
          <button
            type="button"
            onClick={() => {
              if (stepIdx >= steps.length - 1) dismiss(true);
              else setStepIdx(stepIdx + 1);
            }}
            className="rounded-full bg-forest px-4 py-1.5 text-sm text-primary-foreground"
          >
            {stepIdx >= steps.length - 1 ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
