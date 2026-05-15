import { useStepCounter } from "@/hooks/use-step-counter";
import { useNativeStepCounter } from "@/hooks/use-native-step-counter";

/**
 * Combined step source for active walks.
 *
 * Prefers iOS HealthKit (real system pedometer, works with screen off and app
 * backgrounded) when running inside the Despia native shell. Falls back to
 * the existing accelerometer-based detector everywhere else (web, Android v1).
 *
 * Preserves the `useStepCounter` return shape so callers don't need to know
 * which source is active. Adds `source: "healthkit" | "motion"` so UI can
 * surface "background steps" messaging when relevant.
 */
export function useWalkSteps(enabled: boolean) {
  const motion = useStepCounter(enabled);
  const native = useNativeStepCounter(enabled);

  if (native.supported && native.steps !== null) {
    return {
      steps: native.steps,
      supported: true as const,
      // Native HealthKit needs no in-app permission prompt — iOS handles it
      // the first time the bridge is called.
      permissionState: "granted" as const,
      request: motion.request,
      source: "healthkit" as const,
    };
  }

  return {
    steps: motion.steps,
    supported: motion.supported,
    permissionState: motion.permissionState,
    request: motion.request,
    source: "motion" as const,
  };
}
