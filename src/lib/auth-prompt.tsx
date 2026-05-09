import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AuthForm, type AuthPlan } from "@/components/auth-form";
import { WelcomeDialog } from "@/components/welcome-dialog";
import { useAuth } from "@/lib/auth-context";

interface Ctx {
  openAuth: (mode?: "signin" | "signup", plan?: AuthPlan) => void;
  openWelcome: () => void;
  requireAuth: (action: () => void) => void;
}

const AuthPromptCtx = createContext<Ctx>({
  openAuth: () => {},
  openWelcome: () => {},
  requireAuth: () => {},
});

const SEEN_KEY = "wc_seen_welcome";

export function AuthPromptProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [authPlan, setAuthPlan] = useState<AuthPlan>("free");
  const [welcomeOpen, setWelcomeOpen] = useState(false);

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

  const openAuth = useCallback((mode: "signin" | "signup" = "signup", plan: AuthPlan = "free") => {
    setAuthMode(mode);
    setAuthPlan(plan);
    setWelcomeOpen(false);
    setAuthOpen(true);
  }, []);

  const openWelcome = useCallback(() => setWelcomeOpen(true), []);

  const requireAuth = useCallback((action: () => void) => {
    if (user) action();
    else openAuth("signup");
  }, [user, openAuth]);

  return (
    <AuthPromptCtx.Provider value={{ openAuth, openWelcome, requireAuth }}>
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
    </AuthPromptCtx.Provider>
  );
}

export const useAuthPrompt = () => useContext(AuthPromptCtx);
