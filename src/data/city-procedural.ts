// Procedural cover data for every chapter slug — used when no real photo set exists.
// Each city gets an IANA timezone (so the tile reflects local sky) and a hue (0–360)
// that anchors a bright, optimistic gradient identity.

export interface CityProcedural {
  tz: string;
  hue: number;
}

export const CITY_PROCEDURAL: Record<string, CityProcedural> = {
  // North America — US East
  "chapter-nyc": { tz: "America/New_York", hue: 14 },
  "chapter-nyc-queens": { tz: "America/New_York", hue: 28 },
  "brooklyn-chapter": { tz: "America/New_York", hue: 22 },
  "chapter-boston": { tz: "America/New_York", hue: 200 },
  "chapter-philly": { tz: "America/New_York", hue: 260 },
  "chapter-dc": { tz: "America/New_York", hue: 350 },
  "chapter-dc-nova": { tz: "America/New_York", hue: 340 },
  "chapter-baltimore": { tz: "America/New_York", hue: 18 },
  "chapter-providence": { tz: "America/New_York", hue: 220 },
  "chapter-hartford": { tz: "America/New_York", hue: 130 },
  "chapter-pittsburgh": { tz: "America/New_York", hue: 50 },
  "chapter-buffalo": { tz: "America/New_York", hue: 195 },
  "chapter-richmond": { tz: "America/New_York", hue: 100 },
  "chapter-hampton-roads": { tz: "America/New_York", hue: 185 },
  "chapter-charlotte": { tz: "America/New_York", hue: 280 },
  "chapter-triangle": { tz: "America/New_York", hue: 145 },
  "chapter-atlanta": { tz: "America/New_York", hue: 0 },
  "chapter-jacksonville": { tz: "America/New_York", hue: 175 },
  "chapter-orlando": { tz: "America/New_York", hue: 35 },
  "chapter-tampa-bay": { tz: "America/New_York", hue: 190 },
  "chapter-miami": { tz: "America/New_York", hue: 320 },
  "chapter-detroit": { tz: "America/Detroit", hue: 210 },
  "chapter-cleveland": { tz: "America/New_York", hue: 215 },
  "chapter-columbus": { tz: "America/New_York", hue: 8 },
  "chapter-cincinnati": { tz: "America/New_York", hue: 12 },
  "chapter-louisville": { tz: "America/New_York", hue: 90 },
  "chapter-indy": { tz: "America/Indiana/Indianapolis", hue: 240 },
  // US Central
  "chapter-chicagoland": { tz: "America/Chicago", hue: 205 },
  "chapter-chicagoland-suburbs": { tz: "America/Chicago", hue: 110 },
  "chicago": { tz: "America/Chicago", hue: 205 },
  "chapter-twin-cities": { tz: "America/Chicago", hue: 195 },
  "chapter-milwaukee": { tz: "America/Chicago", hue: 30 },
  "chapter-stl": { tz: "America/Chicago", hue: 38 },
  "chapter-kc": { tz: "America/Chicago", hue: 24 },
  "chapter-okc": { tz: "America/Chicago", hue: 20 },
  "chapter-memphis": { tz: "America/Chicago", hue: 290 },
  "chapter-nashville": { tz: "America/Chicago", hue: 45 },
  "chapter-nola": { tz: "America/Chicago", hue: 295 },
  "chapter-houston": { tz: "America/Chicago", hue: 8 },
  "chapter-dfw": { tz: "America/Chicago", hue: 350 },
  "chapter-austin": { tz: "America/Chicago", hue: 100 },
  "chapter-san-antonio": { tz: "America/Chicago", hue: 16 },
  // US Mountain
  "chapter-denver": { tz: "America/Denver", hue: 25 },
  "chapter-slc": { tz: "America/Denver", hue: 320 },
  "chapter-phoenix": { tz: "America/Phoenix", hue: 18 },
  // US West
  "chapter-la": { tz: "America/Los_Angeles", hue: 330 },
  "la-chapter": { tz: "America/Los_Angeles", hue: 330 },
  "chapter-la-south-bay": { tz: "America/Los_Angeles", hue: 195 },
  "chapter-la-valley": { tz: "America/Los_Angeles", hue: 75 },
  "chapter-inland-empire": { tz: "America/Los_Angeles", hue: 30 },
  "chapter-san-diego": { tz: "America/Los_Angeles", hue: 195 },
  "chapter-bay-area": { tz: "America/Los_Angeles", hue: 350 },
  "chapter-east-bay": { tz: "America/Los_Angeles", hue: 130 },
  "chapter-san-jose": { tz: "America/Los_Angeles", hue: 270 },
  "chapter-sacramento": { tz: "America/Los_Angeles", hue: 95 },
  "chapter-portland": { tz: "America/Los_Angeles", hue: 145 },
  "chapter-seattle": { tz: "America/Los_Angeles", hue: 180 },
  "chapter-vegas": { tz: "America/Los_Angeles", hue: 305 },
  // Canada
  "chapter-toronto": { tz: "America/Toronto", hue: 215 },
  "chapter-montreal": { tz: "America/Montreal", hue: 0 },
  "chapter-vancouver": { tz: "America/Vancouver", hue: 160 },
  // Mexico
  "chapter-cdmx": { tz: "America/Mexico_City", hue: 30 },
  // Europe
  "london-chapter": { tz: "Europe/London", hue: 220 },
  "chapter-manchester": { tz: "Europe/London", hue: 8 },
  "chapter-dublin": { tz: "Europe/Dublin", hue: 140 },
  "chapter-paris": { tz: "Europe/Paris", hue: 350 },
  "chapter-berlin": { tz: "Europe/Berlin", hue: 50 },
  "chapter-amsterdam": { tz: "Europe/Amsterdam", hue: 25 },
  "chapter-madrid": { tz: "Europe/Madrid", hue: 18 },
  "chapter-barcelona": { tz: "Europe/Madrid", hue: 195 },
  // APAC
  "chapter-tokyo": { tz: "Asia/Tokyo", hue: 340 },
  "chapter-singapore": { tz: "Asia/Singapore", hue: 165 },
  "chapter-sydney": { tz: "Australia/Sydney", hue: 200 },
  "chapter-melbourne": { tz: "Australia/Melbourne", hue: 280 },
  "chapter-auckland": { tz: "Pacific/Auckland", hue: 175 },
};

