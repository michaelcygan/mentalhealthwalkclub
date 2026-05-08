import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Share2 } from "lucide-react";
import { share } from "@/lib/device";

interface Row {
  started_at: string;
  duration_seconds: number | null;
  distance_meters: number | null;
  weather_at_end: { code?: number } | null;
}

/** Renders only on Sundays. A small reflective summary of the past 7 days. */
export function WeekInReview({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const isSunday = useMemo(() => new Date().getDay() === 0, []);
  const dismissKey = useMemo(() => {
    const d = new Date();
    return `wir-dismissed-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }, []);

  useEffect(() => {
    if (!isSunday) return;
    if (typeof window !== "undefined" && localStorage.getItem(dismissKey)) {
      setDismissed(true);
      return;
    }
    const since = new Date();
    since.setDate(since.getDate() - 7);
    since.setHours(0, 0, 0, 0);
    supabase
      .from("walk_sessions")
      .select("started_at,duration_seconds,distance_meters,weather_at_end")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("started_at", since.toISOString())
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, [userId, isSunday, dismissKey]);

  if (!isSunday || dismissed || !rows || rows.length === 0) return null;

  const totalMin = Math.round(rows.reduce((a, r) => a + (r.duration_seconds ?? 0), 0) / 60);
  const longest = Math.round(Math.max(...rows.map((r) => r.duration_seconds ?? 0)) / 60);
  const miles = (rows.reduce((a, r) => a + (r.distance_meters ?? 0), 0) / 1609.34).toFixed(1);
  const days = new Set(rows.map((r) => new Date(r.started_at).toDateString())).size;

  const onShare = () =>
    share({
      title: "My week of walking",
      text: `${rows.length} walks · ${totalMin} min · ${miles} miles this week. 🌿`,
    });

  const dismiss = () => {
    if (typeof window !== "undefined") localStorage.setItem(dismissKey, "1");
    setDismissed(true);
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-forest/30 bg-gradient-to-br from-accent/60 via-card to-cream/40 p-5 shadow-soft">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 text-xs text-muted-foreground hover:text-foreground"
      >
        ×
      </button>
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-forest">
        <Sparkles className="h-3.5 w-3.5" /> Week in review
      </div>
      <h2 className="mt-1 font-serif text-xl text-balance">
        {rows.length === 1 ? "One walk this week — that counts." : `${rows.length} walks across ${days} day${days === 1 ? "" : "s"}.`}
      </h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat v={`${totalMin}`} l="minutes" />
        <Stat v={miles} l="miles" />
        <Stat v={`${longest}m`} l="longest" />
      </div>
      <button
        onClick={onShare}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-xs font-medium text-primary-foreground transition active:scale-95"
      >
        <Share2 className="h-3.5 w-3.5" /> Share my week
      </button>
    </section>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div className="rounded-2xl bg-card/70 p-3 text-center backdrop-blur">
      <div className="font-serif text-lg leading-none tabular-nums">{v}</div>
      <div className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">{l}</div>
    </div>
  );
}
