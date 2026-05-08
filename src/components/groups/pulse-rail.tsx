import { useEffect, useMemo, useRef, useState } from "react";
import { Radio } from "lucide-react";
import { GroupCard } from "@/components/group-card";
import type { Group, GroupPulse } from "@/hooks/use-groups-feed";

interface Props {
  groups: Group[];
  pulse: Map<string, GroupPulse>;
  mine: Set<string>;
  onToggle: (g: Group) => void;
}

const SPEED_PX_PER_SEC = 22;
const INTERACTION_PAUSE_MS = 1500;
const MAX_ITEMS = 12;

interface Item { g: Group; p: GroupPulse }

export function PulseRail({ groups, pulse, mine, onToggle }: Props) {
  const items = useMemo<Item[]>(() => {
    const live: Item[] = [];
    const needs: Item[] = [];
    const trending: Item[] = [];
    const now = Date.now();
    for (const g of groups) {
      const p = pulse.get(g.id);
      if (!p) continue;
      if (p.live > 0) {
        live.push({ g, p });
        continue;
      }
      if (p.nextStart) {
        const ms = new Date(p.nextStart).getTime() - now;
        const soon = ms > -5 * 60_000 && ms < 90 * 60_000;
        if (soon && p.walkersWeek < 3) {
          needs.push({ g, p: { ...p, needsCompany: true } });
          continue;
        }
        // upcoming but not "needs" — let it land in trending bucket below
      }
      if (p.walkersWeek > 0) trending.push({ g, p });
    }
    live.sort((a, b) => b.p.live - a.p.live);
    needs.sort((a, b) => (a.p.nextStart ?? "z").localeCompare(b.p.nextStart ?? "z"));
    trending.sort((a, b) => b.p.walkersWeek - a.p.walkersWeek);

    // Interleave live, needs, trending
    const out: Item[] = [];
    const queues = [live, needs, trending];
    while (out.length < MAX_ITEMS && queues.some((q) => q.length)) {
      for (const q of queues) {
        if (q.length && out.length < MAX_ITEMS) out.push(q.shift()!);
      }
    }
    return out;
  }, [groups, pulse]);

  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const lastInteractRef = useRef(0);

  // Auto-drift via rAF; seamless wrap because items are duplicated.
  useEffect(() => {
    const el = ref.current;
    if (!el || items.length === 0) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let raf = 0;
    let last = performance.now();
    let hidden = document.hidden;
    const onVis = () => { hidden = document.hidden; last = performance.now(); };
    document.addEventListener("visibilitychange", onVis);

    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      const interact = t - lastInteractRef.current < INTERACTION_PAUSE_MS;
      if (!paused && !hidden && !interact) {
        const half = el.scrollWidth / 2;
        if (half > 0) {
          let next = el.scrollLeft + SPEED_PX_PER_SEC * dt;
          if (next >= half) next -= half;
          el.scrollLeft = next;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", onVis); };
  }, [items, paused]);

  if (items.length === 0) return null;

  const onInteract = () => { lastInteractRef.current = performance.now(); };
  const doubled = [...items, ...items];

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Radio className="h-3.5 w-3.5 text-forest live-pulse" />
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">Pulse · happening now</span>
      </div>
      <div
        ref={ref}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={onInteract}
        onPointerMove={onInteract}
        onWheel={onInteract}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 fade-edge-x no-scrollbar md:mx-0 md:px-0"
        style={{ scrollBehavior: "auto" }}
      >
        {doubled.map(({ g, p }, i) => (
          <div key={`${g.id}-${i}`} className="card-in" style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}>
            <GroupCard group={g} pulse={p} joined={mine.has(g.id)} onToggle={() => onToggle(g)} variant="pulse" />
          </div>
        ))}
      </div>
    </section>
  );
}
