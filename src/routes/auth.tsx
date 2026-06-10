import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AuthForm, type AuthPlan } from "@/components/auth-form";
import { LogoStamp } from "@/components/logo-stamp";
import { Footprints, Headphones, Mic, MapPin } from "lucide-react";

interface AuthSearch {
  mode?: "signin" | "signup";
  plan?: AuthPlan;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    mode: s.mode === "signin" || s.mode === "signup" ? s.mode : undefined,
    plan: s.plan === "plus" || s.plan === "free" ? s.plan : undefined,
  }),
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — Mental Health Walk Club" },
      {
        name: "description",
        content:
          "Join the Mental Health Walk Club. Solo, Guided, Walk & Talk, and in-person Local Walks. Free forever — Plus is $2.99/mo with a 30-day free trial, and half of every Plus dollar goes to the 988 Suicide & Crisis Lifeline.",
      },
    ],
  }),
});

function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { mode, plan } = useSearch({ from: "/auth" });

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 lg:grid-cols-2">
        {/* Brand panel */}
        <div className="gradient-warm relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
          <div className="relative flex items-center gap-3">
            <LogoStamp tone="dark" size={52} />
            <div>
              <h1 className="font-serif text-xl text-foreground">Mental Health Walk Club</h1>
              <p className="text-xs text-muted-foreground">Movement is the medicine.</p>
            </div>
          </div>

          <div className="relative">
            <p className="font-serif text-3xl leading-tight text-foreground">
              "I came for the walk. I stayed because someone was on the other end of it."
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <PanelTile icon={Footprints} label="Solo" sub="Unlimited" />
              <PanelTile icon={Headphones} label="Guided" sub="Unlimited" />
              <PanelTile icon={Mic} label="Walk & Talk" sub="Live rooms" />
              <PanelTile icon={MapPin} label="Local Walks" sub="In-person" />
            </div>
          </div>

          <p className="relative font-serif text-xs italic text-muted-foreground">
            Peer support, not therapy. If you're in crisis, call or text 988.
          </p>
        </div>

        {/* Form panel */}
        <div className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <LogoStamp tone="dark" size={44} />
              <div>
                <h1 className="font-serif text-lg text-foreground">Mental Health Walk Club</h1>
                <p className="text-[11px] text-muted-foreground">Movement is the medicine.</p>
              </div>
            </div>
            <div className="rounded-3xl border border-border bg-card p-7 shadow-elevated">
              <AuthForm defaultMode={mode ?? "signup"} defaultPlan={plan ?? "free"} />
            </div>
            <p className="mt-4 text-center text-[11px] text-muted-foreground">
              In crisis? <Link to="/support" className="underline hover:text-foreground">Get support</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelTile({ icon: Icon, label, sub }: { icon: typeof Footprints; label: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-3 backdrop-blur-sm">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
        <Icon className="h-4 w-4 text-forest" />
      </div>
      <div className="mt-2 text-sm font-medium text-foreground">{label}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}
