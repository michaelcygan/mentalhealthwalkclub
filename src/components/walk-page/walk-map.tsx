import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Inline SVG pin — handrawn-ish, themed via currentColor
const PinIcon = L.divIcon({
  className: "walk-pin",
  iconSize: [36, 44],
  iconAnchor: [18, 42],
  html: `
    <svg viewBox="0 0 36 44" width="36" height="44" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="s" x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-opacity="0.28"/>
        </filter>
      </defs>
      <path filter="url(#s)" d="M18 2 C9 2 3 8.6 3 16.4 C3 26 11.2 33 17 41 C17.6 41.8 18.4 41.8 19 41 C24.8 33 33 26 33 16.4 C33 8.6 27 2 18 2 Z"
        fill="#2f5d3a" stroke="#1f3d27" stroke-width="1.2"/>
      <circle cx="18" cy="16.4" r="5.2" fill="#fdf6e3" stroke="#1f3d27" stroke-width="1.1"/>
    </svg>
  `,
});

interface Props {
  lat: number;
  lng: number;
  title: string;
  venue?: string | null;
}

export default function WalkMap({ lat, lng, title, venue }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-72 w-full animate-pulse rounded-2xl bg-muted" />;

  return (
    <div className="overflow-hidden rounded-3xl border border-border shadow-soft">
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        scrollWheelZoom={false}
        style={{ height: 320, width: "100%" }}
        attributionControl
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains={["a", "b", "c", "d"]}
          maxZoom={19}
        />
        <Marker position={[lat, lng]} icon={PinIcon}>
          <Popup>
            <div className="font-serif text-base">{title}</div>
            {venue ? <div className="text-xs text-muted-foreground">{venue}</div> : null}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
