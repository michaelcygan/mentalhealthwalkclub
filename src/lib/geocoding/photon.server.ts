/**
 * Photon (OpenStreetMap) forward-geocoding client.
 * Server-only. Never call from the browser.
 *
 * Photon: https://photon.komoot.io — free, based on OSM data.
 */

const DEFAULT_BASE = "https://photon.komoot.io";
const TIMEOUT_MS = 5_000;

export type PhotonProperties = {
  osm_type?: "N" | "W" | "R";
  osm_id?: number | string;
  osm_key?: string;
  osm_value?: string;
  name?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
  district?: string;
  county?: string;
  state?: string;
  country?: string;
  countrycode?: string;
  type?: string;
};

export type PhotonFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: PhotonProperties;
};

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithOneRetry(url: string): Promise<Response> {
  try {
    return await fetchWithTimeout(url, TIMEOUT_MS);
  } catch {
    // one controlled retry for transient network error
    return await fetchWithTimeout(url, TIMEOUT_MS);
  }
}

export async function photonSearch(params: {
  query: string;
  lat?: number | null;
  lng?: number | null;
  limit?: number;
}): Promise<PhotonFeature[]> {
  const base = process.env.PHOTON_BASE_URL || DEFAULT_BASE;
  const url = new URL("/api", base);
  const qs = new URLSearchParams();
  qs.set("q", params.query);
  qs.set("limit", String(Math.min(Math.max(params.limit ?? 8, 1), 10)));
  qs.set("lang", "en");
  if (params.lat != null && params.lng != null && Number.isFinite(params.lat) && Number.isFinite(params.lng)) {
    qs.set("lat", String(params.lat));
    qs.set("lon", String(params.lng));
  }
  url.search = qs.toString();

  const res = await fetchWithOneRetry(url.toString());
  if (!res.ok) {
    console.warn("photon search non-ok", res.status);
    return [];
  }
  const json = (await res.json()) as { features?: PhotonFeature[] };
  return Array.isArray(json.features) ? json.features : [];
}

/* ---------- normalization helpers ---------- */

function osmTypeLong(t: PhotonProperties["osm_type"]): "node" | "way" | "relation" | null {
  if (t === "N") return "node";
  if (t === "W") return "way";
  if (t === "R") return "relation";
  return null;
}

export function providerPlaceIdFromFeature(f: PhotonFeature): string | null {
  const t = osmTypeLong(f.properties.osm_type);
  const id = f.properties.osm_id;
  if (!t || id == null) return null;
  return `${t}:${id}`;
}

export function buildAddress(p: PhotonProperties): string | null {
  const parts: string[] = [];
  const streetLine = [p.housenumber, p.street].filter(Boolean).join(" ").trim();
  if (streetLine) parts.push(streetLine);
  // avoid duplicating name when it matches city/district
  const locale = [p.district, p.city, p.county, p.state].filter(Boolean) as string[];
  const seen = new Set<string>();
  for (const x of locale) {
    const norm = x.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    parts.push(x);
  }
  if (p.postcode) parts.push(p.postcode);
  if (p.country) parts.push(p.country);
  const addr = parts.join(", ");
  return addr.length ? addr : null;
}

export function categoryFromFeature(p: PhotonProperties): string | null {
  const key = (p.osm_key ?? "").toLowerCase();
  const val = (p.osm_value ?? "").toLowerCase();
  const type = (p.type ?? "").toLowerCase();
  if (val === "park" || val === "national_park" || val === "nature_reserve") return "park";
  if (val === "beach") return "beach";
  if (key === "highway" && (val === "path" || val === "footway" || val === "cycleway")) return "trail";
  if (val === "trailhead" || val === "hiking") return "trail";
  if (val === "cafe" || val === "coffee_shop") return "cafe";
  if (type === "city" || val === "city" || val === "town") return "city";
  if (type === "neighbourhood" || val === "neighbourhood" || val === "suburb" || val === "quarter") return "neighborhood";
  if (type === "locality") return "city";
  return null;
}

export function displayName(p: PhotonProperties): string {
  return p.name?.trim() || p.city || p.state || p.country || "Unnamed place";
}
