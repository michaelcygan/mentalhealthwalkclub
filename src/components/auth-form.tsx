import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Footprints, Sparkles } from "lucide-react";

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
            emailRedirectTo: `${window.location.origin}/welcome`,
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
        if (!suppressRedirect) navigate({ to: "/welcome" });
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
            ? "30 days on us, then $4.99/mo. Cancel anytime — no charge until day 30."
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
              Free 30 days · then $4.99/mo · Local Walk RSVPs
            </span>
          </button>
        </div>
      )}

      <form onSubmit={submit} className="mt-5 space-y-4">
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
