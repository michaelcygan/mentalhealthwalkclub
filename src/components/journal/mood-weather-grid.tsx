import { useMemo } from "react";
import { Sun, Cloud, CloudRain, Moon } from "lucide-react";
import type { FeedEntry } from "@/lib/journal-entries.functions";

type WeatherKey = "sun" | "cloud" | "rain" | "night";

const CONFIG: { key: WeatherKey; label: string; Icon: typeof Sun; tone: string }[] = [
  { key: "sun", label: "Sun", Icon: Sun, tone: "text-amber-500" },
  { key: "cloud", label: "Cloud", Icon: Cloud, tone: "text-muted-foreground" },
  { key: "rain", label: "Rain", Icon: CloudRain, tone: "text-sky-500" },
  { key: "night", label: "Night", Icon: Moon, tone: "text-indigo-400" },
];

function classify(e: FeedEntry): WeatherKey | null {
  if (e.kind !== "walk") return null;
  const w = e.weather_at_end;
  if (!w) return null;
  if (w.isDay === false) return "night";
  const tone = (w.tone ?? "").toLowerCase();
  if (tone.includes("rain")) return "rain";
  if (tone.includes("sun") || tone.includes("clear")) return "sun";
  if (tone.includes("cloud") || tone.includes("fog") || tone.includes("haze")) return "cloud";
  return "cloud";
}

export function MoodWeatherGrid({ entries }: { entries: FeedEntry[] }) {
  const byWeather = useMemo(() => {
    const acc: Record<WeatherKey, { count: number; sum: number; with_score: number }> = {
      sun: { count: 0, sum: 0, with_score: 0 },
      cloud: { count: 0, sum: 0, with_score: 0 },
      rain: { count: 0, sum: 0, with_score: 0 },
      night: { count: 0, sum: 0, with_score: 0 },
    };
    for (const e of entries) {
      const k = classify(e);
      if (!k) continue;
      acc[k].count += 1;
      if (e.mood_after_score != null) {
        acc[k].sum += e.mood_after_score;
        acc[k].with_score += 1;
      }
    }
    return acc;
  }, [entries]);

  const total = CONFIG.reduce((s, c) => s + byWeather[c.key].count, 0);

  if (total === 0) {
    return (
      <section className="rounded-3xl border border-dashed border-border bg-card/60 p-4 text-center text-xs text-muted-foreground">
        Walks with weather will show up here once you finish a few.
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-soft">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Mood × weather
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {CONFIG.map(({ key, label, Icon, tone }) => {
          const d = byWeather[key];
          const avg = d.with_score > 0 ? d.sum / d.with_score : null;
          return (
            <div key={key} className="rounded-2xl border border-border bg-background/60 p-2.5 text-center">
              <Icon className={`mx-auto h-4 w-4 ${tone}`} />
              <div className="mt-1 font-serif text-base tabular-nums leading-none">
                {avg != null ? avg.toFixed(1) : "—"}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                {label}
              </div>
              <div className="text-[10px] tabular-nums text-muted-foreground">
                {d.count} walk{d.count === 1 ? "" : "s"}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
