/**
 * Geometry helpers for walk routes.
 * `points` is the rolling array of {lat,lng,t} captured by watchPosition.
 */
export interface RoutePoint { lat: number; lng: number; t?: number }

/** Privacy-preserving trim: drop the first/last `meters` of the route so home
 *  and destination aren't exposed in shared snapshots. Mirrors Strava's
 *  Privacy Zones default. */
export function trimEndpoints(points: RoutePoint[], meters = 150): RoutePoint[] {
  if (points.length < 4) return points;
  const acc: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    acc[i] = acc[i - 1] + haversine(points[i - 1], points[i]);
  }
  const total = acc[acc.length - 1];
  if (total < meters * 2.5) return points; // walk too short to crop safely
  let start = 0, end = points.length - 1;
  while (start < points.length && acc[start] < meters) start++;
  while (end > 0 && total - acc[end] < meters) end--;
  if (end - start < 2) return points;
  return points.slice(start, end + 1);
}

/** Coarsen coordinates by ~50–100m (≈ 3 decimals) so live pings reveal a
 *  neighborhood, not a doorstep. */
export function fuzzCoord(lat: number, lng: number, jitterMeters = 60) {
  // 1 degree ≈ 111_320m at the equator. For lng, scale by cos(lat).
  const dLat = (jitterMeters * (Math.random() - 0.5)) / 111_320;
  const dLng = (jitterMeters * (Math.random() - 0.5)) / (111_320 * Math.cos((lat * Math.PI) / 180) || 1);
  return { lat: +(lat + dLat).toFixed(5), lng: +(lng + dLng).toFixed(5) };
}

export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function bounds(points: RoutePoint[]): [[number, number], [number, number]] | null {
  if (!points.length) return null;
  let minLat = points[0].lat, maxLat = points[0].lat, minLng = points[0].lng, maxLng = points[0].lng;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat; if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng; if (p.lng > maxLng) maxLng = p.lng;
  }
  return [[minLng, minLat], [maxLng, maxLat]];
}

export function lineString(points: RoutePoint[]) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates: points.map((p) => [p.lng, p.lat]) },
  };
}
