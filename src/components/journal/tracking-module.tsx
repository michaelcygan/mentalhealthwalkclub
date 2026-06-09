import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Sprout } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { JournalStats } from "@/lib/journal-entries.functions";
import { StatsPanel, CountStat } from "./stats-panel";
import { formatDuration } from "@/lib/format-duration";

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
  const weekMinsFmt = formatDuration(weekMins);

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-soft md:p-5">
      {/* Top row: tracking label + period toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Tracking</div>
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
                  layoutId="period-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-forest"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Hero: streak + week ring */}
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-1.5">
            <motion.span
              initial={{ rotate: -10, scale: 0.8, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
              className="translate-y-1"
            >
              <Sprout className="h-5 w-5 text-forest" />
            </motion.span>
            <StreakNumber value={streak} />
            <span className="text-sm text-muted-foreground">day{streak === 1 ? "" : "s"}</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Showing-up streak · walk or write
          </div>
        </div>
        <div className="text-right">
          <div className="flex justify-end gap-1.5">
            {weekDots.map((on, i) => (
              <motion.span
                key={i}
                initial={{ scaleY: 0.4, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ delay: 0.15 + i * 0.04, type: "spring", stiffness: 300, damping: 20 }}
                className={`h-6 w-2 origin-bottom rounded-full ${on ? "bg-forest" : "bg-muted"}`}
                aria-label={on ? "active day" : "rest day"}
              />
            ))}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
            {weekDaysOn}/7 days · {weekMinsFmt.value} {weekMinsFmt.unit} this week
          </div>
        </div>
      </div>

      {/* Period stat row */}
      <div className="mt-4 grid grid-cols-4 gap-2 border-t border-border pt-4">
        <CountStat key={`e-${period}`} to={periodStats.entries} label="entries" />
        <CountStat key={`w-${period}`} to={periodStats.walks} label="walks" />
        <div>
          <div className="font-serif text-2xl tabular-nums leading-none">{periodMins.value}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{periodMins.unit}</div>
        </div>
        <CountStat key={`d-${period}`} to={periodStats.activeDays} label="active days" />
      </div>

      {/* Expand */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-muted/60 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground hover:bg-muted"
      >
        {open ? "Hide stats" : "View more stats"}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-3.5 w-3.5" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="stats"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-4 border-t border-border pt-4">
              <StatsPanel stats={stats} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function StreakNumber({ value }: { value: number }) {
  return (
    <motion.span
      key={value}
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="font-serif text-4xl tabular-nums leading-none"
    >
      <CountUp to={value} />
    </motion.span>
  );
}

function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  const reduce =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    if (reduce) { setN(to); return; }
    let raf = 0;
    const start = performance.now();
    const dur = Math.min(900, 250 + to * 60);
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(eased * to));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, reduce]);
  return <>{n}</>;
}
