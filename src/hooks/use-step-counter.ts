import { useEffect, useRef, useState } from "react";

/**
 * Accelerometer-based step detection as a fallback for when GPS is weak,
 * denied, or hasn't locked yet. Uses a simple peak detection on the
 * magnitude of linear acceleration with a refractory period.
 *
 * iOS 13+ Safari requires a user-gesture call to
 * `DeviceMotionEvent.requestPermission()` before any `devicemotion` event
 * will fire. Android/Chrome grants automatically on https.
 *
 * Returns:
 *  - `steps`: counted steps since `enabled` flipped true
 *  - `supported`: device exposes DeviceMotion at all
 *  - `permissionState`: "granted" | "needed" | "denied" | "unavailable"
 *  - `request()`: prompt for iOS permission (must be called from a user gesture)
 */
type PermissionState = "granted" | "needed" | "denied" | "unavailable";

interface MotionEventStaticIOS {
  requestPermission?: () => Promise<"granted" | "denied">;
}

const PEAK_THRESHOLD = 1.15;       // m/s^2 above gravity-removed baseline
const VALLEY_THRESHOLD = -0.6;     // require a downswing before next peak
const MIN_STEP_INTERVAL_MS = 280;  // ~214 steps/min cap, refractory window
const SMOOTH_ALPHA = 0.18;         // low-pass on magnitude

export function useStepCounter(enabled: boolean) {
  const [steps, setSteps] = useState(0);
  const [permissionState, setPermissionState] = useState<PermissionState>(() => {
    if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) return "unavailable";
    const ios = (window.DeviceMotionEvent as unknown as MotionEventStaticIOS).requestPermission;
    if (typeof ios === "function") return "needed";
    return "granted";
  });

  const lastStepAt = useRef(0);
  const smoothed = useRef(0);
  const armed = useRef(true); // requires a valley before the next peak

  // Reset the counter whenever we start a new session.
  useEffect(() => { if (enabled) { setSteps(0); lastStepAt.current = 0; smoothed.current = 0; armed.current = true; } }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (permissionState !== "granted") return;
    if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) return;

    const onMotion = (e: DeviceMotionEvent) => {
      // Prefer linear acceleration if available (iOS provides it as
      // accelerationIncludingGravity AND acceleration). Either works because
      // we high-pass with EMA + zero-cross detection.
      const a = e.acceleration ?? e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
      // For accelerationIncludingGravity, subtract ~g to center near 0
      const centered = e.acceleration ? mag : mag - 9.81;
      // EMA low-pass to kill jitter
      smoothed.current = smoothed.current + SMOOTH_ALPHA * (centered - smoothed.current);

      const now = performance.now();
      if (armed.current && smoothed.current > PEAK_THRESHOLD && now - lastStepAt.current > MIN_STEP_INTERVAL_MS) {
        lastStepAt.current = now;
        armed.current = false;
        setSteps((s) => s + 1);
      } else if (!armed.current && smoothed.current < VALLEY_THRESHOLD) {
        armed.current = true;
      }
    };

    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [enabled, permissionState]);

  const request = async (): Promise<PermissionState> => {
    if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) {
      setPermissionState("unavailable");
      return "unavailable";
    }
    const ios = (window.DeviceMotionEvent as unknown as MotionEventStaticIOS).requestPermission;
    if (typeof ios !== "function") { setPermissionState("granted"); return "granted"; }
    try {
      const res = await ios();
      const next: PermissionState = res === "granted" ? "granted" : "denied";
      setPermissionState(next);
      return next;
    } catch {
      setPermissionState("denied");
      return "denied";
    }
  };

  return {
    steps,
    supported: permissionState !== "unavailable",
    permissionState,
    request,
  };
}
