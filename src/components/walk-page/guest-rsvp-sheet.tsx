import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  code: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultStatus?: "going" | "maybe" | "declined";
  refParam?: string | null;
  onSuccess?: () => void;
}

export function GuestRsvpSheet({ code, open, onOpenChange, defaultStatus = "going", refParam, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email please.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/public/walk/${encodeURIComponent(code)}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          status: defaultStatus,
          ref: refParam ?? null,
          website,
        }),
      });
      if (r.status === 429) {
        toast.error("Slow down — try again in a minute.");
        return;
      }
      if (!r.ok) {
        const t = await r.json().catch(() => ({}));
        throw new Error(t.error ?? "Couldn't RSVP");
      }
      toast.success("You're in. We'll send a reminder.");
      try {
        localStorage.setItem(`walk-rsvp:${code}`, JSON.stringify({ name: name.trim(), email: email.trim(), status: defaultStatus }));
      } catch {}
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="font-serif text-2xl">RSVP without an account</SheetTitle>
          <SheetDescription>
            Just a name + email so the host knows who's coming. No password, no spam.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} className="mt-4 space-y-3 pb-6">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Your name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="River" maxLength={80} autoFocus />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@walkclub.com"
              maxLength={255}
              autoComplete="email"
            />
          </div>
          {/* honeypot — hidden from humans, visible to bots */}
          <input
            type="text"
            tabIndex={-1}
            aria-hidden="true"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            style={{ position: "absolute", left: "-10000px", width: 1, height: 1, opacity: 0 }}
            autoComplete="off"
          />
          <Button type="submit" disabled={busy} className="w-full rounded-full bg-forest text-primary-foreground">
            {busy ? "Sending…" : "I'm in"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            By RSVPing you accept the walk safety basics. Hosts can see your name and email.
          </p>
        </form>
      </SheetContent>
    </Sheet>
  );
}
