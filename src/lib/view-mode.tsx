import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type ViewMode = "walker" | "facilitator";

interface Ctx {
  mode: ViewMode;
  isFacilitator: boolean;
  setMode: (m: ViewMode) => void;
  ready: boolean;
}

const ViewModeCtx = createContext<Ctx>({
  mode: "walker",
  isFacilitator: false,
  setMode: () => {},
  ready: false,
});

const STORAGE_KEY = "wc.viewMode";

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isFacilitator, setIsFacilitator] = useState(false);
  const [mode, setModeState] = useState<ViewMode>("walker");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsFacilitator(false);
      setMode("walker");
      setReady(true);
      return;
    }
    let cancelled = false;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const fac = !!data?.some((r) => r.role === "facilitator" || r.role === "admin");
        setIsFacilitator(fac);
        const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
        if (stored === "walker" || stored === "facilitator") {
          setModeState(fac ? (stored as ViewMode) : "walker");
        } else {
          // Default for facilitators is facilitator view
          setModeState(fac ? "facilitator" : "walker");
        }
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const setMode = (m: ViewMode) => {
    setModeState(m);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, m);
  };

  return (
    <ViewModeCtx.Provider value={{ mode, isFacilitator, setMode, ready }}>
      {children}
    </ViewModeCtx.Provider>
  );
}

export const useViewMode = () => useContext(ViewModeCtx);
