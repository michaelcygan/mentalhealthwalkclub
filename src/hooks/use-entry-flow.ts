import { useCallback, useEffect, useState } from "react";

/**
 * Single source of truth for the unified onboarding/entry flow.
 *
 * Slide indices:
 *   0  welcome (signed-out marketing/sales)
 *   1  name
 *   2  location
 *   3  themes + Walk & Talk comfort
 *   4  suggested groups
 *   5  first walk ("you're set")
 */

export type EntryStep = 0 | 1 | 2 | 3 | 4 | 5;

const STEP_KEY = "wc_flow_step";
const LAST_AUTH_KEY = "wc_last_auth";
const SEEN_KEY = "wc_seen_welcome";

export function useEntryFlow(initial: EntryStep = 0) {
  const [step, setStepState] = useState<EntryStep>(() => {
    if (typeof window === "undefined") return initial;
    const raw = window.sessionStorage.getItem(STEP_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= 0 && n <= 5 ? (n as EntryStep) : initial;
  });

  const setStep = useCallback((s: EntryStep) => {
    setStepState(s);
    if (typeof window !== "undefined") window.sessionStorage.setItem(STEP_KEY, String(s));
  }, []);

  const next = useCallback(() => setStep(Math.min(5, step + 1) as EntryStep), [step, setStep]);
  const back = useCallback(() => setStep(Math.max(0, step - 1) as EntryStep), [step, setStep]);
  const reset = useCallback(() => {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(STEP_KEY);
    setStepState(0);
  }, []);

  return { step, setStep, next, back, reset };
}

export function rememberAuthMethod(method: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_AUTH_KEY, method);
}

export function getLastAuthMethod(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LAST_AUTH_KEY);
}

/** True after the welcome slide has been viewed once (controls long vs condensed hero). */
export function useHasSeenWelcome() {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") setSeen(!!window.localStorage.getItem(SEEN_KEY));
  }, []);
  const mark = () => {
    if (typeof window !== "undefined") window.localStorage.setItem(SEEN_KEY, "1");
    setSeen(true);
  };
  return { seen, mark };
}
