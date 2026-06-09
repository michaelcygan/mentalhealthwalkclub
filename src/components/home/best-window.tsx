import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sun, Cloud, CloudRain, CloudDrizzle, Sparkles } from "lucide-react";
import { useGeolocation } from "@/hooks/use-weather";
import { getHourly, type HourPoint } from "@/lib/weather";

function scoreHour(h: HourPoint): number {
  // Higher = better. Penalize rain prob, wind, extreme temp.
  let s = 100;
  s -= h.precipProb * 0.9;
  s -= Math.max(0, h.windMph - 10) * 1.5;
  const t = h.tempF;
  if (t < 40 || t > 90) s -= 30;
  else if (t < 50 || t > 82) s -= 12;
  return s;
}

export function BestWindow() {
  const { coords } = useGeolocation({ autoRequest: false, ipFallback: true });
  const [hours, setHours] = useState<HourPoint[]>([]);

  useEffect(() => {
    if (!coords) return;
    let cancel = false;
    getHourly(coords.lat, coords.lng, 14).then((h) => {
      if (!cancel) setHours(h);
    });
    return () => {
      cancel = true;
    };
  }, [coords]);

  const best = useMemo(() => {
    if (hours.length < 3) return null;
    // Restrict to daylight-ish window: 6–21 local
    const now = new Date();
    const candidates = hours.filter((h) => {
      const d = new Date(h.iso);
      const hr = d.getHours();
      return hr >= 6 && hr <= 21 && d.getTime() > now.getTime();
    });
    if (candidates.length < 2) return null;
    let bestH = candidates[0];
    let bestS = scoreHour(bestH);
    for (const h of candidates) {
      const s = scoreHour(h);
      if (s > bestS) {
        bestS = s;
        bestH = h;
      }
    }
    // Only surface if meaningfully better than median
    const sorted = candidates.map(scoreHour).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (bestS - median < 8) return null;
    return { h: bestH, score: bestS };
  }, [hours]);

  if (!best) return null;

  const d = new Date(best.h.iso);
  const hr = d.getHours();
  const next = new Date(d.getTime() + 3600 * 1000);
  const fmt = (x: Date) => {
    const h12 = x.getHours() % 12 || 12;
    const ampm = x.getHours() < 12 ? "am" : "pm";
    return `${h12}${ampm}`;
  };
  const range = `${fmt(d)}–${fmt(next)}`;
  const isToday = d.toDateString() === new Date().toDateString();
  const dayLabel = isToday ? "today" : "tomorrow";

  const Icon =
    best.h.tone === "rain"
      ? CloudRain
      : best.h.tone === "drizzle"
        ? CloudDrizzle
        : best.h.tone === "cloud"
          ? Cloud
          : best.h.tone === "clear"
            ? Sun
            : Sparkles;

  void hr;

  return (
    <Link
      to="/walk/new"
      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/90 p-3 shadow-soft backdrop-blur-sm transition hover:border-forest/40"
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Best window {dayLabel}
          </p>
          <p className="font-serif text-[15px] leading-tight text-foreground">
            {range} · {best.h.tempF}° {best.h.label}
          </p>
        </div>
      </div>
      <span className="text-[11px] uppercase tracking-[0.14em] text-forest">Plan →</span>
    </Link>
  );
}
