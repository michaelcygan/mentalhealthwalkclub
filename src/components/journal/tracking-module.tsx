import { useMemo, useState } from "react";
import { motion } from "motion/react";
import type { JournalStats } from "@/lib/journal-entries.functions";
import { CountStat } from "./stats-panel";
import { formatDuration } from "@/lib/format-duration";

export type Period = "week" | "month" | "all";

interface Props {
  stats: JournalStats;
}

export function TrackingModule({ stats }: Props) {
  const [period, setPeriod] = useState<Period>("week");

  const periodStats = useMemo(() => {
    const now = new Date();
    let start: Date;
    if (period === "week") {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    } else if (period === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      start = new Date(0);
    }
    let mins = 0;
    let entries = 0;
    let walks = 0;
    const days = new Set<string>();
    for (const [iso, m] of Object.entries(stats.minutesByDay)) {
      if (new Date(iso) < start) continue;
      mins += m;
    }
    for (const iso of stats.walkDays) {
      if (new Date(iso) < start) continue;
      walks += 1;
      days.add(iso);
    }
    for (const iso of stats.entryDays) {
      if (new Date(iso) < start) continue;
      entries += 1;
      days.add(iso);
    }
    return { mins, entries, walks, activeDays: days.size };
  }, [period, stats]);

  const periodMins = formatDuration(periodStats.mins);

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Tracking
        </div>
        <div className="relative inline-flex rounded-full border border-border bg-background p-0.5 text-xs">
          {(["week", "month", "all"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`relative z-10 rounded-full px-3 py-1 capitalize transition ${
                period === p ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {period === p && (
                <motion.span
                  layoutId="journal-period-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-forest"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        <CountStat key={`e-${period}`} to={periodStats.entries} label="entries" />
        <CountStat key={`w-${period}`} to={periodStats.walks} label="walks" />
        <div>
          <div className="font-serif text-2xl tabular-nums leading-none">{periodMins.value}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            {periodMins.unit}
          </div>
        </div>
        <CountStat key={`d-${period}`} to={periodStats.activeDays} label="active days" />
      </div>
    </section>
  );
}
