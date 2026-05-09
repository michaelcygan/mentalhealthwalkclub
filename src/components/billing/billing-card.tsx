import { useState } from "react";
import { Sparkles, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/use-subscription";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { createBillingPortalSession } from "@/lib/billing.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { toast } from "sonner";

export function BillingCard() {
  const { loading, isPlus, isTrialing, cancelAtPeriodEnd, currentPeriodEnd, raw } = useSubscription();
  const { openPlusCheckout } = useAuthPrompt();
  const [busy, setBusy] = useState(false);

  if (loading) return null;

  const openPortal = async () => {
    setBusy(true);
    try {
      const url = await createBillingPortalSession({
        data: {
          returnUrl: `${window.location.origin}/profile`,
          environment: getStripeEnvironment(),
        },
      });
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open billing");
    } finally {
      setBusy(false);
    }
  };

  if (!isPlus) {
    return (
      <section className="rounded-3xl border border-forest/30 bg-accent/30 p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <h3 className="font-serif text-lg leading-tight">Walk Club Plus</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Unlimited Walk &amp; Talks, RSVP to in-person Local Walks, early access to new chapters.
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">30 days free, then $4.99/mo. Cancel anytime.</p>
            <Button onClick={openPlusCheckout} className="mt-3 rounded-full bg-forest text-primary-foreground hover:opacity-90">
              Start free trial
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const periodEndStr = currentPeriodEnd
    ? currentPeriodEnd.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;

  let statusLine: string;
  if (raw?.status === "canceled" || cancelAtPeriodEnd) {
    statusLine = `Plus ends ${periodEndStr ?? "soon"}`;
  } else if (isTrialing) {
    statusLine = periodEndStr ? `Free trial — first charge ${periodEndStr}` : "Free trial";
  } else if (raw?.status === "past_due") {
    statusLine = "Payment failed — update your card";
  } else {
    statusLine = periodEndStr ? `Renews ${periodEndStr}` : "Active";
  }

  return (
    <section className="rounded-3xl border border-forest/40 bg-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <h3 className="font-serif text-lg leading-tight">Walk Club Plus</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{statusLine}</p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={openPortal}
            className="mt-3 rounded-full"
          >
            {busy ? "Opening…" : (<>Manage billing <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></>)}
          </Button>
        </div>
      </div>
    </section>
  );
}
