import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AuthForm } from "@/components/auth-form";
import { LogoStamp } from "@/components/logo-stamp";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — Mental Health Walk Club" }] }),
});

function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  return (
    <div className="min-h-screen gradient-warm">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-forest shadow-soft">
            <Footprints className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-serif text-2xl leading-tight text-foreground">Mental Health Walk Club</h1>
            <p className="text-xs text-muted-foreground">You don't have to walk through it alone.</p>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-7 shadow-elevated">
          <AuthForm defaultMode="signup" />
        </div>
      </div>
    </div>
  );
}
