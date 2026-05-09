import { useState } from "react";
import { Sparkles, ExternalLink, CreditCard, XCircle, RotateCcw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/use-subscription";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { createBillingPortalSession, resumePlusSubscription } from "@/lib/billing.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { toast } from "sonner";

type Flow = "payment_method_update" | "subscription_cancel" | "subscription_update" | undefined;

export function BillingCard() {
  const { loading, isPlus, isTrialing, cancelAtPeriodEnd, currentPeriodEnd, raw, refresh } = useSubscription();
  const { openPlusCheckout } = useAuthPrompt();
  const [busy, setBusy] = useState<string | null>(null);

  if (loading) return null;

  const openPortal = async (flow: Flow, key: string) => {
    setBusy(key);
    try {
      const url = await createBillingPortalSession({
        data: {
          returnUrl: `${window.location.origin}/profile`,
          environment: getStripeEnvironment(),
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

  const resume = async () => {
    setBusy("resume");
    try {
      await resumePlusSubscription({ data: { environment: getStripeEnvironment() } });
      toast.success("Your Plus plan is back on.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't resume plan");
    } finally {
      setBusy(null);
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

  const status = raw?.status;
  const endingSoon = status === "canceled" || cancelAtPeriodEnd;

  let statusLine: string;
  if (endingSoon) {
    statusLine = `Plus ends ${periodEndStr ?? "soon"}`;
  } else if (isTrialing) {
    statusLine = periodEndStr ? `Free trial — first charge ${periodEndStr}` : "Free trial";
  } else if (status === "past_due") {
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

          <div className="mt-4 grid gap-2">
            {status === "past_due" && (
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

            {endingSoon ? (
              <Button
                disabled={busy === "resume"}
                onClick={resume}
                className="justify-start rounded-full bg-forest text-primary-foreground hover:opacity-90"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {busy === "resume" ? "Resuming…" : "Resume my plan"}
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={busy === "cancel"}
                onClick={() => openPortal("subscription_cancel", "cancel")}
                className="justify-start rounded-full"
              >
                <XCircle className="mr-2 h-4 w-4" />
                {busy === "cancel" ? "Opening…" : "Cancel plan"}
                <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}

            {status !== "past_due" && (
              <Button
                variant="outline"
                disabled={busy === "card"}
                onClick={() => openPortal("payment_method_update", "card")}
                className="justify-start rounded-full"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {busy === "card" ? "Opening…" : "Update payment method"}
                <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}

            <Button
              variant="ghost"
              disabled={busy === "portal"}
              onClick={() => openPortal(undefined, "portal")}
              className="justify-start rounded-full text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="mr-2 h-4 w-4" />
              {busy === "portal" ? "Opening…" : "Invoices & full billing settings"}
              <ExternalLink className="ml-auto h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
