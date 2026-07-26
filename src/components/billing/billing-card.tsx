import { useEffect, useState } from "react";
import { Sparkles, ExternalLink, CreditCard, XCircle, RotateCcw, Settings2, AlertTriangle, Heart, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useMembership } from "@/hooks/use-membership";
import { useAuthPrompt } from "@/lib/auth-prompt";
import {
  createBillingPortalSession,
  resumePlusSubscription,
  updatePlusDonationAmount,
} from "@/lib/billing.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { trackBillingEvent } from "@/lib/billing-analytics";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { PlusAmountPicker } from "@/components/billing/plus-amount-picker";

type Flow = "payment_method_update" | "subscription_cancel" | undefined;

interface BillingNotice {
  id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

export function BillingCard() {
  const {
    loading,
    isPlus,
    donationCents,
    monthlyCents,
    cancelAtPeriodEnd,
    plusCurrentPeriodEnd,
    plusStatus,
    refresh,
  } = useMembership();
  const { openPlusCheckout } = useAuthPrompt();
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<BillingNotice | null>(null);
  const [amountOpen, setAmountOpen] = useState(false);
  const [nextDonation, setNextDonation] = useState(donationCents);

  useEffect(() => setNextDonation(donationCents), [donationCents]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("billing_events" as never)
        .select("id,event_type,metadata,created_at")
        .eq("user_id", user.id)
        .eq("environment", getStripeEnvironment())
        .in("event_type", ["payment_failed"])
        .is("acknowledged_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active) setNotice((data as unknown as BillingNotice) ?? null);
    })();
    return () => {
      active = false;
    };
  }, [user, plusStatus]);

  if (loading) return null;

  const dismissNotice = async () => {
    if (!notice) return;
    const id = notice.id;
    setNotice(null);
    await supabase
      .from("billing_events" as never)
      .update({ acknowledged_at: new Date().toISOString() } as never)
      .eq("id", id);
  };

  const openPortal = async (flow: Flow, key: string) => {
    setBusy(key);
    try {
      void trackBillingEvent(
        flow === "subscription_cancel"
          ? "subscription_cancel_clicked"
          : flow === "payment_method_update"
            ? "payment_method_update_clicked"
            : "billing_portal_opened",
        { flow: flow ?? null },
      );
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
      void trackBillingEvent("subscription_resumed");
      toast.success("Your Plus plan is back on.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't resume plan");
    } finally {
      setBusy(null);
    }
  };

  const saveAmount = async () => {
    setBusy("amount");
    try {
      await updatePlusDonationAmount({
        data: { environment: getStripeEnvironment(), donationCents: nextDonation },
      });
      void trackBillingEvent("plus_amount_updated", { donation_cents: nextDonation });
      toast.success("Amount updated. Applies on your next invoice.");
      setAmountOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update amount");
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
              $2.99/mo keeps Plus running. Every cent above is designated to the 988 Suicide &amp; Crisis Lifeline. Cancel anytime.
            </p>
            <Button
              onClick={() => openPlusCheckout()}
              className="mt-3 rounded-full bg-forest text-primary-foreground hover:opacity-90"
            >
              Join now
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const periodEndStr = plusCurrentPeriodEnd
    ? plusCurrentPeriodEnd.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;
  const endingSoon = plusStatus === "canceled" || cancelAtPeriodEnd;

  let statusLine: string;
  if (endingSoon) statusLine = `Plus ends ${periodEndStr ?? "soon"}`;
  else if (plusStatus === "past_due") statusLine = "Payment failed — update your card";
  else statusLine = periodEndStr ? `Renews ${periodEndStr}` : "Active";

  return (
    <section className="rounded-3xl border border-forest/40 bg-card p-5 shadow-soft">
      {notice && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-clay/50 bg-clay/10 p-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-card">
            <AlertTriangle className="h-4 w-4 text-clay" />
          </span>
          <div className="flex-1 text-sm">
            <div className="font-medium">A recent payment didn't go through.</div>
            <p className="text-muted-foreground">Update your card to keep your Plus access.</p>
          </div>
          <button
            type="button"
            onClick={dismissNotice}
            className="text-xs text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <h3 className="font-serif text-lg leading-tight">Walk Club Plus</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{statusLine}</p>

          <div className="mt-3 rounded-2xl border border-forest/20 bg-accent/20 p-3 text-sm">
            <div className="flex items-baseline justify-between">
              <div className="font-medium">{fmt(monthlyCents)}/mo</div>
              <button
                type="button"
                onClick={() => {
                  setNextDonation(donationCents);
                  setAmountOpen(true);
                }}
                className="inline-flex items-center gap-1 text-[11px] text-forest hover:underline"
              >
                <Pencil className="h-3 w-3" /> Change amount
              </button>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              $2.99 base
              {donationCents > 0 && (
                <>
                  {" + "}
                  <span className="inline-flex items-center gap-1 text-rose-600">
                    <Heart className="h-3 w-3" /> {fmt(donationCents)} to 988
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            {plusStatus === "past_due" && (
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
            {plusStatus !== "past_due" && (
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

      <Dialog open={amountOpen} onOpenChange={setAmountOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border-border bg-card p-6 sm:max-w-md">
          <h3 className="font-serif text-xl">Change your monthly amount</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Applies on your next invoice. The $2.99 base stays the same.
          </p>
          <div className="mt-4">
            <PlusAmountPicker
              value={nextDonation}
              onChange={setNextDonation}
              onConfirm={saveAmount}
              confirmLabel={busy === "amount" ? "Saving…" : "Save"}
            />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
