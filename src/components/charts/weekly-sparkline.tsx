import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tiny inline sparkline of the last 12 weeks of walking minutes, with a
 * plain-sentence caption underneath. Self-fetching so it can be dropped in
 * anywhere a user id is known.
 */
export function WeeklySparkline({ userId }: { userId: string | null | undefined }) {
  const [weeks, setWeeks] = useState<number[] | null>(null);

  useEffect(() => {
    if (!userId) { setWeeks(null); return; }
    let cancel = false;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 12 * 7);
    supabase.from("walk_sessions")
      .select("started_at,duration_seconds")
      .eq("user_id", userId).eq("status", "completed")
      .gte("started_at", since.toISOString())
      .limit(1000)
      .then(({ data }) => {
        if (cancel) return;
        const buckets = new Array(12).fill(0) as number[];
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const monday = new Date(today);
        monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
        (data ?? []).forEach((r) => {
          const d = new Date(r.started_at as string); d.setHours(0, 0, 0, 0);
          const diffDays = Math.floor((monday.getTime() - d.getTime()) / 86400_000);
          const weekIdx = 11 - Math.floor(diffDays / 7);
          if (weekIdx < 0 || weekIdx > 11) return;
          buckets[weekIdx] += Math.round(((r.duration_seconds as number | null) ?? 0) / 60);
        });
        setWeeks(buckets);
      });
    return () => { cancel = true; };
  }, [userId]);

  const path = useMemo(() => {
    if (!weeks) return { d: "", area: "", last: null as null | { x: number; y: number }, max: 0 };
    const W = 320, H = 48, pad = 4;
    const max = Math.max(1, ...weeks);
    const xs = weeks.map((_, i) => pad + (i * (W - pad * 2)) / (weeks.length - 1));
    const ys = weeks.map((v) => H - pad - (v / max) * (H - pad * 2));
    let d = "";
    xs.forEach((x, i) => { d += (i === 0 ? "M " : " L ") + x.toFixed(1) + " " + ys[i].toFixed(1); });
    const area = d + ` L ${xs[xs.length - 1].toFixed(1)} ${H - pad} L ${xs[0].toFixed(1)} ${H - pad} Z`;
    return { d, area, last: { x: xs[xs.length - 1], y: ys[ys.length - 1] }, max };
  }, [weeks]);

  if (!weeks) return null;

  const thisWeek = weeks[weeks.length - 1] ?? 0;
  const lastWeek = weeks[weeks.length - 2] ?? 0;
  const avg = weeks.reduce((s, n) => s + n, 0) / weeks.length;
  const caption = (() => {
    if (thisWeek === 0 && lastWeek === 0) return "Quiet weeks. A five-minute walk counts too.";
    if (thisWeek > lastWeek) return `You're up ${thisWeek - lastWeek} minutes from last week.`;
    if (thisWeek < lastWeek && lastWeek > 0) return `A softer week — ${lastWeek - thisWeek} minutes under last week.`;
    if (avg > 0 && thisWeek >= avg) return "Holding a steady pace this week.";
    return "Easing in — every step adds up.";
  })();

  return (
    <section className="rounded-3xl border border-border bg-card/60 p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">
          Last 12 weeks · minutes
        </div>
        <div className="font-serif text-sm text-muted-foreground tabular-nums">
          {thisWeek} <span className="text-xs">this week</span>
        </div>
      </div>
      <svg viewBox="0 0 320 48" className="mt-2 h-12 w-full" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.55 0.06 150)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="oklch(0.55 0.06 150)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {path.area && <path d={path.area} fill="url(#sparkFill)" />}
        {path.d && <path d={path.d} fill="none" stroke="oklch(0.36 0.05 155)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />}
        {path.last && <circle cx={path.last.x} cy={path.last.y} r={2.8} fill="oklch(0.36 0.05 155)" />}
      </svg>
      <p className="mt-2 font-serif text-sm italic text-muted-foreground">{caption}</p>
    </section>
  );
}
