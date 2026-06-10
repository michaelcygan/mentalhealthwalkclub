import { useState } from "react";
import { Heart, ExternalLink, CreditCard, XCircle, Pencil, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useMembership } from "@/hooks/use-membership";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { createBillingPortalSession } from "@/lib/billing.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { trackBillingEvent } from "@/lib/billing-analytics";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export function SupporterCard() {
  const { loading, isSupporter, supporterCents, supporterStatus } = useMembership();
  const { openSupporterFlow } = useAuthPrompt();
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [displayOnWall, setDisplayOnWall] = useState<boolean | null>(null);

  // Load wall preference lazily once we know we're a supporter
  if (isSupporter && displayOnWall === null && user) {
    supabase
      .from("supporter_profile" as never)
      .select("display_on_wall")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const d = data as unknown as { display_on_wall?: boolean } | null;
        setDisplayOnWall(!!d?.display_on_wall);
      });
  }

  if (loading) return null;

  const openPortal = async (flow: "payment_method_update" | "subscription_cancel" | undefined, key: string) => {
    setBusy(key);
    try {
      const url = await createBillingPortalSession({
        data: {
          returnUrl: `${window.location.origin}/settings`,
          environment: getStripeEnvironment(),
          kind: "supporter",
          ...(flow && { flow }),
        },
      });
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open billing");
    } finally {
      setBusy(null);
    }
  };

  const toggleWall = async (next: boolean) => {
    if (!user) return;
    setDisplayOnWall(next);
    const { error } = await supabase
      .from("supporter_profile" as never)
      .update({ display_on_wall: next } as never)
      .eq("user_id", user.id);
    if (error) {
      setDisplayOnWall(!next);
      toast.error("Couldn't save");
    }
  };

  if (!isSupporter) {
    return (
      <section className="rounded-3xl border border-rose-200 bg-rose-50/40 p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600">
            <Heart className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <h3 className="font-serif text-lg leading-tight">Become a Supporter</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Monthly donation, you pick the amount. 100% of profits go to the 988 Suicide &amp; Crisis Lifeline.
            </p>
            <Button
              onClick={() => {
                void trackBillingEvent("supporter_intent_selected", { source: "settings" });
                openSupporterFlow(500);
              }}
              className="mt-3 rounded-full bg-rose-600 text-white hover:opacity-90"
            >
              Give monthly
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const amount = (supporterCents / 100).toFixed(0);
  const statusLine =
    supporterStatus === "past_due"
      ? "Payment failed — update your card"
      : `Giving $${amount}/month`;

  return (
    <section className="rounded-3xl border border-rose-200 bg-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600">
          <Heart className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <h3 className="font-serif text-lg leading-tight">Supporter</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{statusLine}</p>

          <div className="mt-3 flex items-center justify-between rounded-2xl border border-border bg-background p-3">
            <div className="text-sm">
              <Label htmlFor="supporter-wall" className="font-medium">List me on the Supporter wall</Label>
              <p className="text-[11px] text-muted-foreground">Just your name on /impact. No amounts shown.</p>
            </div>
            <Switch
              id="supporter-wall"
              checked={!!displayOnWall}
              onCheckedChange={toggleWall}
            />
          </div>

          <div className="mt-3 grid gap-2">
            <Button
              variant="outline"
              disabled={busy === "edit"}
              onClick={() => openPortal("subscription_cancel", "edit")}
              className="justify-start rounded-full"
            >
              <Pencil className="mr-2 h-4 w-4" />
              {busy === "edit" ? "Opening…" : "Change amount or cancel"}
              <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            {supporterStatus === "past_due" && (
              <Button
                disabled={busy === "card"}
                onClick={() => openPortal("payment_method_update", "card")}
                className="justify-start rounded-full bg-clay text-primary-foreground hover:opacity-90"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {busy === "card" ? "Opening…" : "Update payment method"}
                <ExternalLink className="ml-auto h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={busy === "portal"}
              onClick={() => openPortal(undefined, "portal")}
              className="justify-start rounded-full text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="mr-2 h-4 w-4" />
              {busy === "portal" ? "Opening…" : "Invoices & receipts"}
              <ExternalLink className="ml-auto h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
