import { useCallback, useEffect, useState } from "react";

const KEY = "wc_demo_mode";

function read(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(KEY) === "1";
}

export function useDemoMode() {
  const [demo, setDemo] = useState<boolean>(read);

  useEffect(() => {
    const onStorage = () => setDemo(read());
    window.addEventListener("storage", onStorage);
    window.addEventListener("wc:demo-change", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("wc:demo-change", onStorage);
    };
  }, []);

  const enter = useCallback(() => {
    window.sessionStorage.setItem(KEY, "1");
    window.dispatchEvent(new Event("wc:demo-change"));
    setDemo(true);
  }, []);

  const exit = useCallback(() => {
    window.sessionStorage.removeItem(KEY);
    window.dispatchEvent(new Event("wc:demo-change"));
    setDemo(false);
  }, []);

  return { demo, enter, exit };
}
