import { WeatherGlyph } from "@/lib/weather-icons";
import type { HourPoint } from "@/lib/weather";

interface Props { hours: HourPoint[]; max?: number }

/** Mini hourly forecast row — icon, hour, temp, rain%. */
export function WeatherStrip({ hours, max = 6 }: Props) {
  const slice = hours.slice(0, max);
  if (!slice.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto rounded-2xl bg-foreground/5 p-2">
      {slice.map((h) => {
        const d = new Date(h.iso);
        const hr = d.getHours();
        const ampm = hr >= 12 ? "p" : "a";
        const display = ((hr + 11) % 12) + 1;
        return (
          <div key={h.iso} className="flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-xs">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{display}{ampm}</span>
            <WeatherGlyph tone={h.tone} className="h-4 w-4 text-foreground/80" />
            <span className="font-medium">{h.tempF}°</span>
            {h.precipProb >= 20 && (
              <span className="text-[10px] text-blue-600">{h.precipProb}%</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
