import { useMemo } from "react";
import type { FeedEntry, JournalStats } from "@/lib/journal-entries.functions";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  stats: JournalStats;
  entries: FeedEntry[];
}

export function InsightsStrip({ stats, entries }: Props) {
  const bestDay = useMemo(() => {
    const counts = new Array(7).fill(0) as number[];
    const all = new Set([...stats.walkDays, ...stats.entryDays]);
    for (const iso of all) {
      const d = new Date(iso + "T00:00:00");
      counts[d.getDay()] += 1;
    }
    const max = Math.max(...counts);
    if (max === 0) return null;
    return { day: DAY_NAMES[counts.indexOf(max)], count: max };
  }, [stats.walkDays, stats.entryDays]);

  const walkVsNoWalk = useMemo(() => {
    const walkScores: number[] = [];
    const otherScores: number[] = [];
    for (const e of entries) {
      if (e.kind === "walk" && e.mood_after_score != null) walkScores.push(e.mood_after_score);
    }
    // No reflection mood scores, so compare walk-day mood-after vs overall avg as proxy
    if (walkScores.length === 0) return null;
    const walkAvg = walkScores.reduce((s, n) => s + n, 0) / walkScores.length;
    // Pre-walk mood as the "before" baseline
    for (const e of entries) {
      if (e.kind === "walk" && e.mood_before_score != null) otherScores.push(e.mood_before_score);
    }
    const baselineAvg =
      otherScores.length > 0 ? otherScores.reduce((s, n) => s + n, 0) / otherScores.length : null;
    return { walkAvg, baselineAvg };
  }, [entries]);

  const consistency = useMemo(() => {
    const days30 = new Set<string>();
    for (const iso of [...stats.walkDays, ...stats.entryDays]) {
      const d = new Date(iso + "T00:00:00");
      const diff = Math.round((Date.now() - d.getTime()) / 86400000);
      if (diff >= 0 && diff < 30) days30.add(iso);
    }
    return Math.round((days30.size / 30) * 100);
  }, [stats.walkDays, stats.entryDays]);

  const cards: { eyebrow: string; value: React.ReactNode; sub: string }[] = [];

  if (bestDay) {
    cards.push({
      eyebrow: "Best day",
      value: <span className="font-serif text-2xl">{bestDay.day}</span>,
      sub: `${bestDay.count} time${bestDay.count === 1 ? "" : "s"} this year`,
    });
  }
  if (walkVsNoWalk) {
    const after = walkVsNoWalk.walkAvg.toFixed(1);
    const before = walkVsNoWalk.baselineAvg?.toFixed(1);
    cards.push({
      eyebrow: "Walks lift mood",
      value: (
        <span className="font-serif text-2xl tabular-nums">
          {before ? `${before} → ${after}` : after}
        </span>
      ),
      sub: before ? "before → after average" : "average mood after a walk",
    });
  }
  cards.push({
    eyebrow: "30-day consistency",
    value: <span className="font-serif text-2xl tabular-nums">{consistency}%</span>,
    sub: "days you showed up",
  });

  if (cards.length === 0) return null;

  return (
    <section>
      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Patterns
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cards.map((c, i) => (
          <div
            key={i}
            className="w-[58%] shrink-0 snap-start rounded-2xl border border-border bg-card p-3 shadow-soft"
          >
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {c.eyebrow}
            </div>
            <div className="mt-1.5">{c.value}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{c.sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
