import { useEffect, useState } from "react";
import { getNow, getHourly, getMinutelyRain, getForecastAt, type CurrentWeather, type HourPoint, type MinuteRainPoint } from "@/lib/weather";

const COORDS_KEY = "mhwc.coords.v1";

export interface Coords { lat: number; lng: number }

/** Read cached coords from localStorage; safe on SSR. */
export function getCachedCoords(): Coords | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.lat === "number" && typeof v?.lng === "number") return v;
  } catch { /* ignore */ }
  return null;
}

export function setCachedCoords(c: Coords) {
  try { window.localStorage.setItem(COORDS_KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

/**
 * Best-effort browser geolocation. Returns null if unavailable or the user
 * has not yet granted permission — never prompts proactively beyond what
 * the browser does. Cached for the session.
 */
export function useGeolocation(opts: { autoRequest?: boolean } = {}) {
  const [coords, setCoords] = useState<Coords | null>(() => getCachedCoords());
  useEffect(() => {
    if (coords || !opts.autoRequest) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c); setCachedCoords(c);
      },
      () => { /* silent */ },
      { maximumAge: 10 * 60 * 1000, timeout: 8000 }
    );
  }, [coords, opts.autoRequest]);
  return coords;
}

export function useCurrentWeather(coords: Coords | null) {
  const [data, setData] = useState<CurrentWeather | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    setLoading(true);
    getNow(coords.lat, coords.lng).then((w) => { if (!cancelled) { setData(w); setLoading(false); } });
    return () => { cancelled = true; };
  }, [coords?.lat, coords?.lng]);
  return { data, loading };
}

export function useHourlyForecast(coords: Coords | null, hoursAhead = 6) {
  const [data, setData] = useState<HourPoint[]>([]);
  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    getHourly(coords.lat, coords.lng, hoursAhead).then((h) => { if (!cancelled) setData(h); });
    return () => { cancelled = true; };
  }, [coords?.lat, coords?.lng, hoursAhead]);
  return data;
}

export function useForecastAt(coords: Coords | null, targetIso: string | null) {
  const [data, setData] = useState<HourPoint | null>(null);
  useEffect(() => {
    if (!coords || !targetIso) { setData(null); return; }
    let cancelled = false;
    getForecastAt(coords.lat, coords.lng, targetIso).then((h) => { if (!cancelled) setData(h); });
    return () => { cancelled = true; };
  }, [coords?.lat, coords?.lng, targetIso]);
  return data;
}

/** Polls minutely_15 every `intervalMs` while enabled. */
export function useMinutelyRain(coords: Coords | null, enabled: boolean, intervalMs = 5 * 60 * 1000) {
  const [data, setData] = useState<MinuteRainPoint[]>([]);
  useEffect(() => {
    if (!enabled || !coords) return;
    let cancelled = false;
    const tick = () => {
      getMinutelyRain(coords.lat, coords.lng).then((p) => { if (!cancelled) setData(p); });
    };
    tick();
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      tick();
    }, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [coords?.lat, coords?.lng, enabled, intervalMs]);
  return data;
}