import type { DayState } from "./city-covers";

/**
 * Returns a CSS background string for a procedural city tile.
 * Bright/optimistic palette that shifts with local time-of-day.
 */
export function proceduralBackground(hue: number, state: DayState): string {
  const h = ((hue % 360) + 360) % 360;
  const h2 = (h + 40) % 360;
  switch (state) {
    case "dawn":
      // soft coral → peach → sky
      return `linear-gradient(180deg,
        hsl(${(h + 320) % 360} 75% 78%) 0%,
        hsl(${(h + 350) % 360} 80% 70%) 38%,
        hsl(${(h + 30) % 360} 70% 60%) 70%,
        hsl(${h2} 55% 38%) 100%)`;
    case "day":
      // bright sky → city tint
      return `linear-gradient(180deg,
        hsl(200 85% 78%) 0%,
        hsl(${h} 70% 70%) 55%,
        hsl(${h} 55% 48%) 100%)`;
    case "golden":
      // amber → magenta → indigo
      return `linear-gradient(180deg,
        hsl(36 95% 65%) 0%,
        hsl(${(h + 340) % 360} 80% 55%) 45%,
        hsl(${(h + 280) % 360} 65% 35%) 80%,
        hsl(260 55% 22%) 100%)`;
    case "night":
      // deep navy with tinted city glow at horizon
      return `linear-gradient(180deg,
        hsl(232 55% 14%) 0%,
        hsl(232 45% 18%) 50%,
        hsl(${h} 45% 25%) 82%,
        hsl(${h} 55% 18%) 100%)`;
  }
}

/**
 * A subtle skyline silhouette as a CSS conic / repeating gradient — adds depth
 * without an SVG asset. Returns a background-image overlay.
 */
export function skylineMask(state: DayState): string {
  const ink = state === "night" ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.30)";
  // staircase wedges across the bottom 28% — abstract city skyline
  return `linear-gradient(180deg, transparent 0%, transparent 70%, ${ink} 100%),
    repeating-linear-gradient(90deg,
      transparent 0 8px,
      ${ink} 8px 14px,
      transparent 14px 26px,
      ${ink} 26px 30px,
      transparent 30px 50px)`;
}
