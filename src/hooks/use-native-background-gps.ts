import { useEffect, useRef } from "react";
import { despiaCall, isNativeApp } from "@/lib/despia";

/**
 * Despia native background GPS.
 *
 * Starts a native GPS session on mount when `enabled` is true and the app
 * is running inside the Despia native shell. Points stream to
 * `window.onLocationChange` and are forwarded to the `onPoint` callback.
 * Tracking continues with the screen off and the app backgrounded as long
 * as Background Location is enabled in the Despia editor.
 *
 * Stops the session on unmount or when `enabled` flips false. Web is a
 * no-op so callers can mount this unconditionally and rely on
 * `navigator.geolocation.watchPosition` as the foreground/web fallback.
 *
 * `intervalSeconds` — minimum seconds between time-based fixes (heartbeat).
 * `movementCm`      — also fire whenever the device moves this many cm
 *                     (100 = 1 metre). Combined with a long heartbeat this
 *                     gives high-accuracy distance tracking.
 */
export interface NativeGpsPoint {
  latitude: number;
  longitude: number;
  speed: number | null;
  course: number | null;
  altitude: number | null;
  horizontalAccuracy: number;
  verticalAccuracy: number;
  battery: number | null;
  active: boolean;
  timestamp: number;
}

interface Options {
  enabled: boolean;
  intervalSeconds?: number;
  movementCm?: number;
  onPoint: (p: NativeGpsPoint) => void;
}

export function useNativeBackgroundGps({
  enabled,
  intervalSeconds = 30,
  movementCm = 500,
  onPoint,
}: Options) {
  // Hold the latest callback in a ref so we can update without restarting GPS.
  const cbRef = useRef(onPoint);
  useEffect(() => {
    cbRef.current = onPoint;
  }, [onPoint]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (!isNativeApp()) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;

    // If another native GPS session is already running on this page, don't
    // start a second one — Despia maintains a single session.
    const alreadyTracking = w.despia?.locationTracking === true;

    w.onLocationChange = (data: NativeGpsPoint) => {
      try {
        cbRef.current(data);
      } catch {
        /* swallow */
      }
    };

    if (!alreadyTracking) {
      despiaCall(`location://?buffer=${intervalSeconds}&movement=${movementCm}`);
    }

    return () => {
      // Stop the session and clear the callback so a re-mount can start fresh.
      try {
        despiaCall("stoplocation://");
      } catch {
        /* ignore */
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).onLocationChange = undefined;
    };
  }, [enabled, intervalSeconds, movementCm]);
}
