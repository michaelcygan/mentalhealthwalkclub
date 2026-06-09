import { useMemo, useState } from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { FeedEntry, JournalStats } from "@/lib/journal-entries.functions";
import { formatDuration } from "@/lib/format-duration";

type Window = "month" | "week";

interface Props {
  stats: JournalStats;
  entries: FeedEntry[];
}

function startOfMonth(now: Date, offset: number) {
  return new Date(now.getFullYear(), now.getMonth() + offset, 1);
}
function startOfWeek(now: Date, offset: number) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
  return d;
}

export function MonthVsMonth({ stats, entries }: Props) {
  const [win, setWin] = useState<Window>("month");

  const data = useMemo(() => {
    const now = new Date();
    const [aStart, aEnd, bStart, bEnd] =
      win === "month"
        ? [
            startOfMonth(now, 0),
            new Date(now.getFullYear(), now.getMonth() + 1, 1),
            startOfMonth(now, -1),
            startOfMonth(now, 0),
          ]
        : [
            startOfWeek(now, 0),
            startOfWeek(now, 1),
            startOfWeek(now, -1),
            startOfWeek(now, 0),
          ];

    function aggregate(start: Date, end: Date) {
      let mins = 0;
      for (const [iso, m] of Object.entries(stats.minutesByDay)) {
        const d = new Date(iso + "T00:00:00");
        if (d >= start && d < end) mins += m;
      }
      let walks = 0;
      const lifts: number[] = [];
      for (const e of entries) {
        if (e.kind !== "walk") continue;
        const d = new Date(e.at);
        if (d >= start && d < end) {
          walks += 1;
          if (e.mood_before_score != null && e.mood_after_score != null) {
            lifts.push(e.mood_after_score - e.mood_before_score);
          }
        }
      }
      const lift = lifts.length ? lifts.reduce((s, n) => s + n, 0) / lifts.length : null;
      return { mins, walks, lift };
    }

    return { current: aggregate(aStart, aEnd), previous: aggregate(bStart, bEnd) };
  }, [stats.minutesByDay, entries, win]);

  const rows = [
    {
      label: "Walks",
      current: data.current.walks,
      previous: data.previous.walks,
      fmt: (n: number) => String(n),
      delta: data.current.walks - data.previous.walks,
    },
    {
      label: "Minutes",
      current: data.current.mins,
      previous: data.previous.mins,
      fmt: (n: number) => {
        const f = formatDuration(n);
        return `${f.value} ${f.unit}`;
      },
      delta: data.current.mins - data.previous.mins,
    },
    {
      label: "Avg mood lift",
      current: data.current.lift ?? 0,
      previous: data.previous.lift ?? 0,
      fmt: (n: number) => (n === 0 ? "—" : (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1))),
      delta: (data.current.lift ?? 0) - (data.previous.lift ?? 0),
    },
  ];

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {win === "month" ? "This month vs last" : "This week vs last"}
        </div>
        <button
          type="button"
          onClick={() => setWin(win === "month" ? "week" : "month")}
          className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-foreground/80 hover:bg-muted/70"
        >
          {win === "month" ? "Switch to week" : "Switch to month"}
        </button>
      </div>

      <div className="mt-3 space-y-2.5">
        {rows.map((r) => {
          const max = Math.max(Math.abs(r.current), Math.abs(r.previous), 1);
          const curW = (Math.abs(r.current) / max) * 100;
          const prevW = (Math.abs(r.previous) / max) * 100;
          const dir = r.delta > 0.05 ? "up" : r.delta < -0.05 ? "down" : "flat";
          const Icon = dir === "up" ? ArrowUp : dir === "down" ? ArrowDown : Minus;
          const tone =
            dir === "up" ? "text-forest" : dir === "down" ? "text-clay" : "text-muted-foreground";
          return (
            <div key={r.label} className="grid grid-cols-[88px_1fr_auto] items-center gap-3">
              <div className="text-xs text-muted-foreground">{r.label}</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-forest transition-all"
                      style={{ width: `${curW}%` }}
                    />
                  </div>
                  <div className="w-20 shrink-0 text-right font-serif text-sm tabular-nums">
                    {r.fmt(r.current)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60">
                    <div
                      className="h-full rounded-full bg-muted-foreground/40 transition-all"
                      style={{ width: `${prevW}%` }}
                    />
                  </div>
                  <div className="w-20 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                    {r.fmt(r.previous)}
                  </div>
                </div>
              </div>
              <div className={`inline-flex items-center gap-0.5 text-xs ${tone}`}>
                <Icon className="h-3 w-3" />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
