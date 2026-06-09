import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

interface DayBar { label: string; minutes: number; isToday: boolean }

export function WeekSummary() {
  const { user } = useAuth();
  const [bars, setBars] = useState<DayBar[]>([]);
  const [totalMin, setTotalMin] = useState(0);
  const [count, setCount] = useState(0);
  const [miles, setMiles] = useState(0);
  const [deltaMin, setDeltaMin] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!user) return;
    const start14 = new Date(); start14.setDate(start14.getDate() - 13); start14.setHours(0, 0, 0, 0);
    supabase
      .from("walk_sessions")
      .select("id,started_at,duration_seconds,distance_meters,status")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("started_at", start14.toISOString())
      .then(({ data }) => {
        const rows = data ?? [];
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const sevenAgo = new Date(today); sevenAgo.setDate(today.getDate() - 6);
        const prev7Start = new Date(today); prev7Start.setDate(today.getDate() - 13);
        const prev7End = new Date(today); prev7End.setDate(today.getDate() - 7);

        const dayMins = new Array(7).fill(0);
        const dayHas = new Array(7).fill(false);
        let prevMin = 0; let curMin = 0; let curMiles = 0; let curCount = 0;

        for (const r of rows) {
          const t = new Date(r.started_at as string);
          const m = Math.round(((r.duration_seconds as number) ?? 0) / 60);
          const d = ((r.distance_meters as number | null) ?? 0) / 1609.344;
          if (t >= sevenAgo && t <= new Date(today.getTime() + 86400000)) {
            const idx = Math.min(6, Math.max(0, Math.floor((t.getTime() - sevenAgo.getTime()) / 86400000)));
            dayMins[idx] += m;
            dayHas[idx] = true;
            curMin += m; curMiles += d; curCount += 1;
          } else if (t >= prev7Start && t < prev7End) {
            prevMin += m;
          }
        }
        const wkdays = ["S","M","T","W","T","F","S"];
        const out: DayBar[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(sevenAgo); d.setDate(sevenAgo.getDate() + i);
          out.push({ label: wkdays[d.getDay()], minutes: dayMins[i], isToday: d.getTime() === today.getTime() });
        }
        setBars(out);
        setTotalMin(curMin); setCount(curCount); setMiles(Math.round(curMiles * 10) / 10);
        setDeltaMin(curMin - prevMin);
        // streak: consecutive days walked ending today (or yesterday)
        let s = 0;
        for (let i = 6; i >= 0; i--) { if (dayHas[i]) s++; else break; }
        setStreak(s);
      });
  }, [user]);

  const max = Math.max(15, ...bars.map((b) => b.minutes));
  const delta = deltaMin ?? 0;
  const deltaChip =
    deltaMin === null
      ? null
      : delta === 0
        ? "± same"
        : `${delta > 0 ? "+" : ""}${delta}m vs last`;

  return (
    <Card className="rounded-2xl border-border bg-card/90 p-4 shadow-soft backdrop-blur-sm">
      <Link to="/journal" className="block">
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">This week</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-serif text-2xl tabular-nums">{totalMin}</span>
              <span className="text-sm text-muted-foreground">min · {count} {count === 1 ? "walk" : "walks"} · {miles} mi</span>
              {deltaChip && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${delta > 0 ? "bg-forest/10 text-forest" : delta < 0 ? "bg-clay/10 text-clay" : "bg-secondary text-muted-foreground"}`}>
                  {deltaChip}
                </span>
              )}
            </div>
          </div>
          {streak > 1 && (
            <div className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
              🔥 {streak}-day
            </div>
          )}
        </div>
        <div className="mt-3 flex h-12 items-end gap-1.5">
          {bars.map((b, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-9 w-full items-end">
                <div
                  className={`w-full rounded-t-md transition-all ${b.isToday ? "bg-forest ring-2 ring-forest/30 ring-offset-1 ring-offset-card" : b.minutes > 0 ? "bg-forest/70" : "bg-muted"}`}
                  style={{ height: `${Math.max(b.minutes > 0 ? 12 : 4, Math.round((b.minutes / max) * 100))}%` }}
                  title={`${b.minutes} min`}
                />
              </div>
              <span className={`text-[10px] ${b.isToday ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{b.label}</span>
            </div>
          ))}
        </div>
        {count === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">First walk of the week? A small loop counts.</p>
        )}
      </Link>
    </Card>
  );
}
