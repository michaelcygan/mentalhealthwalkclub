/**
 * Tiny non-interactive map for location previews (event pages, etc.).
 * Lazy-loaded so MapLibre stays out of non-map bundles.
 */
import { useEffect, useRef } from "react";
import maplibregl, { Map as MapLib } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { mapStyles } from "@/lib/map-style";

interface Props { lat: number; lng: number; zoom?: number; className?: string; label?: string }

export default function StaticLocationMap({ lat, lng, zoom = 14, className = "", label }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapLib | null>(null);

  useEffect(() => {
    if (!ref.current || map.current) return;
    const m = new maplibregl.Map({
      container: ref.current,
      style: mapStyles.light(),
      center: [lng, lat],
      zoom,
      interactive: false,
      attributionControl: { compact: true },
    });
    map.current = m;
    m.once("load", () => {
      const el = document.createElement("div");
      el.className = "h-4 w-4 rounded-full border-2 border-white bg-[hsl(var(--clay))] shadow-soft";
      new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(m);
    });
    return () => { m.remove(); map.current = null; };
  }, [lat, lng, zoom]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border bg-secondary/30 ${className}`}>
      <div ref={ref} className="h-full w-full" aria-label={label ?? "Location map"} />
    </div>
  );
}
