/**
 * Open-Meteo client — keyless, free, CORS-open.
 * Docs: https://open-meteo.com/en/docs
 */

export type WeatherTone = "clear" | "cloud" | "rain" | "drizzle" | "snow" | "fog" | "storm";

export interface WeatherCodeInfo {
  label: string;
  tone: WeatherTone;
}

export function describeCode(code: number, isDay = true): WeatherCodeInfo {
  // WMO weather interpretation codes
  if (code === 0) return { label: isDay ? "clear" : "clear night", tone: "clear" };
  if (code === 1) return { label: "mostly clear", tone: "clear" };
  if (code === 2) return { label: "partly cloudy", tone: "cloud" };
  if (code === 3) return { label: "overcast", tone: "cloud" };
  if (code === 45 || code === 48) return { label: "fog", tone: "fog" };
  if (code >= 51 && code <= 57) return { label: "drizzle", tone: "drizzle" };
  if (code >= 61 && code <= 67) return { label: "rain", tone: "rain" };
  if (code >= 71 && code <= 77) return { label: "snow", tone: "snow" };
  if (code >= 80 && code <= 82) return { label: "rain showers", tone: "rain" };
  if (code >= 85 && code <= 86) return { label: "snow showers", tone: "snow" };
  if (code >= 95) return { label: "thunderstorm", tone: "storm" };
  return { label: "—", tone: "cloud" };
}

export interface CurrentWeather {
  tempF: number;
  apparentF: number;
  windMph: number;
  precipMm: number;
  code: number;
  isDay: boolean;
  label: string;
  tone: WeatherTone;
  capturedAt: string;
}

export interface HourPoint {
  iso: string;       // ISO timestamp for that hour
  tempF: number;
  precipProb: number; // 0–100
  precipMm: number;
  windMph: number;
  code: number;
  label: string;
  tone: WeatherTone;
}

export interface MinuteRainPoint {
  iso: string;
  precipMm: number;
}

const cache = new Map<string, { at: number; data: unknown }>();
const TTL_MS = 10 * 60 * 1000;

function keyOf(lat: number, lng: number, kind: string) {
  return `${kind}:${lat.toFixed(2)},${lng.toFixed(2)}`;
}

async function getJson<T>(url: string, k: string): Promise<T | null> {
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    cache.set(k, { at: Date.now(), data });
    return data;
  } catch {
    return null;
  }
}

export async function getNow(lat: number, lng: number): Promise<CurrentWeather | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,apparent_temperature,wind_speed_10m,precipitation,weather_code,is_day` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=mm&timezone=auto`;
  const data = await getJson<{ current?: Record<string, number | string> }>(url, keyOf(lat, lng, "now"));
  const c = data?.current;
  if (!c) return null;
  const code = Number(c.weather_code ?? 0);
  const isDay = Number(c.is_day ?? 1) === 1;
  const info = describeCode(code, isDay);
  return {
    tempF: Math.round(Number(c.temperature_2m ?? 0)),
    apparentF: Math.round(Number(c.apparent_temperature ?? c.temperature_2m ?? 0)),
    windMph: Math.round(Number(c.wind_speed_10m ?? 0)),
    precipMm: Number(c.precipitation ?? 0),
    code,
    isDay,
    label: info.label,
    tone: info.tone,
    capturedAt: new Date().toISOString(),
  };
}

export async function getHourly(lat: number, lng: number, hoursAhead = 12): Promise<HourPoint[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,weather_code` +
    `&forecast_days=2&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=mm&timezone=auto`;
  const data = await getJson<{ hourly?: { time: string[]; temperature_2m: number[]; precipitation_probability: number[]; precipitation: number[]; wind_speed_10m: number[]; weather_code: number[] } }>(url, keyOf(lat, lng, "hourly"));
  const h = data?.hourly;
  if (!h?.time?.length) return [];
  const now = Date.now();
  const out: HourPoint[] = [];
  for (let i = 0; i < h.time.length && out.length < hoursAhead; i++) {
    const t = new Date(h.time[i]).getTime();
    if (t < now - 30 * 60 * 1000) continue;
    const code = h.weather_code[i] ?? 0;
    const info = describeCode(code, true);
    out.push({
      iso: h.time[i],
      tempF: Math.round(h.temperature_2m[i] ?? 0),
      precipProb: Math.round(h.precipitation_probability?.[i] ?? 0),
      precipMm: h.precipitation?.[i] ?? 0,
      windMph: Math.round(h.wind_speed_10m?.[i] ?? 0),
      code,
      label: info.label,
      tone: info.tone,
    });
  }
  return out;
}

/** Find the forecast hour closest to a target ISO timestamp. */
export async function getForecastAt(lat: number, lng: number, targetIso: string): Promise<HourPoint | null> {
  const hours = await getHourly(lat, lng, 24 * 16);
  if (!hours.length) return null;
  const target = new Date(targetIso).getTime();
  let best: HourPoint | null = null;
  let bestDist = Infinity;
  for (const h of hours) {
    const d = Math.abs(new Date(h.iso).getTime() - target);
    if (d < bestDist) { bestDist = d; best = h; }
  }
  return best;
}

/** 15-min precipitation outlook for the next ~3h. */
export async function getMinutelyRain(lat: number, lng: number): Promise<MinuteRainPoint[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&minutely_15=precipitation&forecast_minutely_15=12&precipitation_unit=mm&timezone=auto`;
  const data = await getJson<{ minutely_15?: { time: string[]; precipitation: number[] } }>(url, keyOf(lat, lng, "min15"));
  const m = data?.minutely_15;
  if (!m?.time?.length) return [];
  const now = Date.now();
  const out: MinuteRainPoint[] = [];
  for (let i = 0; i < m.time.length; i++) {
    const t = new Date(m.time[i]).getTime();
    if (t < now) continue;
    out.push({ iso: m.time[i], precipMm: m.precipitation?.[i] ?? 0 });
  }
  return out;
}

/** When (in minutes from now) precipitation is first expected; null if dry within window. */
export function nextRainMinutes(points: MinuteRainPoint[], thresholdMm = 0.2): number | null {
  const now = Date.now();
  for (const p of points) {
    if (p.precipMm >= thresholdMm) {
      return Math.max(0, Math.round((new Date(p.iso).getTime() - now) / 60000));
    }
  }
  return null;
}
