/**
 * Live map for the active walk. Renders MapLibre with the user's growing
 * polyline and a pulse for current position. Designed to be lazy-imported
 * so MapLibre never lands in non-walk bundles.
 *
 * Privacy:
 *  - Map render is local-only by default.
 *  - When `shareToGroup` is true, we upsert ~every 15s to walk_live_pings
 *    with a fuzzed coord so a group page can show the walker on its map.
 */
import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MapLib } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { mapStyles } from "@/lib/map-style";
import { bounds, fuzzCoord, haversine, lineString, type RoutePoint } from "@/lib/walk-route-utils";
import { supabase } from "@/integrations/supabase/client";
import { Crosshair, Maximize2, Minimize2 } from "lucide-react";

interface Props {
  points: RoutePoint[];
  walkSessionId: string;
  userId: string | null;
  groupId?: string | null;
  shareToGroup?: boolean;
  /** Initial center if there are no points yet (avoids the NYC fallback). */
  center?: { lat: number; lng: number } | null;
  className?: string;
}

const PING_MS = 15_000;
const PING_MIN_M = 10;

export default function WalkLiveMap({ points, walkSessionId, userId, groupId, shareToGroup, center, className = "" }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapLib | null>(null);
  const [follow, setFollow] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const lastPing = useRef<{ lat: number; lng: number; at: number } | null>(null);

  // Init map once
  useEffect(() => {
    if (!ref.current || map.current) return;
    const m = new maplibregl.Map({
      container: ref.current,
      style: mapStyles.warm(),
      center: points[0] ? [points[0].lng, points[0].lat] : [-74.006, 40.7128],
      zoom: 16,
      attributionControl: { compact: true },
      cooperativeGestures: false,
      pitchWithRotate: false,
      dragRotate: false,
    });
    m.on("load", () => {
      m.addSource("route", { type: "geojson", data: lineString(points) });
      m.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        paint: { "line-color": "#1f3a2c", "line-width": 12, "line-opacity": 0.22, "line-blur": 6 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      m.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: { "line-color": "#1f3a2c", "line-width": 5 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      // Force a resize once the style is ready — fixes a blank canvas when
      // the lazy chunk + CSS arrive after the container is laid out.
      requestAnimationFrame(() => m.resize());
    });
    map.current = m;
    // Belt-and-braces: a few delayed resizes catch the case where the
    // container's height is settled by parent transitions or the lazy CSS.
    const t1 = setTimeout(() => m.resize(), 60);
    const t2 = setTimeout(() => m.resize(), 300);
    const t3 = setTimeout(() => m.resize(), 900);
    // Resize whenever the container itself changes size (expand/collapse,
    // tab show/hide, keyboard inset, etc.).
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(ref.current);
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      ro.disconnect();
      m.remove(); map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update polyline + dot as points come in
  useEffect(() => {
    const m = map.current;
    if (!m || !points.length) return;
    const apply = () => {
      const src = m.getSource("route") as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      src.setData(lineString(points) as never);
      const last = points[points.length - 1];
      if (follow) m.easeTo({ center: [last.lng, last.lat], duration: 600 });
    };
    if (m.isStyleLoaded()) apply(); else m.once("load", apply);
  }, [points, follow]);

  // Current position pulse marker (always tracks the latest fix)
  useEffect(() => {
    const m = map.current;
    if (!m || !points.length) return;
    const last = points[points.length - 1];
    let marker = (map.current as unknown as { __dot?: maplibregl.Marker }).__dot;
    if (!marker) {
      const el = document.createElement("div");
      el.className = "walk-live-dot";
      marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([last.lng, last.lat]).addTo(m);
      (map.current as unknown as { __dot?: maplibregl.Marker }).__dot = marker;
    } else {
      marker.setLngLat([last.lng, last.lat]);
    }
  }, [points]);

  // Resize on expand
  useEffect(() => { setTimeout(() => map.current?.resize(), 220); }, [expanded]);

  // Pause render work when tab hidden
  useEffect(() => {
    const onVis = () => {
      const m = map.current; if (!m) return;
      if (document.visibilityState === "hidden") m.stop();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Group ping fan-out
  useEffect(() => {
    if (!shareToGroup || !userId) return;
    const tick = async () => {
      if (!points.length) return;
      const last = points[points.length - 1];
      const now = Date.now();
      if (lastPing.current && now - lastPing.current.at < PING_MS - 500) return;
      if (lastPing.current && haversine(lastPing.current, last) < PING_MIN_M) return;
      const fuzzed = fuzzCoord(last.lat, last.lng, 70);
      try {
        await supabase.from("walk_live_pings").insert({
          walk_session_id: walkSessionId,
          user_id: userId,
          group_id: groupId ?? null,
          lat: fuzzed.lat,
          lng: fuzzed.lng,
        });
        lastPing.current = { lat: last.lat, lng: last.lng, at: now };
      } catch { /* RLS or offline — silent */ }
    };
    tick();
    const id = setInterval(tick, PING_MS);
    return () => clearInterval(id);
  }, [shareToGroup, userId, groupId, walkSessionId, points]);

  const recenter = () => {
    setFollow(true);
    const b = bounds(points);
    if (b && map.current) map.current.fitBounds(b as [[number, number], [number, number]], { padding: 50, maxZoom: 17, duration: 500 });
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border bg-secondary/40 ${expanded ? "fixed inset-3 z-40 h-auto" : "h-56"} ${className}`}>
      <div ref={ref} className="absolute inset-0" />
      {!points.length && (
        <div className="absolute inset-0 grid place-items-center text-center text-xs text-muted-foreground">
          <span>waiting for first GPS fix…</span>
        </div>
      )}
      <div className="pointer-events-none absolute right-2 top-2 flex gap-1.5">
        <button
          type="button"
          onClick={() => { setFollow((f) => !f); }}
          className="pointer-events-auto grid h-8 w-8 place-items-center rounded-full bg-card/90 text-foreground shadow-soft backdrop-blur transition active:scale-95"
          aria-label={follow ? "Stop following" : "Follow me"}
          title={follow ? "Following" : "Tap to follow"}
        >
          <Crosshair className={`h-4 w-4 ${follow ? "text-forest" : "text-muted-foreground"}`} />
        </button>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="pointer-events-auto grid h-8 w-8 place-items-center rounded-full bg-card/90 shadow-soft backdrop-blur transition active:scale-95"
          aria-label={expanded ? "Collapse map" : "Expand map"}
        >
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>
      <button
        type="button"
        onClick={recenter}
        className="absolute bottom-2 right-2 rounded-full bg-card/90 px-3 py-1 text-[11px] font-medium text-foreground shadow-soft backdrop-blur"
      >
        recenter
      </button>
    </div>
  );
}
