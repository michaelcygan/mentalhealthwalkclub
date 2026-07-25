import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  deriveConditionCode,
  roundCoord,
  type WalkWeatherPeriod,
} from "@/lib/walk-weather-match";

export type WalkWeatherResponse =
  | {
      status: "ok";
      provider: "nws";
      timeZone: string | null;
      generatedAt: string | null;
      periods: WalkWeatherPeriod[];
    }
  | { status: "unsupported"; provider: "nws"; periods: [] }
  | { status: "unavailable"; provider: "nws"; periods: [] };

const UA = "MentalHealthWalkClub/1.0 (+https://mentalhealthwalkclub.com)";
const REQUEST_TIMEOUT_MS = 4500;

// -------- bounded TTL cache --------
type CacheEntry<T> = { value: T; expires: number };
const MAX_ENTRIES = 200;

function cacheGet<T>(m: Map<string, CacheEntry<T>>, key: string): T | null {
  const e = m.get(key);
  if (!e) return null;
  if (e.expires < Date.now()) {
    m.delete(key);
    return null;
  }
  return e.value;
}

function cacheSet<T>(m: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number): void {
  m.set(key, { value, expires: Date.now() + ttlMs });
  if (m.size > MAX_ENTRIES) {
    // Drop oldest inserted (Map preserves insertion order).
    const firstKey = m.keys().next().value;
    if (firstKey !== undefined) m.delete(firstKey);
  }
}

type PointInfo = { forecastHourly: string; timeZone: string | null };

const pointCache = new Map<string, CacheEntry<PointInfo | "unsupported">>();
const hourlyCache = new Map<string, CacheEntry<WalkWeatherResponse>>();
const inFlight = new Map<string, Promise<WalkWeatherResponse>>();

// -------- fetch helpers --------
async function fetchJson(url: string): Promise<{ ok: boolean; status: number; json: any }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/geo+json", "User-Agent": UA },
      signal: ctrl.signal,
    });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // leave json null
    }
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(t);
  }
}

function isValidForecastUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (u.hostname !== "api.weather.gov") return false;
    if (!u.pathname.includes("/forecast")) return false;
    return true;
  } catch {
    return false;
  }
}

async function resolvePoint(lat: number, lng: number): Promise<PointInfo | "unsupported"> {
  const key = `${lat},${lng}`;
  const cached = cacheGet(pointCache, key);
  if (cached) return cached;

  try {
    const { ok, status, json } = await fetchJson(`https://api.weather.gov/points/${lat},${lng}`);
    if (!ok) {
      if (status === 404) {
        cacheSet(pointCache, key, "unsupported", 24 * 60 * 60_000);
        return "unsupported";
      }
      return "unsupported";
    }
    const fh = json?.properties?.forecastHourly;
    if (!isValidForecastUrl(fh)) {
      cacheSet(pointCache, key, "unsupported", 24 * 60 * 60_000);
      return "unsupported";
    }
    const info: PointInfo = {
      forecastHourly: fh,
      timeZone: typeof json?.properties?.timeZone === "string" ? json.properties.timeZone : null,
    };
    cacheSet(pointCache, key, info, 24 * 60 * 60_000);
    return info;
  } catch (err) {
    // network / timeout — do not cache as unsupported
    console.warn("[walk-weather] point lookup failed", (err as Error)?.message);
    throw err;
  }
}

function normalizePeriods(raw: any): WalkWeatherPeriod[] {
  const periods = Array.isArray(raw?.properties?.periods) ? raw.properties.periods : [];
  const out: WalkWeatherPeriod[] = [];
  for (const p of periods) {
    if (!p || typeof p.startTime !== "string") continue;
    const tempN = typeof p.temperature === "number" ? Math.round(p.temperature) : NaN;
    if (!Number.isFinite(tempN)) continue;
    const unit = p.temperatureUnit === "C" ? "C" : "F";
    let pop: number | null = null;
    const popRaw = p?.probabilityOfPrecipitation?.value;
    if (typeof popRaw === "number" && Number.isFinite(popRaw)) {
      pop = Math.max(0, Math.min(100, Math.round(popRaw)));
    }
    const shortForecast = typeof p.shortForecast === "string" ? p.shortForecast : "";
    const isDaytime = Boolean(p.isDaytime);
    out.push({
      startTime: p.startTime,
      endTime: typeof p.endTime === "string" ? p.endTime : null,
      temperature: tempN,
      temperatureUnit: unit,
      precipitationChance: pop,
      shortForecast,
      isDaytime,
      conditionCode: deriveConditionCode(shortForecast, isDaytime),
    });
  }
  return out;
}

async function fetchHourly(info: PointInfo): Promise<WalkWeatherResponse> {
  const cached = cacheGet(hourlyCache, info.forecastHourly);
  if (cached) return cached;

  const existing = inFlight.get(info.forecastHourly);
  if (existing) return existing;

  const promise = (async (): Promise<WalkWeatherResponse> => {
    try {
      const { ok, status, json } = await fetchJson(info.forecastHourly);
      if (!ok || !json) {
        if (status === 404) {
          const unsupported: WalkWeatherResponse = { status: "unsupported", provider: "nws", periods: [] };
          return unsupported;
        }
        return { status: "unavailable", provider: "nws", periods: [] };
      }
      const periods = normalizePeriods(json);
      if (periods.length === 0) {
        return { status: "unavailable", provider: "nws", periods: [] };
      }
      const generatedAt =
        typeof json?.properties?.generatedAt === "string" ? json.properties.generatedAt : null;
      const ok_response: WalkWeatherResponse = {
        status: "ok",
        provider: "nws",
        timeZone: info.timeZone,
        generatedAt,
        periods,
      };
      cacheSet(hourlyCache, info.forecastHourly, ok_response, 12 * 60_000);
      return ok_response;
    } catch (err) {
      console.warn("[walk-weather] hourly fetch failed", (err as Error)?.message);
      return { status: "unavailable", provider: "nws", periods: [] };
    } finally {
      inFlight.delete(info.forecastHourly);
    }
  })();

  inFlight.set(info.forecastHourly, promise);
  return promise;
}

const WalkWeatherInput = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const getWalkWeather = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => WalkWeatherInput.parse(data))
  .handler(async ({ data }): Promise<WalkWeatherResponse> => {
    const lat = roundCoord(data.lat);
    const lng = roundCoord(data.lng);
    try {
      const point = await resolvePoint(lat, lng);
      if (point === "unsupported") {
        return { status: "unsupported", provider: "nws", periods: [] };
      }
      return await fetchHourly(point);
    } catch {
      return { status: "unavailable", provider: "nws", periods: [] };
    }
  });
