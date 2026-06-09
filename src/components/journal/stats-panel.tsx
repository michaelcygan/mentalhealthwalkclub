import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView, useMotionValue, animate, useReducedMotion } from "motion/react";
import type { JournalStats } from "@/lib/journal-entries.functions";
import { formatDuration } from "@/lib/format-duration";
import { BadgesCarousel } from "./badges-carousel";

interface Props {
  stats: JournalStats;
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function StatsPanel({ stats }: Props) {
  const showingUpDays = useMemo(
    () => new Set([...stats.walkDays, ...stats.entryDays]),
    [stats.walkDays, stats.entryDays],
  );

  // Year heatmap — 7 rows (Mon-Sun) × 52 weeks
  const { grid, todayKey } = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const cells: { active: boolean; mins: number; date: Date }[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 52 }, () => ({ active: false, mins: 0, date: new Date() })),
    );
    for (let col = 0; col < 52; col++) {
      const weekStart = new Date(monday); weekStart.setDate(monday.getDate() - (51 - col) * 7);
      for (let row = 0; row < 7; row++) {
        const d = new Date(weekStart); d.setDate(weekStart.getDate() + row);
        const iso = isoDay(d);
        cells[row][col] = {
          active: showingUpDays.has(iso),
          mins: stats.minutesByDay[iso] ?? 0,
          date: d,
        };
      }
    }
    return { grid: cells, todayKey: today.toDateString() };
  }, [showingUpDays, stats.minutesByDay]);

  const maxMins = Math.max(1, ...grid.flat().map((c) => c.mins));

  // Mood arc
  const arc = stats.moodArc30;
  const arcAvg = arc.length ? arc.reduce((s, p) => s + p.score, 0) / arc.length : null;
  const arcPath = useMemo(() => {
    if (arc.length < 2) return null;
    const w = 100;
    const h = 28;
    const xs = arc.map((_, i) => (i / (arc.length - 1)) * w);
    const ys = arc.map((p) => h - (Math.max(0, Math.min(10, p.score)) / 10) * h);
    return xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${ys[i].toFixed(2)}`).join(" ");
  }, [arc]);

  const minsFmt = formatDuration(stats.lifetime.minutes);

  return (
    <div className="space-y-5">
      {/* Lifetime numbers */}
      <div className="grid grid-cols-4 gap-3 text-center">
        <CountStat to={stats.lifetime.entries} label="entries" />
        <CountStat to={stats.lifetime.walks} label="walks" />
        <StaticStat value={minsFmt.value} label={minsFmt.unit} />
        <CountStat to={stats.lifetime.stepsLogged} label="steps logged" />
      </div>

      {/* Year heatmap */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">A year of showing up</div>
          <div className="text-[11px] text-muted-foreground tabular-nums">
            {showingUpDays.size} day{showingUpDays.size === 1 ? "" : "s"}
          </div>
        </div>
        <div
          className="grid gap-[2px]"
          style={{ gridTemplateColumns: "repeat(52, minmax(0, 1fr))" }}
          role="img"
          aria-label="Showing-up heatmap, last 52 weeks"
        >
          {Array.from({ length: 52 }).map((_, col) => (
            <motion.div
              key={col}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: col * 0.008, duration: 0.2 }}
              className="grid grid-rows-7 gap-[2px]"
            >
              {grid.map((row, r) => {
                const c = row[col];
                const isToday = c.date.toDateString() === todayKey;
                const intensity = c.mins / maxMins;
                const bg = !c.active
                  ? "color-mix(in oklab, var(--forest) 7%, transparent)"
                  : c.mins === 0
                  ? "color-mix(in oklab, var(--forest) 30%, transparent)"
                  : `color-mix(in oklab, var(--forest) ${Math.round(35 + intensity * 60)}%, transparent)`;
                return (
                  <div
                    key={r}
                    title={`${c.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}${
                      c.active ? ` · ${c.mins} min` : ""
                    }`}
                    className={`aspect-square rounded-[2px] ${isToday ? "ring-1 ring-forest animate-pulse" : ""}`}
                    style={{ background: bg }}
                  />
                );
              })}
            </motion.div>
          ))}
        </div>
        <p className="mt-2 font-serif text-sm italic text-muted-foreground">
          {showingUpDays.size === 0
            ? "A blank field — the next square is up to you."
            : `Walking days fill in over time. A reflection counts too.`}
        </p>
      </div>

      {/* Mood arc */}
      {arcPath && arcAvg !== null && (
        <div className="border-t border-border pt-4">
          <div className="flex items-baseline justify-between">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-clay/80">Mood after · 30 days</div>
            <div className="font-serif text-sm text-muted-foreground">
              <span className="text-foreground tabular-nums">{arcAvg.toFixed(1)}</span> avg
            </div>
          </div>
          <svg viewBox="0 0 100 28" className="mt-2 h-16 w-full" preserveAspectRatio="none">
            <motion.path
              d={arcPath}
              fill="none"
              stroke="var(--clay)"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          </svg>
        </div>
      )}

      {/* Badges */}
      <BadgesCarousel badges={stats.badges} count={stats.badgesCount} />
    </div>
  );
}

function StaticStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-serif text-2xl tabular-nums leading-none">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

export function CountStat({ to, label }: { to: number; label: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState("0");
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setDisplay(to.toLocaleString());
      return;
    }
    const controls = animate(mv, to, {
      duration: Math.min(1.2, 0.4 + Math.log10(Math.max(1, to)) * 0.25),
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v).toLocaleString()),
    });
    return () => controls.stop();
  }, [inView, to, mv, reduce]);

  return (
    <div ref={ref}>
      <div className="font-serif text-2xl tabular-nums leading-none">{display}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
