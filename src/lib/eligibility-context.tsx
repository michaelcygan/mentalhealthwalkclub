import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { getMyEligibility } from "@/lib/account-eligibility.functions";
import type { Eligibility } from "@/lib/safety-config";

interface EligibilityCtx {
  eligibility: Eligibility | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<EligibilityCtx>({ eligibility: null, loading: true, refresh: async () => {} });

export function EligibilityProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setEligibility(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const e = await getMyEligibility();
      setEligibility(e);
    } catch {
      setEligibility({ eligibilityStatus: "pending_age", safetyRealm: "unknown", ageBand: null });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  return (
    <Ctx.Provider value={{ eligibility, loading: authLoading || loading, refresh: load }}>
      {children}
    </Ctx.Provider>
  );
}

export const useEligibility = () => useContext(Ctx);
