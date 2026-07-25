// Pure helpers for the walk weather feature. Kept free of side effects
// and framework imports so they're trivial to reason about and test.

export type ConditionCode =
  | "clear"
  | "partly-cloudy"
  | "cloudy"
  | "rain"
  | "storm"
  | "snow"
  | "fog"
  | "wind"
  | "unknown";

export type WalkWeatherPeriod = {
  startTime: string;
  endTime: string | null;
  temperature: number;
  temperatureUnit: "F" | "C";
  precipitationChance: number | null;
  shortForecast: string;
  isDaytime: boolean;
  conditionCode: ConditionCode;
};

/** Round to 3 decimals — ~110m — plenty for NWS grid identity. */
export function roundCoord(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Derive a small stable condition code from NWS shortForecast + isDaytime. */
export function deriveConditionCode(shortForecast: string, isDaytime: boolean): ConditionCode {
  const s = (shortForecast || "").toLowerCase();
  if (!s) return "unknown";
  if (/thunder|t-storm|tstorm|storm|lightning/.test(s)) return "storm";
  if (/snow|sleet|flurr|blizzard|ice/.test(s)) return "snow";
  if (/rain|shower|drizzle/.test(s)) return "rain";
  if (/fog|mist|haze|smoke/.test(s)) return "fog";
  if (/wind|breez|gust/.test(s)) return "wind";
  if (/sunny|clear/.test(s)) return "clear";
  if (/mostly cloudy|overcast|cloudy/.test(s)) {
    return /partly|mostly sunny|mostly clear/.test(s) ? "partly-cloudy" : "cloudy";
  }
  if (/partly|mostly sunny|mostly clear|few clouds|scattered clouds/.test(s)) return "partly-cloudy";
  // fall back based on daytime for very generic phrases
  if (/fair/.test(s)) return isDaytime ? "clear" : "clear";
  return "unknown";
}

/**
 * Extract wall-clock components from an ISO-8601 timestamp with offset,
 * without converting into any timezone. NWS shape: `2026-07-25T17:00:00-04:00`.
 */
export function parseWallClock(iso: string): { y: number; mo: number; d: number; h: number; mi: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return null;
  return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5] };
}

/** Find the period whose wall-clock Y/M/D/H matches the given local date+hour. */
export function findPeriodForLocalHour(
  periods: WalkWeatherPeriod[],
  date: Date,
  hour24: number,
): WalkWeatherPeriod | null {
  const y = date.getFullYear();
  const mo = date.getMonth() + 1;
  const d = date.getDate();
  for (const p of periods) {
    const w = parseWallClock(p.startTime);
    if (!w) continue;
    if (w.y === y && w.mo === mo && w.d === d && w.h === hour24) return p;
  }
  return null;
}

/** Select up to 5 nearby periods centered on the given local date+hour. */
export function nearbyHourWindow(
  periods: WalkWeatherPeriod[],
  date: Date,
  hour24: number,
): { tiles: WalkWeatherPeriod[]; selectedIndex: number } {
  const y = date.getFullYear();
  const mo = date.getMonth() + 1;
  const d = date.getDate();
  let idx = -1;
  for (let i = 0; i < periods.length; i++) {
    const w = parseWallClock(periods[i].startTime);
    if (!w) continue;
    if (w.y === y && w.mo === mo && w.d === d && w.h === hour24) {
      idx = i;
      break;
    }
  }
  if (idx < 0) return { tiles: [], selectedIndex: -1 };
  const start = Math.max(0, idx - 2);
  const end = Math.min(periods.length, idx + 3);
  return { tiles: periods.slice(start, end), selectedIndex: idx - start };
}

/** Is the given local date within the range covered by these periods? */
export function dateWithinPeriods(periods: WalkWeatherPeriod[], date: Date): boolean {
  if (periods.length === 0) return false;
  const first = parseWallClock(periods[0].startTime);
  const last = parseWallClock(periods[periods.length - 1].startTime);
  if (!first || !last) return false;
  const dayKey = (y: number, mo: number, d: number) => y * 10000 + mo * 100 + d;
  const target = dayKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return target >= dayKey(first.y, first.mo, first.d) && target <= dayKey(last.y, last.mo, last.d);
}

/** "5 PM" style label from a wall-clock hour (0-23). */
export function formatHour12(hour24: number): string {
  const isPm = hour24 >= 12;
  const h = ((hour24 + 11) % 12) + 1;
  return `${h} ${isPm ? "PM" : "AM"}`;
}
