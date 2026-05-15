import { useEffect, useRef, useState } from "react";
import { despiaCall, getNativePlatform, isNativeApp } from "@/lib/despia";

/**
 * iOS HealthKit step source via the Despia native bridge.
 *
 * Strategy: capture a baseline of "today's step count so far" the moment
 * `enabled` flips true, then poll every 15s. Steps for THIS walk are the
 * delta since the baseline. This works whether the screen is on or off,
 * the app is foregrounded or backgrounded — HealthKit is the system-wide
 * pedometer maintained by iOS.
 *
 * Returns:
 *  - `supported` — true only inside the Despia native shell on iOS
 *  - `steps`     — cumulative steps since `enabled` flipped true (null = no reading yet)
 *  - `source`    — "healthkit" when active, "unsupported" otherwise
 */
const POLL_MS = 15_000;

interface HealthKitDailyEntry {
  date: string;
  value: number;
  unit?: string;
}
interface HealthKitResponse {
  healthkitResponse?: {
    HKQuantityTypeIdentifierStepCount?: HealthKitDailyEntry[];
  };
}

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function readTodaySteps(): Promise<number | null> {
  try {
    const res = (await despiaCall(
      "readhealthkit://HKQuantityTypeIdentifierStepCount?days=1",
    )) as Promise<HealthKitResponse> | HealthKitResponse | null;
    const data = (await Promise.resolve(res)) as HealthKitResponse | null;
    const series = data?.healthkitResponse?.HKQuantityTypeIdentifierStepCount;
    if (!Array.isArray(series)) return null;
    const today = todayIsoDate();
    const todayEntry = series.find((e) => e.date?.startsWith(today));
    return todayEntry ? Math.max(0, Math.round(todayEntry.value)) : 0;
  } catch {
    return null;
  }
}

export function useNativeStepCounter(enabled: boolean) {
  const [steps, setSteps] = useState<number | null>(null);
  const [supported, setSupported] = useState(false);
  const baselineRef = useRef<number | null>(null);

  useEffect(() => {
    setSupported(isNativeApp() && getNativePlatform() === "ios");
  }, []);

  useEffect(() => {
    if (!enabled || !supported) {
      baselineRef.current = null;
      setSteps(null);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      const total = await readTodaySteps();
      if (cancelled || total === null) return;
      if (baselineRef.current === null) {
        baselineRef.current = total;
        setSteps(0);
        return;
      }
      setSteps(Math.max(0, total - baselineRef.current));
    };

    void tick();
    timer = setInterval(tick, POLL_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [enabled, supported]);

  return { steps, supported, source: supported ? ("healthkit" as const) : ("unsupported" as const) };
}
