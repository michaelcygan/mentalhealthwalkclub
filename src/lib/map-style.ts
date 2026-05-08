/**
 * Free, no-token raster basemap built on CARTO Positron tiles (over OSM data).
 * Two flavors: `light` for in-app surfaces, `mono` for snapshots/share cards.
 * MapLibre handles HiDPI via the @2x suffix.
 */
import type { StyleSpecification } from "maplibre-gl";

const ATTRIB = '© <a href="https://www.openstreetmap.org/copyright">OSM</a> · © <a href="https://carto.com/attributions">CARTO</a>';

function rasterStyle(prefix: "light_all" | "light_nolabels" | "rastertiles/voyager"): StyleSpecification {
  return {
    version: 8,
    sources: {
      base: {
        type: "raster",
        tiles: [
          `https://a.basemaps.cartocdn.com/${prefix}/{z}/{x}/{y}@2x.png`,
          `https://b.basemaps.cartocdn.com/${prefix}/{z}/{x}/{y}@2x.png`,
          `https://c.basemaps.cartocdn.com/${prefix}/{z}/{x}/{y}@2x.png`,
        ],
        tileSize: 256,
        attribution: ATTRIB,
      },
    },
    layers: [{ id: "base", type: "raster", source: "base" }],
  };
}

export const mapStyles = {
  light: () => rasterStyle("light_all"),
  mono: () => rasterStyle("light_nolabels"),
  warm: () => rasterStyle("rastertiles/voyager"),
};
