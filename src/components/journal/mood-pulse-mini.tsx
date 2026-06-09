import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { JournalStats } from "@/lib/journal-entries.functions";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

export function MoodPulseMini({ stats }: { stats: JournalStats }) {
  const reduce = useReducedMotion();
  const arc = stats.moodArc30;

  const { path, avg, delta, last } = useMemo(() => {
    if (arc.length < 2) return { path: null as string | null, avg: null as number | null, delta: 0, last: null as number | null };
    const w = 100;
    const h = 28;
    const ys = arc.map((p) => h - (Math.max(0, Math.min(10, p.score)) / 10) * h);
    const xs = arc.map((_, i) => (i / (arc.length - 1)) * w);
    const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${ys[i].toFixed(2)}`).join(" ");
    const avg = arc.reduce((s, p) => s + p.score, 0) / arc.length;
    const half = Math.floor(arc.length / 2);
    const first = arc.slice(0, half);
    const second = arc.slice(half);
    const firstAvg = first.reduce((s, p) => s + p.score, 0) / Math.max(1, first.length);
    const secondAvg = second.reduce((s, p) => s + p.score, 0) / Math.max(1, second.length);
    return { path, avg, delta: secondAvg - firstAvg, last: arc[arc.length - 1]?.score ?? null };
  }, [arc]);

  if (!path) {
    return (
      <section className="rounded-3xl border border-dashed border-border bg-card/60 p-4 text-center text-xs text-muted-foreground">
        Log a few walks with mood to see your pulse.
      </section>
    );
  }

  const trendIcon =
    delta > 0.3 ? <TrendingUp className="h-3.5 w-3.5 text-forest" /> :
    delta < -0.3 ? <TrendingDown className="h-3.5 w-3.5 text-clay" /> :
    <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  const trendLabel =
    delta > 0.3 ? `Trending up · ${delta.toFixed(1)}` :
    delta < -0.3 ? `Trending down · ${delta.toFixed(1)}` :
    "Steady";

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-baseline justify-between">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-clay/80">Mood pulse · 30d</div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {trendIcon}
          <span className="tabular-nums">{trendLabel}</span>
        </div>
      </div>
      <svg viewBox="0 0 100 28" className="mt-2 h-14 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="mood-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--clay)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--clay)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d={`${path} L100,28 L0,28 Z`}
          fill="url(#mood-fill)"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        />
        <motion.path
          d={path}
          fill="none"
          stroke="var(--clay)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </svg>
      <div className="mt-1 flex items-baseline justify-between text-[11px] text-muted-foreground">
        <span>
          Avg <span className="text-foreground tabular-nums">{avg?.toFixed(1)}</span>
        </span>
        {last != null && (
          <span>
            Latest <span className="text-foreground tabular-nums">{last.toFixed(1)}</span>
          </span>
        )}
      </div>
    </section>
  );
}
