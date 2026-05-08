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

/** Coarse IP-based geolocation fallback (keyless). */
async function fetchIpCoords(): Promise<Coords | null> {
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) return null;
    const j = await res.json();
    if (typeof j?.latitude === "number" && typeof j?.longitude === "number") {
      return { lat: j.latitude, lng: j.longitude };
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Best-effort geolocation with graceful fallback chain:
 *   cached → (optional) browser geolocation → IP-based coarse coords.
 * The IP fallback runs by default so the homepage weather pill has
 * something to show on first login without a permission prompt.
 */
export function useGeolocation(opts: { autoRequest?: boolean; ipFallback?: boolean } = {}) {
  const { autoRequest = false, ipFallback = true } = opts;
  const [coords, setCoords] = useState<Coords | null>(() => getCachedCoords());
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (coords) return;
    let cancelled = false;
    const tryBrowser = () => new Promise<Coords | null>((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { maximumAge: 10 * 60 * 1000, timeout: 8000 }
      );
    });
    (async () => {
      let next: Coords | null = null;
      if (autoRequest) next = await tryBrowser();
      if (!next && ipFallback) next = await fetchIpCoords();
      if (!cancelled && next) { setCoords(next); setCachedCoords(next); }
    })();
    return () => { cancelled = true; };
  }, [coords, autoRequest, ipFallback]);

  const requestPrecise = async () => {
    setRequesting(true);
    try {
      const next = await new Promise<Coords | null>((resolve) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(null),
          { maximumAge: 0, timeout: 10000 }
        );
      });
      if (next) { setCoords(next); setCachedCoords(next); }
    } finally { setRequesting(false); }
  };

  // Backwards-compat: callers that did `const coords = useGeolocation(...)`
  // still receive a Coords | null thanks to the valueOf/toJSON proxy below.
  return Object.assign(coords as Coords | null, { coords, requestPrecise, requesting }) as
    (Coords | null) & { coords: Coords | null; requestPrecise: () => Promise<void>; requesting: boolean };
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
