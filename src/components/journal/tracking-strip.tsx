import { useMemo } from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { WeeklyRing } from "@/components/weekly-ring";

export type Period = "week" | "month" | "all";

export interface TrackingWalk {
  started_at: string;
  duration_seconds: number | null;
  distance_meters: number | null;
  steps: number | null;
  mood_after_score: number | null;
}

interface Props {
  period: Period;
  onPeriodChange: (p: Period) => void;
  walks: TrackingWalk[];
}

export function TrackingStrip({ period, onPeriodChange, walks }: Props) {
  const { current, previous, weekDots, weekDaysOn, weekGoal } = useMemo(() => {
    const now = new Date();
    const startOfWeek = (() => {
      const d = new Date(now); d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return d;
    })();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const periodStart = period === "week" ? startOfWeek
      : period === "month" ? startOfMonth
      : new Date(0);
    const prevStart = period === "week"
      ? new Date(startOfWeek.getTime() - 7 * 86400_000)
      : period === "month"
      ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
      : null;
    const prevEnd = period === "week"
      ? startOfWeek
      : period === "month"
      ? startOfMonth
      : null;

    const sum = (ws: TrackingWalk[]) => ({
      mins: ws.reduce((s, w) => s + Math.round((w.duration_seconds ?? 0) / 60), 0),
      miles: ws.reduce((s, w) => s + (w.distance_meters ?? 0) * 0.000621371, 0),
      steps: ws.reduce((s, w) => s + (w.steps ?? 0), 0),
      moods: ws.map((w) => w.mood_after_score).filter((v): v is number => v != null),
    });

    const inPeriod = walks.filter((w) => new Date(w.started_at) >= periodStart);
    const inPrev = prevStart && prevEnd
      ? walks.filter((w) => {
          const d = new Date(w.started_at);
          return d >= prevStart && d < prevEnd;
        })
      : [];

    // Week dots — Mon..Sun
    const days = Array.from({ length: 7 }, () => false);
    walks.forEach((w) => {
      const d = new Date(w.started_at);
      if (d < startOfWeek) return;
      const idx = (d.getDay() + 6) % 7;
      days[idx] = true;
    });
    const onCount = days.filter(Boolean).length;

    return {
      current: sum(inPeriod),
      previous: sum(inPrev),
      weekDots: days,
      weekDaysOn: onCount,
      weekGoal: 7,
    };
  }, [walks, period]);

  const moodAvg = current.moods.length ? current.moods.reduce((s, n) => s + n, 0) / current.moods.length : null;
  const minsDelta = previous.mins ? current.mins - previous.mins : 0;
  const showDelta = period !== "all" && previous.mins > 0;

  const weekMins = useMemo(() => {
    const startOfWeek = new Date(); startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
    return walks
      .filter((w) => new Date(w.started_at) >= startOfWeek)
      .reduce((s, w) => s + Math.round((w.duration_seconds ?? 0) / 60), 0);
  }, [walks]);

  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-soft md:p-5">
      {/* Header: title + period toggle */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Tracking</div>
        <div className="inline-flex rounded-full border border-border bg-background p-0.5 text-xs">
          {(["week", "month", "all"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPeriodChange(p)}
              className={`rounded-full px-3 py-1 capitalize transition ${period === p ? "bg-forest text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Week ring + dots — always shows the actual current week as the focal "did I show up" object */}
      <div className="mb-4">
        <WeeklyRing minutes={weekMins} dots={weekDots} />
        <div className="mt-2 text-[11px] text-muted-foreground">
          <span className="tabular-nums">{weekDaysOn}</span> of {weekGoal} days walked this week
        </div>
      </div>

      {/* Period totals */}
      <div className="grid grid-cols-4 gap-2 border-t border-border pt-4">
        <Stat value={current.mins.toLocaleString()} label="minutes" />
        <Stat value={current.miles.toFixed(1)} label="miles" />
        <Stat value={current.steps.toLocaleString()} label="steps" />
        <Stat value={moodAvg !== null ? moodAvg.toFixed(1) : "—"} label="mood avg" tone="clay" />
      </div>

      {showDelta && (
        <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground">
          {minsDelta > 0 ? <ArrowUp className="h-3 w-3 text-forest" />
            : minsDelta < 0 ? <ArrowDown className="h-3 w-3 text-clay" />
            : <Minus className="h-3 w-3" />}
          <span className="tabular-nums">{Math.abs(minsDelta)}</span> min vs last {period}
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: "forest" | "clay" }) {
  return (
    <div>
      <div className={`font-serif text-2xl tabular-nums leading-none ${tone === "clay" ? "text-clay" : ""}`}>{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
