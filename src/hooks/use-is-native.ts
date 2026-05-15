import { useEffect, useState } from "react";
import { getNativePlatform, getNativeUUID, isNativeApp } from "@/lib/despia";

/**
 * Detects whether the app is running inside the Despia native shell.
 *
 * SSR-safe: returns `false` on server and on first client render, then
 * flips to the real value after hydration. Use this to gate any
 * native-only UI (HealthKit prompts, native paywall, push permission,
 * lock-screen audio controls, etc.).
 *
 * Example:
 *   const { isNative, platform } = useIsNative();
 *   if (isNative && platform === "ios") return <HealthKitPrompt />;
 */
export function useIsNative() {
  const [state, setState] = useState<{
    isNative: boolean;
    platform: "ios" | "android" | null;
    uuid: string | null;
  }>({ isNative: false, platform: null, uuid: null });

  useEffect(() => {
    setState({
      isNative: isNativeApp(),
      platform: getNativePlatform(),
      uuid: getNativeUUID(),
    });
  }, []);

  return state;
}
