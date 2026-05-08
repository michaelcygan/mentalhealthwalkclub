import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed-at";
const COOLDOWN_MS = 30 * 24 * 3600_000;

/** Captures the deferred PWA install prompt + tracks whether to surface it. */
export function usePwaInstall() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      const last = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (Date.now() - last < COOLDOWN_MS) return;
      setEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setEvt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!evt) return false;
    await evt.prompt();
    const choice = await evt.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    if (choice.outcome !== "accepted") localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setEvt(null);
    return choice.outcome === "accepted";
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setEvt(null);
  };

  return { canInstall: !!evt && !installed, install, dismiss, installed };
}
