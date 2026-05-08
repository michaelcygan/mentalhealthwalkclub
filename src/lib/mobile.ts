/** Tiny mobile-native helpers. All no-ops on unsupported platforms. */

export const haptic = (ms: number | number[] = 8): void => {
  try { navigator.vibrate?.(ms); } catch { /* no-op */ }
};

export const share = async (data: ShareData): Promise<boolean> => {
  try {
    if (navigator.share) { await navigator.share(data); return true; }
  } catch { /* user cancel or no support */ }
  try {
    if (data.url && navigator.clipboard) {
      await navigator.clipboard.writeText(data.url);
      return true;
    }
  } catch { /* clipboard blocked */ }
  return false;
};

/** Wraps a state update in document.startViewTransition where supported. */
export const viewTransition = (fn: () => void): void => {
  const d = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (typeof d.startViewTransition === "function") d.startViewTransition(fn);
  else fn();
};
