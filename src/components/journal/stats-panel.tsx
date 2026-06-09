import { useMemo } from "react";
import { Award, Link as LinkIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { JournalStats } from "@/lib/journal-entries.functions";

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

  // Mood arc — last 30 days, normalize 0..10
  const arc = stats.moodArc30;
  const arcAvg = arc.length ? arc.reduce((s, p) => s + p.score, 0) / arc.length : null;
  const arcPath = useMemo(() => {
    if (arc.length < 2) return null;
    const w = 100;
    const h = 28;
    const xs = arc.map((_, i) => (i / (arc.length - 1)) * w);
    const ys = arc.map((p) => h - (Math.max(0, Math.min(10, p.score)) / 10) * h);
    const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${ys[i].toFixed(2)}`).join(" ");
    return d;
  }, [arc]);

  return (
    <div className="space-y-5">
      {/* Lifetime numbers */}
      <div className="grid grid-cols-4 gap-3 text-center">
        <Stat value={stats.lifetime.entries.toLocaleString()} label="entries" />
        <Stat value={stats.lifetime.walks.toLocaleString()} label="walks" />
        <Stat value={stats.lifetime.minutes.toLocaleString()} label="minutes" />
        <Stat value={stats.lifetime.stepsLogged.toLocaleString()} label="steps logged" />
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
            <div key={col} className="grid grid-rows-7 gap-[2px]">
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
                    className={`aspect-square rounded-[2px] ${isToday ? "ring-1 ring-forest" : ""}`}
                    style={{ background: bg }}
                  />
                );
              })}
            </div>
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
            <path
              d={arcPath}
              fill="none"
              stroke="var(--clay)"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      )}

      {/* Latest badge */}
      {stats.latestBadge && (
        <Link
          to="/profile"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3 transition hover:border-forest/30"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
            <Award className="h-4 w-4 text-forest" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Latest badge
            </span>
            <span className="block truncate font-serif text-sm text-foreground">{stats.latestBadge.name}</span>
          </span>
          <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
        </Link>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-serif text-2xl tabular-nums leading-none">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
