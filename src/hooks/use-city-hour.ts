import { useEffect, useState } from "react";

/** Returns the current hour (0–23) in the given IANA timezone. Re-checks every 5 minutes. */
export function useCityHour(tz: string | null | undefined): number {
  const [hour, setHour] = useState(() => computeHour(tz));
  useEffect(() => {
    if (!tz) return;
    setHour(computeHour(tz));
    const id = setInterval(() => setHour(computeHour(tz)), 5 * 60_000);
    return () => clearInterval(id);
  }, [tz]);
  return hour;
}

function computeHour(tz: string | null | undefined): number {
  if (!tz) return new Date().getHours();
  try {
    const s = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(new Date());
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n % 24 : 0;
  } catch {
    return new Date().getHours();
  }
}
