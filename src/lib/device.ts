/**
 * Tiny mobile capability layer. All functions are safe no-ops where the
 * underlying API is missing — call them anywhere without feature checks.
 */

type VibratePattern = number | number[];

export const haptics = {
  /** Light tap. Use for taps, toggles, mute. */
  tap() { try { (navigator as Navigator & { vibrate?: (p: VibratePattern) => boolean }).vibrate?.(8); } catch { /* noop */ } },
  /** Soft double — confirmations, joins. */
  soft() { try { (navigator as Navigator & { vibrate?: (p: VibratePattern) => boolean }).vibrate?.([6, 40, 6]); } catch { /* noop */ } },
  /** Success — walk complete, badge earned. */
  success() { try { (navigator as Navigator & { vibrate?: (p: VibratePattern) => boolean }).vibrate?.([10, 30, 18]); } catch { /* noop */ } },
  /** Warning — wrap-up cue. */
  warn() { try { (navigator as Navigator & { vibrate?: (p: VibratePattern) => boolean }).vibrate?.([24, 60, 24]); } catch { /* noop */ } },
  custom(pattern: VibratePattern) { try { (navigator as Navigator & { vibrate?: (p: VibratePattern) => boolean }).vibrate?.(pattern); } catch { /* noop */ } },
};

export interface SharePayload { title?: string; text?: string; url?: string; }

/** Web Share API with clipboard fallback. Returns true if shared/copied. */
export async function share(payload: SharePayload): Promise<boolean> {
  try {
    const nav = navigator as Navigator & { share?: (data: SharePayload) => Promise<void> };
    if (nav.share) {
      await nav.share(payload);
      return true;
    }
  } catch {
    // user dismissed or share failed — fall through to clipboard
  }
  try {
    const text = [payload.title, payload.text, payload.url].filter(Boolean).join("\n");
    if (text && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* noop */ }
  return false;
}

/** Acquire a screen wake lock. Returns release fn (always safe to call). */
export async function wakeLock(): Promise<() => void> {
  type Sentinel = { released: boolean; release: () => Promise<void>; addEventListener: (t: string, cb: () => void) => void };
  const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Sentinel> } }).wakeLock;
  if (!wl) return () => { /* noop */ };
  let sentinel: Sentinel | null = null;
  const acquire = async () => {
    try { sentinel = await wl.request("screen"); } catch { sentinel = null; }
  };
  await acquire();
  const onVis = () => { if (document.visibilityState === "visible" && (!sentinel || sentinel.released)) acquire(); };
  document.addEventListener("visibilitychange", onVis);
  return () => {
    document.removeEventListener("visibilitychange", onVis);
    sentinel?.release().catch(() => {});
    sentinel = null;
  };
}

/** Honors prefers-reduced-motion at runtime (re-checks on each call). */
export function reducedMotion(): boolean {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch { return false; }
}
