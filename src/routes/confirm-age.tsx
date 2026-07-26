import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { confirmMyDateOfBirth } from "@/lib/account-eligibility.functions";
import { isPlausibleAdultDob } from "@/lib/safety-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoStamp } from "@/components/logo-stamp";
import { toast } from "sonner";

export const Route = createFileRoute("/confirm-age")({
  component: ConfirmAgePage,
  head: () => ({
    meta: [
      { title: "Confirm your age — Mental Health Walk Club" },
      { name: "description", content: "Mental Health Walk Club is currently for adults 18 and older. Your date of birth stays private." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ConfirmAgePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [dob, setDob] = useState("");
  const [attest, setAttest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const confirm = useServerFn(confirmMyDateOfBirth);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!attest) {
      toast.error("Please confirm the date is accurate.");
      return;
    }
    if (!isPlausibleAdultDob(dob)) {
      // Don't leak whether it's format vs age here — server is authoritative.
      setBlocked(true);
      return;
    }
    setBusy(true);
    try {
      const result = await confirm({ data: { dob } });
      if (result.eligibilityStatus === "adult_active") {
        toast.success("You're all set. Welcome to Mental Health Walk Club.");
        navigate({ to: "/" });
      } else {
        setBlocked(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (/already confirmed/i.test(msg)) {
        toast.error("Your date of birth has already been recorded. Contact support if it was entered incorrectly.");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth" });
  }

  async function handleDelete() {
    if (!user) return;
    if (!confirm_dialog("Delete this account? This cannot be undone.")) return;
    try {
      await supabase.auth.signOut();
      navigate({ to: "/" });
    } catch {
      /* noop */
    }
  }

  if (blocked) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 py-12 text-center">
        <LogoStamp tone="dark" size={56} />
        <h1 className="mt-6 font-serif text-2xl text-foreground">
          We can&apos;t provide account access at this time
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Mental Health Walk Club is currently available only to people 18 and older.
          Thank you for your interest.
        </p>
        <div className="mt-8 flex w-full flex-col gap-2">
          <Button onClick={handleSignOut} className="w-full rounded-full">Sign out</Button>
          <button onClick={handleDelete} className="text-xs text-muted-foreground underline hover:text-foreground">
            Delete this account
          </button>
        </div>
        <p className="mt-8 font-serif text-xs italic text-muted-foreground">
          If you&apos;re in crisis, call or text 988.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <div className="flex items-center gap-3">
        <LogoStamp tone="dark" size={44} />
        <div>
          <h1 className="font-serif text-lg text-foreground">Confirm your age</h1>
          <p className="text-[11px] text-muted-foreground">18+ community</p>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-elevated">
        <p className="text-sm text-muted-foreground">
          Mental Health Walk Club is currently for adults 18 and older. Your date of birth
          is kept private and used only to confirm eligibility and maintain an adult-only
          community. It&apos;s never displayed publicly.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-4">
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
          </div>

          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={attest}
              onChange={(e) => setAttest(e.target.checked)}
            />
            <span>
              I confirm that I am at least 18 and that this date is accurate. I&apos;ve read
              the{" "}
              <Link to="/terms" className="underline hover:text-foreground">Terms</Link>{" "}
              and{" "}
              <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
            </span>
          </label>

          <Button
            type="submit"
            disabled={busy || !dob || !attest}
            className="h-11 w-full rounded-full bg-forest text-primary-foreground hover:opacity-90"
          >
            {busy ? "One moment…" : "Continue"}
          </Button>
        </form>

        <button
          onClick={handleSignOut}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Sign out
        </button>
      </div>

      <p className="mt-6 text-center font-serif text-xs italic text-muted-foreground">
        Peer support, not therapy. If you&apos;re in crisis, call or text 988.
      </p>
    </div>
  );
}

function confirm_dialog(msg: string) {
  if (typeof window === "undefined") return false;
  return window.confirm(msg);
}
