import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AuthForm, type AuthPlan, PLAN_INTENT_KEY } from "@/components/auth-form";
import { PlusCheckout } from "@/components/billing/plus-checkout";
import { SupporterCheckout } from "@/components/billing/supporter-checkout";
import { SupporterAmountPicker } from "@/components/billing/supporter-amount-picker";
import { PlanPicker } from "@/components/billing/plan-picker";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { useAuth } from "@/lib/auth-context";
import type { PlusPlan } from "@/lib/billing.functions";
import { trackBillingEvent } from "@/lib/billing-analytics";
import { Heart, Sparkles } from "lucide-react";

interface Ctx {
  openAuth: (mode?: "signin" | "signup", plan?: AuthPlan) => void;
  openPlusCheckout: (plan?: PlusPlan) => void;
  openSupporterFlow: (initialCents?: number) => void;
  requireAuth: (action: () => void) => void;
}

const AuthPromptCtx = createContext<Ctx>({
  openAuth: () => {},
  openPlusCheckout: () => {},
  openSupporterFlow: () => {},
  requireAuth: () => {},
});

export function AuthPromptProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [authPlan, setAuthPlan] = useState<AuthPlan>("free");

  // Plus checkout state — show plan picker until a plan is chosen
  const [plusOpen, setPlusOpen] = useState(false);
  const [plusPlan, setPlusPlan] = useState<PlusPlan | null>(null);

  // Supporter flow — amount picker then embedded checkout
  const [supporterOpen, setSupporterOpen] = useState(false);
  const [supporterAmount, setSupporterAmount] = useState(500);
  const [supporterCheckoutStarted, setSupporterCheckoutStarted] = useState(false);

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
        setPlusPlan(null);
        setPlusOpen(true);
        void trackBillingEvent("checkout_opened", { stage: "plan_picker" });
      }, 350);
      return () => clearTimeout(t);
    }
    // Accept legacy "patron" key from any in-flight signups
    if (intent === "supporter" || intent === "patron") {
      window.localStorage.removeItem(PLAN_INTENT_KEY);
      const t = setTimeout(() => {
        setSupporterCheckoutStarted(false);
        setSupporterOpen(true);
        void trackBillingEvent("supporter_intent_selected");
      }, 350);
      return () => clearTimeout(t);
    }
  }, [user]);

  const openAuth = useCallback((mode: "signin" | "signup" = "signup", plan: AuthPlan = "free") => {
    setAuthMode(mode);
    setAuthPlan(plan);
    setAuthOpen(true);
  }, []);

  const openPlusCheckout = useCallback(
    (plan?: PlusPlan) => {
      void trackBillingEvent("plus_intent_selected", plan ? { plan } : {});
      if (!user) {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(PLAN_INTENT_KEY, "plus");
        }
        openAuth("signup", "plus");
        return;
      }
      setPlusPlan(plan ?? null);
      setPlusOpen(true);
      void trackBillingEvent("checkout_opened", { plan: plan ?? "picker" });
    },
    [user, openAuth],
  );

  const openSupporterFlow = useCallback(
    (initialCents = 500) => {
      void trackBillingEvent("supporter_intent_selected");
      if (!user) {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(PLAN_INTENT_KEY, "supporter");
        }
        openAuth("signup", "free");
        return;
      }
      setSupporterAmount(initialCents);
      setSupporterCheckoutStarted(false);
      setSupporterOpen(true);
    },
    [user, openAuth],
  );

  const requireAuth = useCallback((action: () => void) => {
    if (user) action();
    else openAuth("signup");
  }, [user, openAuth]);

  return (
    <AuthPromptCtx.Provider value={{ openAuth, openPlusCheckout, openSupporterFlow, requireAuth }}>
      {children}
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border-border bg-card p-7 sm:max-w-md">
          <AuthForm defaultMode={authMode} defaultPlan={authPlan} onSuccess={() => setAuthOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Plus dialog: plan picker → embedded checkout */}
      <Dialog
        open={plusOpen}
        onOpenChange={(open) => {
          setPlusOpen(open);
          if (!open) {
            void trackBillingEvent("checkout_dismissed", { plan: plusPlan ?? "picker" });
            setPlusPlan(null);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl border-border bg-card p-0 sm:max-w-xl">
          <PaymentTestModeBanner />
          <div className="px-6 pb-6 pt-5">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-forest text-primary-foreground">
                <Sparkles className="h-4 w-4" />
              </span>
              <h2 className="font-serif text-xl text-foreground">Walk Club Plus</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              50% of every Plus dollar funds our nonprofit partner. Cancel anytime.
            </p>
            {plusOpen && !plusPlan && (
              <div className="mt-5">
                <PlanPicker
                  current="yearly"
                  onSelect={(p) => {
                    setPlusPlan(p);
                    void trackBillingEvent("checkout_opened", { plan: p });
                  }}
                />
                <p className="mt-3 text-[11px] text-muted-foreground">30-day free trial. We email a reminder before your first charge.</p>
              </div>
            )}
            {plusOpen && plusPlan && (
              <div className="mt-5">
                <PlusCheckout plan={plusPlan} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Supporter dialog: amount picker → embedded checkout */}
      <Dialog
        open={supporterOpen}
        onOpenChange={(open) => {
          setSupporterOpen(open);
          if (!open) {
            void trackBillingEvent("supporter_checkout_dismissed", { amount_cents: supporterAmount });
            setSupporterCheckoutStarted(false);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl border-border bg-card p-0 sm:max-w-xl">
          <PaymentTestModeBanner />
          <div className="px-6 pb-6 pt-5">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-rose-100 text-rose-600">
                <Heart className="h-4 w-4" />
              </span>
              <h2 className="font-serif text-xl text-foreground">Become a Supporter</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose your monthly amount. 100% of profits go to our nonprofit partner.
            </p>
            {supporterOpen && !supporterCheckoutStarted && (
              <div className="mt-5">
                <SupporterAmountPicker
                  value={supporterAmount}
                  onChange={setSupporterAmount}
                  onConfirm={() => {
                    void trackBillingEvent("supporter_amount_chosen", { amount_cents: supporterAmount });
                    void trackBillingEvent("supporter_checkout_opened", { amount_cents: supporterAmount });
                    setSupporterCheckoutStarted(true);
                  }}
                  confirmLabel="Continue"
                />
              </div>
            )}
            {supporterOpen && supporterCheckoutStarted && (
              <div className="mt-5">
                <SupporterCheckout amountCents={supporterAmount} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AuthPromptCtx.Provider>
  );
}

export const useAuthPrompt = () => useContext(AuthPromptCtx);
