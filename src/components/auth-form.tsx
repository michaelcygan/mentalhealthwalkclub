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
    <svg className={className} viewBox="0 0 384 512" fill="currentColor" aria-hidden="true">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
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
  const [dob, setDob] = useState("");
  const [ageAttest, setAgeAttest] = useState(false);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (isSignup) {
        // Client-side age sanity check. Server is authoritative via confirm_my_date_of_birth.
        const { isPlausibleAdultDob } = await import("@/lib/safety-config");
        if (!ageAttest) {
          toast.error("Please confirm you are at least 18.");
          setBusy(false);
          return;
        }
        if (!isPlausibleAdultDob(dob)) {
          toast.error("Mental Health Walk Club is currently for adults 18 and older.");
          setBusy(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/confirm-age`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (typeof window !== "undefined") {
          window.localStorage.setItem(PLAN_INTENT_KEY, plan);
          // Only a non-sensitive flag; never the DOB itself.
          window.localStorage.setItem("wc_age_gate_started", "1");
        }
        // If a session exists immediately (auto-confirm), record DOB.
        try {
          const { data: sess } = await supabase.auth.getSession();
          if (sess.session) {
            const { confirmMyDateOfBirth } = await import("@/lib/account-eligibility.functions");
            await confirmMyDateOfBirth({ data: { dob } });
          }
        } catch { /* handled at gate */ }
        toast.success("Welcome. Lacing up your walking shoes…");
        onSuccess?.("signup");
        if (!suppressRedirect) navigate({ to: "/confirm-age" });
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
            ? "30 days on us, then $2.99/mo. Unlock unlimited MHWC Radio and help keep the club running. Anything you add on top is designated to the 988 Suicide & Crisis Lifeline. Cancel anytime — no charge until day 30."
            : "Free forever. Post walks, join groups, keep a private journal, and listen to MHWC Radio."
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
              Post walks, join groups, keep a journal, listen to Radio
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
              Free 30 days · then $2.99/mo · Unlimited MHWC Radio · add-ons go to 988
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
        {isSignup && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="dob">Date of birth</Label>
              <Input
                id="dob"
                type="date"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                autoComplete="bday"
              />
              <p className="text-xs text-muted-foreground">
                Mental Health Walk Club is currently for adults 18 and older. Your date of birth stays private.
              </p>
            </div>
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={ageAttest}
                onChange={(e) => setAgeAttest(e.target.checked)}
              />
              <span>
                I confirm I&apos;m at least 18 and this date is accurate.
              </span>
            </label>
          </>
        )}
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
