/**
 * Off-screen MapLibre snapshot helper.
 * Renders a square map centered on a route polyline and returns a PNG Blob.
 * Used at end-of-walk to bake a journal/share-card image, and at idle for
 * tiny event/profile previews.
 */
import maplibregl from "maplibre-gl";
import { mapStyles } from "@/lib/map-style";
import { bounds, lineString, trimEndpoints, type RoutePoint } from "@/lib/walk-route-utils";

export interface SnapshotOpts { width?: number; height?: number; padding?: number; trim?: boolean }

export async function renderRouteSnapshot(points: RoutePoint[], opts: SnapshotOpts = {}): Promise<Blob | null> {
  const W = opts.width ?? 1080;
  const H = opts.height ?? 1080;
  const pad = opts.padding ?? 90;
  const safe = opts.trim === false ? points : trimEndpoints(points, 150);
  if (safe.length < 2) return null;

  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-99999px";
  host.style.top = "0";
  host.style.width = `${W}px`;
  host.style.height = `${H}px`;
  document.body.appendChild(host);

  const m = new maplibregl.Map({
    container: host,
    style: mapStyles.mono(),
    center: [safe[0].lng, safe[0].lat],
    zoom: 14,
    interactive: false,
    attributionControl: false,
    preserveDrawingBuffer: true,
    fadeDuration: 0,
  });

  try {
    await new Promise<void>((res) => m.once("load", () => res()));
    m.addSource("r", { type: "geojson", data: lineString(safe) });
    m.addLayer({ id: "r-glow", type: "line", source: "r",
      paint: { "line-color": "#1f3a2c", "line-width": 18, "line-opacity": 0.18, "line-blur": 6 },
      layout: { "line-cap": "round", "line-join": "round" } });
    m.addLayer({ id: "r-line", type: "line", source: "r",
      paint: { "line-color": "#1f3a2c", "line-width": 7 },
      layout: { "line-cap": "round", "line-join": "round" } });

    const b = bounds(safe);
    if (b) m.fitBounds(b as [[number, number], [number, number]], { padding: pad, duration: 0, animate: false });

    // Wait until tiles + polyline are actually painted
    await new Promise<void>((res) => {
      const done = () => { m.off("idle", done); res(); };
      m.on("idle", done);
      setTimeout(done, 4000); // safety
    });

    const blob: Blob | null = await new Promise((res) => m.getCanvas().toBlob((b) => res(b), "image/png", 0.92));
    return blob;
  } finally {
    m.remove();
    host.remove();
  }
}
