import { useEffect, useMemo, useState } from "react";
import { useGeolocation } from "@/hooks/use-weather";
import { getDaily, dailyWalkScore, type DailyPoint } from "@/lib/weather";
import { CloudRain, Sun, Cloud, CloudSnow, CloudFog, CloudLightning, CloudDrizzle, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";

function Glyph({ tone, className }: { tone: DailyPoint["tone"]; className?: string }) {
  const cls = className ?? "h-5 w-5";
  if (tone === "clear") return <Sun className={cls} />;
  if (tone === "cloud") return <Cloud className={cls} />;
  if (tone === "rain") return <CloudRain className={cls} />;
  if (tone === "drizzle") return <CloudDrizzle className={cls} />;
  if (tone === "snow") return <CloudSnow className={cls} />;
  if (tone === "fog") return <CloudFog className={cls} />;
  return <CloudLightning className={cls} />;
}

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function WeatherForecast() {
  const { coords } = useGeolocation({ autoRequest: false, ipFallback: true });
  const [days, setDays] = useState<DailyPoint[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!coords) return;
    let cancel = false;
    getDaily(coords.lat, coords.lng, 7).then((d) => { if (!cancel) setDays(d); });
    return () => { cancel = true; };
  }, [coords]);

  const bestDay = useMemo(() => {
    if (!days.length) return null;
    const goods = days
      .map((d, i) => ({ d, i, score: dailyWalkScore(d) }))
      .filter((x) => x.score === "good" && x.i > 0); // skip today
    if (!goods.length) return null;
    const pick = goods[0];
    const label = WEEK[new Date(pick.d.iso).getDay()];
    return { label, day: pick.d };
  }, [days]);

  if (!days.length) return null;

  return (
    <Card className="rounded-2xl border-border bg-card/90 p-3 shadow-soft backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-1 text-left"
      >
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            7-day outlook
          </div>
          {bestDay && (
            <span className="inline-flex items-center gap-1 rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-medium text-forest">
              <Glyph tone={bestDay.day.tone} className="h-3 w-3" />
              Best: {bestDay.label} {bestDay.day.tempMaxF}°
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {days.map((d, i) => {
            const date = new Date(d.iso);
            const label = i === 0 ? "Today" : WEEK[date.getDay()];
            const score = dailyWalkScore(d);
            const scoreColor = score === "good" ? "bg-forest/15 text-forest" : score === "okay" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-rose-500/15 text-rose-700 dark:text-rose-300";
            return (
              <div key={d.iso} className="flex min-w-[68px] flex-col items-center gap-1.5 rounded-xl border border-border bg-background/60 p-2.5">
                <span className={`text-[11px] font-medium ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                <Glyph tone={d.tone} className="h-5 w-5 text-foreground/80" />
                <div className="text-xs tabular-nums">
                  <span className="font-semibold">{d.tempMaxF}°</span>
                  <span className="text-muted-foreground"> / {d.tempMinF}°</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{d.precipProb}%</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${scoreColor}`}>{score}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
