/**
 * Despia native bridge wrapper.
 *
 * Despia ships a single `despia()` JS function that the native iOS/Android
 * shell intercepts to run native code. On the web it is a no-op.
 *
 * We import the SDK lazily so the web bundle still works (the package is
 * SSR-safe but touches `window` on init).
 *
 * Usage:
 *   import { isNativeApp, despiaCall, getNativeUUID } from "@/lib/despia";
 */

import type DespiaFn from "despia-native";

let _despia: typeof DespiaFn | null = null;

function getDespia(): typeof DespiaFn | null {
  if (typeof window === "undefined") return null;
  if (_despia) return _despia;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _despia = require("despia-native").default ?? require("despia-native");
  } catch {
    _despia = null;
  }
  return _despia;
}

/**
 * True when running inside the Despia-built native iOS or Android shell.
 * Detection: Despia injects a global `despia` object with a `uuid` and sets
 * a UA flag containing "Despia". Both checks are client-only.
 */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.despia && typeof w.despia.uuid === "string" && w.despia.uuid.length > 0) return true;
  if (typeof navigator !== "undefined" && /Despia/i.test(navigator.userAgent || "")) return true;
  return false;
}

/** Native install UUID, or null on web / before bridge is ready. */
export function getNativeUUID(): string | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.despia?.uuid ?? null;
}

/** "ios" | "android" | null. Best-effort UA sniff for branching UI. */
export function getNativePlatform(): "ios" | "android" | null {
  if (!isNativeApp() || typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return null;
}

/**
 * Invoke a Despia native bridge command.
 *
 * Despia exposes commands as URL-style strings, e.g. `despia("haptic://light")`
 * or `despia("audioplayer://play?url=...")`. On web this is a safe no-op
 * that returns `null`, so callers can use the same code path on every
 * platform.
 *
 * Returns whatever the bridge returns (often `void` / a promise of JSON
 * for query-style commands), or `null` when not available.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function despiaCall(command: string): any {
  if (!isNativeApp()) return null;
  const fn = getDespia();
  if (!fn) return null;
  try {
    return fn(command);
  } catch (err) {
    // Never let a bridge call crash the app — log and continue on web fallback.
    // eslint-disable-next-line no-console
    console.warn("[despia] call failed:", command, err);
    return null;
  }
}

/**
 * RevenueCat public SDK key. This is the *public* iOS/Android key (safe to
 * ship in the client, like Stripe's publishable key). It tells the Despia
 * native shell which RevenueCat project to talk to. The actual purchase
 * flow runs inside Despia's RevenueCat bridge — we never call StoreKit or
 * RC's Swift/Kotlin SDKs ourselves.
 *
 * Override in production by setting `VITE_REVENUECAT_PUBLIC_KEY`.
 */
const REVENUECAT_PUBLIC_KEY =
  (import.meta.env.VITE_REVENUECAT_PUBLIC_KEY as string | undefined) ??
  "test_kZVeaAioOAOtoMjDGTkyBoGLvdo";

/**
 * Open the native RevenueCat paywall on iOS/Android. The Despia shell
 * presents the StoreKit/Play Billing sheet and routes the purchase result
 * back to RevenueCat, which fires our `/api/public/hooks/revenuecat`
 * webhook to update the `subscriptions` table.
 *
 * `appUserId` MUST be the Supabase auth uid so the subscription follows
 * the account across devices. Defaults to the `default` offering, which
 * should contain `monthly`, `yearly`, and `lifetime` products tied to
 * the `plus` entitlement.
 *
 * No-op on web — caller should fall back to Stripe Checkout there.
 */
export function openRevenueCatPaywall(opts: {
  appUserId: string;
  offering?: string;
}): void {
  if (!isNativeApp()) return;
  const params = new URLSearchParams({
    api_key: REVENUECAT_PUBLIC_KEY,
    app_user_id: opts.appUserId,
    offering: opts.offering ?? "default",
    entitlement: "plus",
  });
  despiaCall(`revenuecat://paywall?${params.toString()}`);
}

/** Open RevenueCat's native Customer Center (manage / cancel / restore). */
export function openRevenueCatCustomerCenter(appUserId: string): void {
  if (!isNativeApp()) return;
  const params = new URLSearchParams({
    api_key: REVENUECAT_PUBLIC_KEY,
    app_user_id: appUserId,
  });
  despiaCall(`revenuecat://customercenter?${params.toString()}`);
}

/** Open the native App Store / Play Store subscription management screen. */
export function openNativeSubscriptionSettings(): void {
  if (!isNativeApp()) return;
  const platform = getNativePlatform();
  if (platform === "ios") {
    despiaCall("openexternal://https://apps.apple.com/account/subscriptions");
  } else if (platform === "android") {
    despiaCall("openexternal://https://play.google.com/store/account/subscriptions");
  }
}
