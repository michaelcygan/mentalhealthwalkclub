/**
 * Format a number of minutes into the largest natural unit.
 * Walking-time mapping: 60 min → hr, 24 hr → day, 365 d → yr.
 */
export function formatDuration(mins: number): { value: string; unit: string } {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return { value: String(m), unit: m === 1 ? "min" : "min" };
  const hrs = m / 60;
  if (hrs < 24) return { value: trim(hrs), unit: hrs === 1 ? "hr" : "hrs" };
  const days = hrs / 24;
  if (days < 365) return { value: trim(days), unit: days === 1 ? "day" : "days" };
  const yrs = days / 365;
  return { value: trim(yrs), unit: yrs === 1 ? "yr" : "yrs" };
}

function trim(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
