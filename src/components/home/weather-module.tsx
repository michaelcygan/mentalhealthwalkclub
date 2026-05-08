import { useMemo, useState } from "react";
import { ChevronDown, Sun, CloudRain } from "lucide-react";
import { useCurrentWeather, useGeolocation, useHourlyForecast } from "@/hooks/use-weather";
import { WeatherGlyph } from "@/lib/weather-icons";
import { WeatherStrip } from "@/components/weather-strip";
import { RainSoonBanner } from "@/components/rain-soon-banner";
import type { HourPoint, WeatherTone } from "@/lib/weather";
import { haptics } from "@/lib/device";

/**
 * Self-contained weather card. Collapsed by default — single row of glanceable
 * info. Expanded → 6-hour strip + best-window pill + rain heads-up.
 */
export function WeatherModule({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const { coords, requestPrecise, requesting } = useGeolocation({ autoRequest: false, ipFallback: true });
  const { data: now } = useCurrentWeather(coords);
  const hours = useHourlyForecast(coords, 12);
  const [open, setOpen] = useState(defaultOpen);
  const bestWindow = useMemo(() => findBestWindow(hours), [hours]);

  if (!now) {
    return (
      <button
        type="button"
        onClick={() => requestPrecise()}
        disabled={requesting}
        className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 px-4 py-3 text-left text-sm text-muted-foreground transition hover:border-forest/40 hover:text-foreground"
      >
        <Sun className="h-4 w-4" />
        <span>{requesting ? "Locating…" : "Tap for local weather"}</span>
      </button>
    );
  }

  const hint = friendlyHint(now.tone, now.tempF);

  return (
    <section
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
      id="weather-module"
    >
      <button
        type="button"
        onClick={() => { haptics.tap(); setOpen(o => !o); }}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-foreground/[0.03]"
        aria-expanded={open}
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-accent/50">
          <WeatherGlyph tone={now.tone} isDay={now.isDay} className="h-4.5 w-4.5 text-foreground/85" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-base tabular-nums">{now.tempF}°</span>
            <span className="text-xs text-muted-foreground">· {now.label}</span>
          </div>
          {hint && <div className="truncate text-[11px] italic text-muted-foreground">{hint}</div>}
        </div>
        {bestWindow && !open && (
          <span className="hidden shrink-0 rounded-full bg-accent/60 px-2 py-0.5 text-[10px] font-medium text-forest sm:inline">
            best · {bestWindow.label}
          </span>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-2 border-t border-border/60 px-3 pb-3 pt-3">
          <RainSoonBanner coords={coords} active={true} currentlyRaining={now.precipMm > 0} />
          {bestWindow && (
            <div className="flex items-center gap-2 rounded-xl bg-accent/40 px-3 py-2 text-xs">
              <Sun className="h-3.5 w-3.5 text-clay" />
              <span className="font-medium text-forest">Best window today</span>
              <span className="text-muted-foreground">· {bestWindow.label} · {bestWindow.tempF}°</span>
            </div>
          )}
          <WeatherStrip hours={hours} />
          {now.windMph >= 12 && (
            <p className="px-1 text-[11px] text-muted-foreground">Breezy out — {now.windMph} mph wind.</p>
          )}
        </div>
      )}
    </section>
  );
}

function friendlyHint(tone: WeatherTone, tempF: number): string | null {
  if (tone === "rain" || tone === "drizzle") return "a little wet — pack a hood?";
  if (tone === "storm") return "thunder around — maybe an indoor walk.";
  if (tone === "snow") return "snowy out — boots if you've got them.";
  if (tempF <= 32) return "cold out — bundle up.";
  if (tempF >= 88) return "warm — bring water.";
  if (tone === "clear" && tempF >= 55 && tempF <= 78) return "good walking weather.";
  return null;
}

const TONE_SCORE: Record<WeatherTone, number> = {
  clear: 5, cloud: 4, fog: 3, drizzle: 2, snow: 2, rain: 1, storm: 0,
};

function scoreHour(h: HourPoint): number {
  let s = TONE_SCORE[h.tone] ?? 2;
  if (h.tempF >= 55 && h.tempF <= 78) s += 1;
  if (h.tempF <= 32 || h.tempF >= 92) s -= 2;
  if (h.precipProb >= 50) s -= 2;
  if (h.windMph >= 18) s -= 1;
  return s;
}

/** Find the next 2-hour block (today only) with the best average score. */
function findBestWindow(hours: HourPoint[]): { label: string; tempF: number } | null {
  if (hours.length < 2) return null;
  const today = new Date().getDate();
  const sameDay = hours.filter(h => new Date(h.iso).getDate() === today);
  if (sameDay.length < 2) return null;
  let best = -Infinity;
  let bestIdx = -1;
  for (let i = 0; i < sameDay.length - 1; i++) {
    const avg = (scoreHour(sameDay[i]) + scoreHour(sameDay[i + 1])) / 2;
    if (avg > best) { best = avg; bestIdx = i; }
  }
  if (bestIdx < 0 || best < 3) return null;
  const start = new Date(sameDay[bestIdx].iso);
  const end = new Date(sameDay[bestIdx + 1].iso); end.setHours(end.getHours() + 1);
  const fmt = (d: Date) => {
    const h = d.getHours();
    return `${((h + 11) % 12) + 1}${h >= 12 ? "p" : "a"}`;
  };
  return {
    label: `${fmt(start)}–${fmt(end)}`,
    tempF: Math.round((sameDay[bestIdx].tempF + sameDay[bestIdx + 1].tempF) / 2),
  };
}
