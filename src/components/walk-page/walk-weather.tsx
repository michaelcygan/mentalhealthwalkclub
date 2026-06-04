import { useEffect, useState } from "react";

interface HourSlot {
  time: string; // ISO
  tempF: number;
  code: number;
  pop: number; // 0..100
}

interface Props {
  lat: number;
  lng: number;
  /** Center the forecast window around this ISO time (the walk start). */
  centerIso: string;
}

const WEATHER_LABEL: Record<number, string> = {
  0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Fog",
  51: "Drizzle", 53: "Drizzle", 55: "Drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain",
  71: "Snow", 73: "Snow", 75: "Heavy snow",
  80: "Showers", 81: "Showers", 82: "Heavy showers",
  95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
};

const weatherIcon = (code: number) => {
  if (code === 0 || code === 1) return "☀";
  if (code === 2) return "⛅";
  if (code === 3 || code === 45 || code === 48) return "☁";
  if (code >= 51 && code <= 67) return "🌧";
  if (code >= 71 && code <= 77) return "❄";
  if (code >= 80 && code <= 82) return "🌦";
  if (code >= 95) return "⛈";
  return "·";
};

export default function WalkWeather({ lat, lng, centerIso }: Props) {
  const [hours, setHours] = useState<HourSlot[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set("hourly", "temperature_2m,weather_code,precipitation_probability");
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "3");

    fetch(url.toString())
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("weather fetch failed"))))
      .then((d) => {
        if (cancel) return;
        const times: string[] = d?.hourly?.time ?? [];
        const temps: number[] = d?.hourly?.temperature_2m ?? [];
        const codes: number[] = d?.hourly?.weather_code ?? [];
        const pops: number[] = d?.hourly?.precipitation_probability ?? [];
        if (!times.length) { setHours([]); return; }

        // Center window: 8 hours around the walk start (2 before, 6 after)
        const target = new Date(centerIso).getTime();
        let centerIdx = 0;
        let best = Number.POSITIVE_INFINITY;
        for (let i = 0; i < times.length; i++) {
          const diff = Math.abs(new Date(times[i]).getTime() - target);
          if (diff < best) { best = diff; centerIdx = i; }
        }
        const start = Math.max(0, centerIdx - 2);
        const end = Math.min(times.length, start + 8);
        const slots: HourSlot[] = [];
        for (let i = start; i < end; i++) {
          slots.push({ time: times[i], tempF: Math.round(temps[i]), code: codes[i], pop: pops[i] ?? 0 });
        }
        setHours(slots);
      })
      .catch((e) => { if (!cancel) setErr(e.message); });
    return () => { cancel = true; };
  }, [lat, lng, centerIso]);

  if (err) return <p className="text-xs text-muted-foreground">Weather is offline right now.</p>;
  if (!hours) return <div className="h-20 w-full animate-pulse rounded-2xl bg-muted" />;
  if (hours.length === 0) return null;

  const startMs = new Date(centerIso).getTime();
  return (
    <div className="rounded-3xl border border-border bg-card/60 p-3">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {hours.map((h) => {
          const d = new Date(h.time);
          const isWalkHour = Math.abs(d.getTime() - startMs) < 1000 * 60 * 30;
          const hr = d.toLocaleTimeString([], { hour: "numeric" });
          return (
            <div
              key={h.time}
              className={
                "flex min-w-[58px] flex-col items-center rounded-2xl px-2 py-2 text-center " +
                (isWalkHour ? "bg-forest/10 ring-1 ring-forest/40" : "bg-background/40")
              }
              title={WEATHER_LABEL[h.code] ?? "Forecast"}
            >
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{hr}</div>
              <div className="my-1 text-lg leading-none">{weatherIcon(h.code)}</div>
              <div className="text-sm font-medium">{h.tempF}°</div>
              {h.pop >= 30 ? (
                <div className="mt-0.5 text-[10px] text-sky-700">{h.pop}%</div>
              ) : (
                <div className="mt-0.5 text-[10px] text-transparent">·</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
