import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "@tanstack/react-router";
import type { PublicBoardWalk } from "@/lib/public-utility.functions";

const PinIcon = L.divIcon({
  className: "walk-pin",
  iconSize: [30, 38],
  iconAnchor: [15, 36],
  html: `
    <svg viewBox="0 0 36 44" width="30" height="38" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 2 C9 2 3 8.6 3 16.4 C3 26 11.2 33 17 41 C17.6 41.8 18.4 41.8 19 41 C24.8 33 33 26 33 16.4 C33 8.6 27 2 18 2 Z"
        fill="#2f5d3a" stroke="#1f3d27" stroke-width="1.2"/>
      <circle cx="18" cy="16.4" r="5.2" fill="#fdf6e3" stroke="#1f3d27" stroke-width="1.1"/>
    </svg>
  `,
});

interface Props {
  walks: PublicBoardWalk[];
  center: { lat: number; lng: number } | null;
}

/**
 * Multi-marker board map. Shows exactly the walks the list is showing.
 * OpenStreetMap data via CARTO raster tiles — no paid token.
 */
export default function BoardMap({ walks, center }: Props) {
  const pins = walks.filter((w) => w.lat != null && w.lng != null);
  const first = pins[0];
  const c =
    center ??
    (first
      ? { lat: first.lat as number, lng: first.lng as number }
      : { lat: 41.8781, lng: -87.6298 });

  return (
    <div className="overflow-hidden rounded-3xl border border-border shadow-soft">
      <MapContainer
        center={[c.lat, c.lng]}
        zoom={pins.length > 1 ? 11 : 13}
        scrollWheelZoom={false}
        style={{ height: 420, width: "100%" }}
        attributionControl
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains={["a", "b", "c", "d"]}
          maxZoom={19}
        />
        {pins.map((w) => (
          <Marker key={w.id} position={[w.lat as number, w.lng as number]} icon={PinIcon}>
            <Popup>
              <div className="font-serif text-sm">{w.title}</div>
              {w.venue_name && <div className="text-xs text-muted-foreground">{w.venue_name}</div>}
              <Link to="/w/$code" params={{ code: w.slug }} className="text-xs underline">
                Open walk
              </Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
