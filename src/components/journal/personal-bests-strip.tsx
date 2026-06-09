import { useMemo } from "react";
import { Flame, Timer, Sparkles, Mountain } from "lucide-react";
import type { FeedEntry, JournalStats } from "@/lib/journal-entries.functions";
import { formatDuration } from "@/lib/format-duration";

interface Props {
  stats: JournalStats;
  entries: FeedEntry[];
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function PersonalBestsStrip({ stats, entries }: Props) {
  const bests = useMemo(() => {
    // Longest streak ever (consecutive showing-up days from walkDays + entryDays)
    const days = Array.from(new Set([...stats.walkDays, ...stats.entryDays])).sort();
    let longest = 0;
    let run = 0;
    let prev: Date | null = null;
    for (const iso of days) {
      const d = new Date(iso + "T00:00:00");
      if (prev) {
        const diff = Math.round((d.getTime() - prev.getTime()) / 86400000);
        if (diff === 1) run += 1;
        else run = 1;
      } else {
        run = 1;
      }
      if (run > longest) longest = run;
      prev = d;
    }

    // Longest walk (minutes)
    let longestWalk = { mins: 0, at: "" as string };
    for (const e of entries) {
      if (e.kind !== "walk") continue;
      const m = Math.round((e.duration_seconds ?? 0) / 60);
      if (m > longestWalk.mins) longestWalk = { mins: m, at: e.at };
    }

    // Biggest mood lift
    let biggestLift = { delta: 0, at: "" as string };
    for (const e of entries) {
      if (e.kind !== "walk") continue;
      if (e.mood_before_score == null || e.mood_after_score == null) continue;
      const d = e.mood_after_score - e.mood_before_score;
      if (d > biggestLift.delta) biggestLift = { delta: d, at: e.at };
    }

    // Most active day (max minutes in a single day)
    let mostActive = { mins: 0, day: "" as string };
    for (const [iso, m] of Object.entries(stats.minutesByDay)) {
      if (m > mostActive.mins) mostActive = { mins: m, day: iso };
    }

    return { longest, longestWalk, biggestLift, mostActive };
  }, [stats, entries]);

  const fmtDate = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";

  const cards: { icon: React.ReactNode; label: string; value: React.ReactNode; sub: string }[] = [
    {
      icon: <Flame className="h-3 w-3" />,
      label: "Longest streak",
      value: (
        <>
          <span className="font-serif text-2xl tabular-nums">{bests.longest}</span>
          <span className="ml-1 text-[11px] text-muted-foreground">day{bests.longest === 1 ? "" : "s"}</span>
        </>
      ),
      sub: bests.longest > 0 ? "personal best" : "build one this week",
    },
    {
      icon: <Timer className="h-3 w-3" />,
      label: "Longest walk",
      value: (() => {
        const f = formatDuration(bests.longestWalk.mins);
        return (
          <>
            <span className="font-serif text-2xl tabular-nums">{f.value}</span>
            <span className="ml-1 text-[11px] text-muted-foreground">{f.unit}</span>
          </>
        );
      })(),
      sub: bests.longestWalk.at ? fmtDate(bests.longestWalk.at) : "log a walk to set this",
    },
    {
      icon: <Sparkles className="h-3 w-3" />,
      label: "Biggest mood lift",
      value: (
        <span className="font-serif text-2xl tabular-nums">
          {bests.biggestLift.delta > 0 ? `+${bests.biggestLift.delta}` : "—"}
        </span>
      ),
      sub: bests.biggestLift.at ? fmtDate(bests.biggestLift.at) : "needs mood before & after",
    },
    {
      icon: <Mountain className="h-3 w-3" />,
      label: "Most active day",
      value: (() => {
        const f = formatDuration(bests.mostActive.mins);
        return (
          <>
            <span className="font-serif text-2xl tabular-nums">{f.value}</span>
            <span className="ml-1 text-[11px] text-muted-foreground">{f.unit}</span>
          </>
        );
      })(),
      sub: bests.mostActive.day ? fmtDate(bests.mostActive.day) : "—",
    },
  ];

  return (
    <section>
      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Personal bests
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cards.map((c, i) => (
          <div
            key={i}
            className="w-[52%] shrink-0 snap-start rounded-2xl border border-border bg-card p-3 shadow-soft"
          >
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {c.icon}
              {c.label}
            </div>
            <div className="mt-1.5 flex items-baseline">{c.value}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{c.sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
