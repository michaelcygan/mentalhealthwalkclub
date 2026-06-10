import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Footprints, Sparkles } from "lucide-react";

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}

function AppleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.42 2.23-1.18 3.04-.78.83-2.05 1.47-3.07 1.39-.13-1.1.4-2.24 1.13-2.99.83-.86 2.22-1.5 3.12-1.44zm3.46 16.27c-.59 1.34-.87 1.94-1.62 3.13-1.05 1.66-2.53 3.73-4.36 3.74-1.63.02-2.05-1.06-4.27-1.05-2.22.01-2.68 1.07-4.31 1.06-1.83-.01-3.23-1.88-4.28-3.54C-1.4 16.86-1.7 11.4.65 8.55c1.6-1.95 4.13-3.09 6.5-3.09 2.42 0 3.94 1.32 5.94 1.32 1.94 0 3.13-1.32 5.93-1.32 2.12 0 4.37 1.16 5.97 3.16-5.25 2.88-4.4 10.39 1.83 12.08z" />
    </svg>
  );
}


export type AuthPlan = "free" | "plus";
export const PLAN_INTENT_KEY = "wc_plan_intent";

interface Props {
  defaultMode?: "signin" | "signup";
  onSuccess?: (mode: "signin" | "signup") => void;
  /** When true, skip the default navigate-to-/welcome on signup success. */
  suppressRedirect?: boolean;
  /** Show the Free / Plus plan selector on signup. Default true. */
  showPlanSelector?: boolean;
  defaultPlan?: AuthPlan;
}

export function AuthForm({
  defaultMode = "signup",
  onSuccess,
  suppressRedirect = false,
  showPlanSelector = true,
  defaultPlan = "free",
}: Props) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(defaultMode);
  const [plan, setPlan] = useState<AuthPlan>(defaultPlan);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (typeof window !== "undefined") {
          window.localStorage.setItem(PLAN_INTENT_KEY, plan);
        }
        toast.success(
          plan === "plus"
            ? "Account created. We'll set up your free trial right after onboarding."
            : "Welcome. Lacing up your walking shoes…"
        );
        onSuccess?.("signup");
        if (!suppressRedirect) navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
        onSuccess?.("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    try {
      if (typeof window !== "undefined" && isSignup) {
        window.localStorage.setItem(PLAN_INTENT_KEY, plan);
        window.localStorage.setItem("wc_last_auth", "google");
      }
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw new Error(result.error.message ?? "Google sign-in failed");
      if (result.redirected) return; // browser is redirecting
      // Token-flow path: session is set
      toast.success(isSignup ? "Welcome aboard." : "Welcome back.");
      onSuccess?.(isSignup ? "signup" : "signin");
      if (isSignup && !suppressRedirect) navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  };

  const signInWithApple = async () => {
    setBusy(true);
    try {
      if (typeof window !== "undefined" && isSignup) {
        window.localStorage.setItem(PLAN_INTENT_KEY, plan);
        window.localStorage.setItem("wc_last_auth", "apple");
      }
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw new Error(result.error.message ?? "Apple sign-in failed");
      if (result.redirected) return;
      toast.success(isSignup ? "Welcome aboard." : "Welcome back.");
      onSuccess?.(isSignup ? "signup" : "signin");
      if (isSignup && !suppressRedirect) navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apple sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex gap-1 rounded-full bg-muted p-1">
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition ${
            isSignup ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"
          }`}
        >
          Create account
        </button>
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition ${
            !isSignup ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"
          }`}
        >
          Sign in
        </button>
      </div>

      <h2 className="mt-5 font-serif text-2xl text-foreground">
        {isSignup
          ? plan === "plus"
            ? "Start your free month of Plus"
            : "Come walk with us"
          : "Welcome back"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {isSignup
          ? plan === "plus"
            ? "30 days on us, then $2.99/mo. Half of every Plus dollar goes to the 988 Suicide & Crisis Lifeline. Cancel anytime — no charge until day 30."
            : "Free forever. Unlimited Solo + Guided walks, 5 Walk & Talks a month."
          : "Lace up. Let's go."}
      </p>

      {isSignup && showPlanSelector && (
        <div role="radiogroup" aria-label="Choose your plan" className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
          <button
            type="button"
            role="radio"
            aria-checked={plan === "free"}
            onClick={() => setPlan("free")}
            className={`flex flex-col items-start gap-1 rounded-xl px-3 py-2.5 text-left transition ${
              plan === "free" ? "bg-card shadow-soft ring-1 ring-border" : "text-muted-foreground"
            }`}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <Footprints className="h-3.5 w-3.5" /> Free
            </span>
            <span className="text-[11px] leading-tight text-muted-foreground">
              Unlimited Solo + Guided · 5 Walk & Talks/mo
            </span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={plan === "plus"}
            onClick={() => setPlan("plus")}
            className={`flex flex-col items-start gap-1 rounded-xl px-3 py-2.5 text-left transition ${
              plan === "plus" ? "bg-card shadow-soft ring-1 ring-forest" : "text-muted-foreground"
            }`}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-forest" /> Plus
            </span>
            <span className="text-[11px] leading-tight text-muted-foreground">
              Free 30 days · then $2.99/mo · Unlimited Circles, trails, groups · 50% to nonprofits
            </span>
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busy}
        className="mt-5 flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-border bg-card text-sm font-medium text-foreground shadow-soft transition hover:bg-muted disabled:opacity-60"
      >
        <GoogleMark className="h-4 w-4" />
        Continue with Google
      </button>

      <button
        type="button"
        onClick={signInWithApple}
        disabled={busy}
        className="mt-2 flex h-11 w-full items-center justify-center gap-2.5 rounded-full bg-foreground text-sm font-medium text-background shadow-soft transition hover:opacity-90 disabled:opacity-60"
      >
        <AppleMark className="h-4 w-4" />
        Continue with Apple
      </button>

      <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-4">
        {isSignup && (
          <div className="space-y-1.5">
            <Label htmlFor="name">What should we call you?</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="A name, a nickname, anything" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignup ? "new-password" : "current-password"}
          />
          {isSignup && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
        </div>
        <Button type="submit" disabled={busy} className="h-11 w-full rounded-full bg-forest text-primary-foreground hover:opacity-90">
          {busy
            ? "One moment…"
            : isSignup
              ? plan === "plus"
                ? "Start 30-day free trial"
                : "Create free account"
              : "Sign in"}
        </Button>
        {isSignup && plan === "plus" && (
          <p className="text-center text-[11px] text-muted-foreground">
            No card needed today. We'll set up the trial after your first walk.
          </p>
        )}
      </form>

      <p className="mt-5 px-2 text-center font-serif text-xs italic text-muted-foreground">
        Peer support, not therapy. If you're in crisis, call or text 988.
      </p>
    </div>
  );
}
