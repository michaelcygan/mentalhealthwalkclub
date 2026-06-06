import { useEffect, useState } from "react";

interface Props {
  lat: number | null;
  lng: number | null;
  startsAt: string;
}

/**
 * Subtle weather-aware ambient layer that sits behind the cover.
 * Lightweight CSS-only: drifting fog, soft rain streaks, or warm haze.
 * Respects prefers-reduced-motion.
 */
export function Atmosphere({ lat, lng, startsAt }: Props) {
  const [code, setCode] = useState<number | null>(null);
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (lat == null || lng == null) return;
    let cancel = false;
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set("hourly", "weather_code");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "3");
    fetch(url.toString())
      .then((r) => r.json())
      .then((d) => {
        if (cancel) return;
        const times: string[] = d?.hourly?.time ?? [];
        const codes: number[] = d?.hourly?.weather_code ?? [];
        const target = new Date(startsAt).getTime();
        let bestIdx = 0;
        let bestDelta = Infinity;
        for (let i = 0; i < times.length; i++) {
          const delta = Math.abs(new Date(times[i]).getTime() - target);
          if (delta < bestDelta) {
            bestDelta = delta;
            bestIdx = i;
          }
        }
        setCode(codes[bestIdx] ?? null);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [lat, lng, startsAt]);

  if (reduced || code == null) return null;

  if (code >= 51 && code <= 67) return <Rain />;
  if (code >= 80 && code <= 82) return <Rain heavy />;
  if (code >= 71 && code <= 77) return <Snow />;
  if (code === 45 || code === 48 || code === 3) return <Fog />;
  if (code === 0 || code === 1) return <Sunbeams />;
  if (code === 2) return <Clouds />;
  return null;
}

function Rain({ heavy = false }: { heavy?: boolean }) {
  const drops = Array.from({ length: heavy ? 28 : 16 });
  return (
    <div className="atm-layer">
      {drops.map((_, i) => (
        <span
          key={i}
          className="atm-rain"
          style={{
            left: `${(i * 7 + (i % 3) * 13) % 100}%`,
            animationDelay: `${(i * 137) % 1000}ms`,
            animationDuration: `${850 + ((i * 53) % 600)}ms`,
            opacity: heavy ? 0.55 : 0.35,
          }}
        />
      ))}
    </div>
  );
}

function Snow() {
  const flakes = Array.from({ length: 22 });
  return (
    <div className="atm-layer">
      {flakes.map((_, i) => (
        <span
          key={i}
          className="atm-snow"
          style={{
            left: `${(i * 11) % 100}%`,
            animationDelay: `${(i * 213) % 2000}ms`,
            animationDuration: `${4500 + ((i * 97) % 3000)}ms`,
          }}
        />
      ))}
    </div>
  );
}

function Fog() {
  return (
    <div className="atm-layer">
      <span className="atm-fog" style={{ top: "20%", animationDuration: "28s" }} />
      <span className="atm-fog" style={{ top: "55%", animationDuration: "40s", animationDelay: "-12s", opacity: 0.5 }} />
    </div>
  );
}

function Sunbeams() {
  return (
    <div className="atm-layer">
      <span className="atm-sun" />
    </div>
  );
}

function Clouds() {
  return (
    <div className="atm-layer">
      <span className="atm-cloud" style={{ top: "18%", animationDuration: "45s" }} />
      <span className="atm-cloud" style={{ top: "32%", animationDuration: "65s", animationDelay: "-22s", opacity: 0.6 }} />
    </div>
  );
}
