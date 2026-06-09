import { useMemo, useState } from "react";
import { ChevronDown, Flame } from "lucide-react";
import type { JournalStats } from "@/lib/journal-entries.functions";
import { StatsPanel } from "./stats-panel";

export type Period = "week" | "month" | "all";

interface Props {
  stats: JournalStats;
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function TrackingModule({ stats }: Props) {
  const [period, setPeriod] = useState<Period>("week");
  const [open, setOpen] = useState(false);

  const showingUpDays = useMemo(() => {
    return new Set([...stats.walkDays, ...stats.entryDays]);
  }, [stats.walkDays, stats.entryDays]);

  const streak = useMemo(() => {
    let s = 0;
    const cur = new Date();
    cur.setHours(0, 0, 0, 0);
    while (showingUpDays.has(isoDay(cur))) {
      s += 1;
      cur.setDate(cur.getDate() - 1);
    }
    return s;
  }, [showingUpDays]);

  const { weekMins, weekDots, weekDaysOn } = useMemo(() => {
    const startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return isoDay(d);
    });
    const dots = days.map((iso) => showingUpDays.has(iso));
    const mins = days.reduce((s, iso) => s + (stats.minutesByDay[iso] ?? 0), 0);
    return { weekMins: mins, weekDots: dots, weekDaysOn: dots.filter(Boolean).length };
  }, [showingUpDays, stats.minutesByDay]);

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
    let days = new Set<string>();
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

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-soft md:p-5">
      {/* Top row: streak + period toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Tracking</div>
        <div className="inline-flex rounded-full border border-border bg-background p-0.5 text-xs">
          {(["week", "month", "all"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-full px-3 py-1 capitalize transition ${
                period === p ? "bg-forest text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Hero: streak + week ring */}
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-1">
            <Flame className="h-5 w-5 translate-y-0.5 text-clay" />
            <span className="font-serif text-4xl tabular-nums leading-none">{streak}</span>
            <span className="text-sm text-muted-foreground">day{streak === 1 ? "" : "s"}</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Showing-up streak · walk or write
          </div>
        </div>
        <div className="text-right">
          <div className="flex justify-end gap-1.5">
            {weekDots.map((on, i) => (
              <span
                key={i}
                className={`h-6 w-2 rounded-full ${on ? "bg-forest" : "bg-muted"}`}
                aria-label={on ? "active day" : "rest day"}
              />
            ))}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
            {weekDaysOn}/7 days · {weekMins} min this week
          </div>
        </div>
      </div>

      {/* Period stat row */}
      <div className="mt-4 grid grid-cols-4 gap-2 border-t border-border pt-4">
        <Stat value={periodStats.entries.toLocaleString()} label="entries" />
        <Stat value={periodStats.walks.toLocaleString()} label="walks" />
        <Stat value={periodStats.mins.toLocaleString()} label="minutes" />
        <Stat value={periodStats.activeDays.toLocaleString()} label="active days" />
      </div>

      {/* Expand */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-muted/60 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground hover:bg-muted"
      >
        {open ? "Hide stats" : "View more stats"}
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-4 border-t border-border pt-4">
          <StatsPanel stats={stats} />
        </div>
      )}
    </section>
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
