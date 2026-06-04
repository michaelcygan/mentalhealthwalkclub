import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AuthForm, type AuthPlan, PLAN_INTENT_KEY } from "@/components/auth-form";
import { PlusCheckout } from "@/components/billing/plus-checkout";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { useAuth } from "@/lib/auth-context";
import type { PlusPlan } from "@/lib/billing.functions";
import { trackBillingEvent } from "@/lib/billing-analytics";

interface Ctx {
  openAuth: (mode?: "signin" | "signup", plan?: AuthPlan) => void;
  openPlusCheckout: () => void;
  requireAuth: (action: () => void) => void;
}

const AuthPromptCtx = createContext<Ctx>({
  openAuth: () => {},
  openPlusCheckout: () => {},
  requireAuth: () => {},
});

export function AuthPromptProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [authPlan, setAuthPlan] = useState<AuthPlan>("free");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [plan, setPlan] = useState<PlusPlan>("plus_monthly");

  useEffect(() => {
    if (user && typeof window !== "undefined") {
      window.localStorage.setItem("wc_last_auth", "email");
    }
  }, [user]);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    const intent = window.localStorage.getItem(PLAN_INTENT_KEY);
    if (intent === "plus") {
      window.localStorage.removeItem(PLAN_INTENT_KEY);
      const t = setTimeout(() => {
        setPlan("plus_monthly");
        setCheckoutOpen(true);
        void trackBillingEvent("checkout_opened", { plan: "plus_monthly" });
      }, 350);
      return () => clearTimeout(t);
    }
  }, [user]);

  const openAuth = useCallback((mode: "signin" | "signup" = "signup", plan: AuthPlan = "free") => {
    setAuthMode(mode);
    setAuthPlan(plan);
    setAuthOpen(true);
  }, []);

  const openPlusCheckout = useCallback(() => {
    void trackBillingEvent("plus_intent_selected");
    if (!user) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(PLAN_INTENT_KEY, "plus");
      }
      openAuth("signup", "plus");
      return;
    }
    setPlan("plus_monthly");
    setCheckoutOpen(true);
    void trackBillingEvent("checkout_opened", { plan: "plus_monthly" });
  }, [user, openAuth]);

  const requireAuth = useCallback((action: () => void) => {
    if (user) action();
    else openAuth("signup");
  }, [user, openAuth]);

  return (
    <AuthPromptCtx.Provider value={{ openAuth, openPlusCheckout, requireAuth }}>
      {children}
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border-border bg-card p-7 sm:max-w-md">
          <AuthForm defaultMode={authMode} defaultPlan={authPlan} onSuccess={() => setAuthOpen(false)} />
        </DialogContent>
      </Dialog>
      <Dialog
        open={checkoutOpen}
        onOpenChange={(open) => {
          setCheckoutOpen(open);
          if (!open) void trackBillingEvent("checkout_dismissed", { plan });
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl border-border bg-card p-0 sm:max-w-xl">
          <PaymentTestModeBanner />
          <div className="px-6 pb-6 pt-5">
            <h2 className="font-serif text-xl text-foreground">Walk Club Plus</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              $1.99/mo. Cancel anytime. 50% of every Plus dollar funds our nonprofit partner.
            </p>
            {checkoutOpen && (
              <div className="mt-5">
                <PlusCheckout plan={plan} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AuthPromptCtx.Provider>
  );
}

export const useAuthPrompt = () => useContext(AuthPromptCtx);
