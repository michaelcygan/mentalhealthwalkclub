import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AuthForm, type AuthPlan, PLAN_INTENT_KEY } from "@/components/auth-form";
import { PlusCheckout } from "@/components/billing/plus-checkout";
import { PlusAmountPicker } from "@/components/billing/plus-amount-picker";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { useAuth } from "@/lib/auth-context";
import { trackBillingEvent } from "@/lib/billing-analytics";
import { Sparkles } from "lucide-react";

interface Ctx {
  openAuth: (mode?: "signin" | "signup", plan?: AuthPlan) => void;
  /** Opens Plus checkout. If donationCents is undefined, shows the amount picker first. */
  openPlusCheckout: (donationCents?: number) => void;
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

  const [plusOpen, setPlusOpen] = useState(false);
  const [donationCents, setDonationCents] = useState<number>(0);
  const [checkoutStarted, setCheckoutStarted] = useState(false);

  useEffect(() => {
    if (user && typeof window !== "undefined") {
      window.localStorage.setItem("wc_last_auth", "email");
    }
  }, [user]);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    const intent = window.localStorage.getItem(PLAN_INTENT_KEY);
    if (intent === "plus" || intent === "supporter" || intent === "patron") {
      window.localStorage.removeItem(PLAN_INTENT_KEY);
      const t = setTimeout(() => {
        setDonationCents(0);
        setCheckoutStarted(false);
        setPlusOpen(true);
        void trackBillingEvent("checkout_opened", { stage: "amount_picker" });
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
    (donation?: number) => {
      void trackBillingEvent("plus_intent_selected", donation !== undefined ? { donation_cents: donation } : {});
      if (!user) {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(PLAN_INTENT_KEY, "plus");
        }
        openAuth("signup", "plus");
        return;
      }
      if (donation !== undefined) {
        setDonationCents(donation);
        setCheckoutStarted(true);
        void trackBillingEvent("checkout_opened", { donation_cents: donation });
      } else {
        setDonationCents(0);
        setCheckoutStarted(false);
      }
      setPlusOpen(true);
    },
    [user, openAuth],
  );

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
        open={plusOpen}
        onOpenChange={(open) => {
          setPlusOpen(open);
          if (!open) {
            void trackBillingEvent("checkout_dismissed", { donation_cents: donationCents });
            setCheckoutStarted(false);
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
              $2.99/mo keeps Plus running. Every dollar above is designated to the 988 Suicide &amp; Crisis Lifeline.
            </p>
            {plusOpen && !checkoutStarted && (
              <div className="mt-5">
                <PlusAmountPicker
                  value={donationCents}
                  onChange={setDonationCents}
                  onConfirm={() => {
                    void trackBillingEvent("plus_amount_chosen", { donation_cents: donationCents });
                    void trackBillingEvent("checkout_opened", { donation_cents: donationCents });
                    setCheckoutStarted(true);
                  }}
                />
              </div>
            )}
            {plusOpen && checkoutStarted && (
              <div className="mt-5">
                <PlusCheckout donationCents={donationCents} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AuthPromptCtx.Provider>
  );
}

export const useAuthPrompt = () => useContext(AuthPromptCtx);
