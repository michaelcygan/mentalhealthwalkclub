import { useEffect, useRef, useState } from "react";

function useCountUp(target: number, durationMs = 900) {
  const [v, setV] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const run = () => {
      if (started.current) return;
      started.current = true;
      if (reduce) { setV(target); return; }
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / durationMs);
        const eased = 1 - Math.pow(1 - p, 3);
        setV(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) run(); });
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [target, durationMs]);
  return { ref, value: v };
}

function Stat({ value, label }: { value: number; label: string }) {
  const { ref, value: v } = useCountUp(value);
  return (
    <div className="flex flex-col items-start">
      <span ref={ref} className="font-serif text-2xl tabular-nums leading-none text-foreground">{v}</span>
      <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
    </div>
  );
}

export function GroupPulse({ walks, minutes, newMembers }: { walks: number; minutes: number; newMembers: number }) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return (
    <section className="rounded-3xl border border-border bg-card/70 p-5 shadow-soft">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">This week, together</div>
      <div className="mt-3 grid grid-cols-3 gap-4">
        <Stat value={walks} label="Walks" />
        <div className="flex flex-col items-start">
          <span className="font-serif text-2xl tabular-nums leading-none">
            {hours}<span className="text-base text-muted-foreground">h</span> {mins}<span className="text-base text-muted-foreground">m</span>
          </span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Time outside</span>
        </div>
        <Stat value={newMembers} label="New walkers" />
      </div>
    </section>
  );
}
