import { useEffect, useState } from "react";

interface Props {
  lat: number;
  lng: number;
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

function iconFor(code: number) {
  if (code === 0 || code === 1) return "☀";
  if (code === 2) return "⛅";
  if (code === 3 || code === 45 || code === 48) return "☁";
  if (code >= 51 && code <= 67) return "🌧";
  if (code >= 71 && code <= 77) return "❄";
  if (code >= 80 && code <= 82) return "🌦";
  if (code >= 95) return "⛈";
  return "·";
}

type Slot = { tempF: number; code: number; pop: number; label: string } | null;

export function WalkWeatherPeek({ lat, lng, centerIso }: Props) {
  const [slot, setSlot] = useState<Slot | undefined>(undefined); // undefined = loading, null = failed

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
        if (!times.length) { setSlot(null); return; }
        const target = new Date(centerIso).getTime();
        let idx = 0; let best = Infinity;
        for (let i = 0; i < times.length; i++) {
          const diff = Math.abs(new Date(times[i]).getTime() - target);
          if (diff < best) { best = diff; idx = i; }
        }
        const code = codes[idx] ?? 0;
        setSlot({
          tempF: Math.round(temps[idx] ?? 0),
          code,
          pop: pops[idx] ?? 0,
          label: WEATHER_LABEL[code] ?? "Forecast",
        });
      })
      .catch(() => { if (!cancel) setSlot(null); });
    return () => { cancel = true; };
  }, [lat, lng, centerIso]);

  if (slot === undefined) {
    return <div className="h-14 w-28 animate-pulse rounded-2xl bg-muted/70" aria-hidden />;
  }
  if (slot === null) return null;

  return (
    <div
      className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card/70 px-3 py-2 text-sm shadow-soft"
      title={slot.label}
    >
      <span className="text-xl leading-none" aria-hidden>{iconFor(slot.code)}</span>
      <div className="flex flex-col leading-tight">
        <span className="font-medium">{slot.tempF}°F{slot.pop >= 20 ? <span className="text-muted-foreground"> · {slot.pop}%</span> : null}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">at walk time</span>
      </div>
    </div>
  );
}

export default WalkWeatherPeek;
