import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AuthForm, type AuthPlan, PLAN_INTENT_KEY } from "@/components/auth-form";
import { WelcomeDialog } from "@/components/welcome-dialog";
import { PlusCheckout } from "@/components/billing/plus-checkout";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { useAuth } from "@/lib/auth-context";

interface Ctx {
  openAuth: (mode?: "signin" | "signup", plan?: AuthPlan) => void;
  openWelcome: () => void;
  openPlusCheckout: () => void;
  requireAuth: (action: () => void) => void;
}

const AuthPromptCtx = createContext<Ctx>({
  openAuth: () => {},
  openWelcome: () => {},
  openPlusCheckout: () => {},
  requireAuth: () => {},
});

const SEEN_KEY = "wc_seen_welcome";

export function AuthPromptProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [authPlan, setAuthPlan] = useState<AuthPlan>("free");
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Auto-open welcome modal once for first-time visitors who aren't signed in
  useEffect(() => {
    if (loading || user) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(SEEN_KEY)) return;
    const t = setTimeout(() => {
      setWelcomeOpen(true);
      window.localStorage.setItem(SEEN_KEY, "1");
    }, 700);
    return () => clearTimeout(t);
  }, [loading, user]);

  // After login/signup, if the user picked Plus, open checkout automatically.
  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    const intent = window.localStorage.getItem(PLAN_INTENT_KEY);
    if (intent === "plus") {
      window.localStorage.removeItem(PLAN_INTENT_KEY);
      const t = setTimeout(() => setCheckoutOpen(true), 350);
      return () => clearTimeout(t);
    }
  }, [user]);

  const openAuth = useCallback((mode: "signin" | "signup" = "signup", plan: AuthPlan = "free") => {
    setAuthMode(mode);
    setAuthPlan(plan);
    setWelcomeOpen(false);
    setAuthOpen(true);
  }, []);

  const openWelcome = useCallback(() => setWelcomeOpen(true), []);

  const openPlusCheckout = useCallback(() => {
    if (!user) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(PLAN_INTENT_KEY, "plus");
      }
      openAuth("signup", "plus");
      return;
    }
    setCheckoutOpen(true);
  }, [user, openAuth]);

  const requireAuth = useCallback((action: () => void) => {
    if (user) action();
    else openAuth("signup");
  }, [user, openAuth]);

  return (
    <AuthPromptCtx.Provider value={{ openAuth, openWelcome, openPlusCheckout, requireAuth }}>
      {children}
      <WelcomeDialog
        open={welcomeOpen}
        onOpenChange={setWelcomeOpen}
        onSignUp={(plan) => openAuth("signup", plan)}
        onSignIn={() => openAuth("signin")}
      />
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="rounded-3xl border-border bg-card p-7 sm:max-w-md">
          <AuthForm defaultMode={authMode} defaultPlan={authPlan} onSuccess={() => setAuthOpen(false)} />
        </DialogContent>
      </Dialog>
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl border-border bg-card p-0 sm:max-w-xl">
          <PaymentTestModeBanner />
          <div className="px-6 pb-6 pt-5">
            <h2 className="font-serif text-xl text-foreground">Start your 1-month free trial</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              30 days free, then $4.99/mo. Cancel anytime — no charge until day 30.
            </p>
            {checkoutOpen && (
              <div className="mt-5">
                <PlusCheckout />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AuthPromptCtx.Provider>
  );
}

export const useAuthPrompt = () => useContext(AuthPromptCtx);
