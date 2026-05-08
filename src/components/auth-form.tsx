import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

interface Props {
  defaultMode?: "signin" | "signup";
  onSuccess?: (mode: "signin" | "signup") => void;
  /** When true, skip the default navigate-to-/welcome on signup success. */
  suppressRedirect?: boolean;
}

export function AuthForm({ defaultMode = "signup", onSuccess, suppressRedirect = false }: Props) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/welcome`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Welcome. Lacing up your walking shoes…");
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
      <h2 className="font-serif text-2xl text-foreground">
        {mode === "signup" ? "Come walk with us" : "Welcome back"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {mode === "signup" ? "Take the walk. Let it count." : "Lace up. Let's go."}
      </p>

      <form onSubmit={submit} className="mt-5 space-y-4">
        {mode === "signup" && (
          <div className="space-y-1.5">
            <Label htmlFor="name">What should we call you?</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="A name, a nickname, anything" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" disabled={busy} className="w-full rounded-full bg-forest text-primary-foreground hover:opacity-90">
          {busy ? "One moment…" : mode === "signup" ? "Begin walking" : "Sign in"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        className="mt-5 w-full text-center text-sm text-muted-foreground transition hover:text-foreground"
      >
        {mode === "signup" ? "Already a walker? Sign in" : "New here? Create an account"}
      </button>

      <p className="mt-5 px-2 text-center font-serif text-xs italic text-muted-foreground">
        Peer support, not therapy. If you are in crisis, call or text 988.
      </p>
    </div>
  );
}
