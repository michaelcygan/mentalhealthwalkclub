/**
 * Visitor area selection for the public walk utility.
 *
 * Precedence (resolved by the board, not here):
 *   1. NFC portal location
 *   2. campaign URL (?city= / ?lat=&lng=)
 *   3. this saved local choice
 *   4. coarse edge-provided city
 *   5. general upcoming walks
 *
 * We never persist precise GPS to analytics; this value is local to the
 * visitor's browser and only used to filter the board.
 */
export interface PublicArea {
  label: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  radiusMiles: number;
  /** Where the area came from — used for copy, not for tracking. */
  source: "portal" | "campaign" | "saved" | "device" | "edge";
}

const KEY = "mhwc.public.area.v1";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function loadSavedArea(): PublicArea | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; area?: PublicArea };
    if (!parsed?.area || !parsed.savedAt) return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return { ...parsed.area, source: "saved" };
  } catch {
    return null;
  }
}

export function saveArea(area: PublicArea) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), area }));
  } catch {
    /* storage unavailable — the board still works for this visit */
  }
}

export function clearSavedArea() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Reads a campaign-supplied area from the current URL search params. */
export function areaFromSearch(search: Record<string, unknown>): PublicArea | null {
  const city = typeof search.city === "string" ? search.city.trim() : "";
  const lat = Number(search.lat);
  const lng = Number(search.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  if (!city && !hasCoords) return null;
  return {
    label: city || "Selected area",
    city: city || null,
    lat: hasCoords ? lat : null,
    lng: hasCoords ? lng : null,
    radiusMiles: 25,
    source: "campaign",
  };
}
