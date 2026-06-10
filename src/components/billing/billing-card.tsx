import { useEffect, useState } from "react";
import { Sparkles, ExternalLink, CreditCard, XCircle, RotateCcw, Settings2, AlertTriangle, Clock, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/use-subscription";
import { useMembership } from "@/hooks/use-membership";
import { useAuthPrompt } from "@/lib/auth-prompt";
import {
  createBillingPortalSession,
  resumePlusSubscription,
  switchPlusToYearly,
} from "@/lib/billing.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { trackBillingEvent } from "@/lib/billing-analytics";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { SwitchToYearlyDialog } from "@/components/billing/plan-picker";

type Flow = "payment_method_update" | "subscription_cancel" | "subscription_update" | undefined;

interface BillingNotice {
  id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function BillingCard() {
  const { loading, isPlus, isTrialing, cancelAtPeriodEnd, currentPeriodEnd, raw, refresh } = useSubscription();
  const { plusInterval, refresh: refreshMembership } = useMembership();
  const { openPlusCheckout } = useAuthPrompt();
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<BillingNotice | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("billing_events" as never)
        .select("id,event_type,metadata,created_at")
        .eq("user_id", user.id)
        .eq("environment", getStripeEnvironment())
        .in("event_type", ["payment_failed", "trial_will_end"])
        .is("acknowledged_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active) setNotice((data as unknown as BillingNotice) ?? null);
    })();
    return () => { active = false; };
  }, [user, raw?.status]);

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
        flow === "subscription_cancel" ? "subscription_cancel_clicked"
          : flow === "payment_method_update" ? "payment_method_update_clicked"
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

  const switchYearly = async () => {
    setBusy("switch");
    try {
      const r = await switchPlusToYearly({ data: { environment: getStripeEnvironment() } });
      void trackBillingEvent("plan_switch_yearly_completed");
      toast.success(r.alreadyYearly ? "You're already on yearly." : "Switched to yearly. Thank you!");
      setSwitchOpen(false);
      await Promise.all([refresh(), refreshMembership()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't switch plans");
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
              Walk more, scroll less. Plus opens up unlimited circles to invite friends on a mental health walk, a shareable page for every walk you host, and the full Listen library — calming playlists, podcasts, and reads for the trail.
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">$1.99/month, 30-day free trial. Half of every dollar goes straight to the 988 Suicide &amp; Crisis Lifeline. Cancel anytime.</p>
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

  const periodEndStr = currentPeriodEnd
    ? currentPeriodEnd.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;
  const status = raw?.status;
  const endingSoon = status === "canceled" || cancelAtPeriodEnd;

  let statusLine: string;
  if (endingSoon) statusLine = `Plus ends ${periodEndStr ?? "soon"}`;
  else if (isTrialing) statusLine = periodEndStr ? `Free trial — first charge ${periodEndStr}` : "Free trial";
  else if (status === "past_due") statusLine = "Payment failed — update your card";
  else statusLine = periodEndStr ? `Renews ${periodEndStr}` : "Active";

  return (
    <section className="rounded-3xl border border-forest/40 bg-card p-5 shadow-soft">
      {notice && (
        <div className={`mb-4 flex items-start gap-3 rounded-2xl border p-3 ${notice.event_type === "payment_failed" ? "border-clay/50 bg-clay/10" : "border-forest/40 bg-accent/40"}`}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-card">
            {notice.event_type === "payment_failed" ? <AlertTriangle className="h-4 w-4 text-clay" /> : <Clock className="h-4 w-4 text-forest" />}
          </span>
          <div className="flex-1 text-sm">
            {notice.event_type === "payment_failed" ? (
              <>
                <div className="font-medium">A recent payment didn't go through.</div>
                <p className="text-muted-foreground">Update your card to keep your Plus access.</p>
              </>
            ) : (
              <>
                <div className="font-medium">Your free trial ends soon.</div>
                <p className="text-muted-foreground">First charge on {periodEndStr ?? "your renewal date"}.</p>
              </>
            )}
          </div>
          <button type="button" onClick={dismissNotice} className="text-xs text-muted-foreground hover:text-foreground" aria-label="Dismiss">Dismiss</button>
        </div>
      )}

      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <h3 className="font-serif text-lg leading-tight">Walk Club Plus</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{statusLine}</p>
          <div className="mt-4 grid gap-2">
            {plusInterval === "monthly" && !endingSoon && status !== "past_due" && (
              <Button
                onClick={() => {
                  void trackBillingEvent("plan_switch_yearly_clicked");
                  setSwitchOpen(true);
                }}
                className="justify-start rounded-full bg-forest text-primary-foreground hover:opacity-90"
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Switch to yearly — save $4.88
              </Button>
            )}
            {status === "past_due" && (
              <Button disabled={busy === "card"} onClick={() => openPortal("payment_method_update", "card")} className="justify-start rounded-full bg-clay text-primary-foreground hover:opacity-90">
                <CreditCard className="mr-2 h-4 w-4" />
                {busy === "card" ? "Opening…" : "Update payment method"}
                <ExternalLink className="ml-auto h-3.5 w-3.5" />
              </Button>
            )}
            {endingSoon ? (
              <Button disabled={busy === "resume"} onClick={resume} className="justify-start rounded-full bg-forest text-primary-foreground hover:opacity-90">
                <RotateCcw className="mr-2 h-4 w-4" />
                {busy === "resume" ? "Resuming…" : "Resume my plan"}
              </Button>
            ) : (
              <Button variant="outline" disabled={busy === "cancel"} onClick={() => openPortal("subscription_cancel", "cancel")} className="justify-start rounded-full">
                <XCircle className="mr-2 h-4 w-4" />
                {busy === "cancel" ? "Opening…" : "Cancel plan"}
                <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}
            {status !== "past_due" && (
              <Button variant="outline" disabled={busy === "card"} onClick={() => openPortal("payment_method_update", "card")} className="justify-start rounded-full">
                <CreditCard className="mr-2 h-4 w-4" />
                {busy === "card" ? "Opening…" : "Update payment method"}
                <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}
            <Button variant="ghost" disabled={busy === "portal"} onClick={() => openPortal(undefined, "portal")} className="justify-start rounded-full text-muted-foreground hover:text-foreground">
              <Settings2 className="mr-2 h-4 w-4" />
              {busy === "portal" ? "Opening…" : "Invoices & full billing settings"}
              <ExternalLink className="ml-auto h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
      <SwitchToYearlyDialog
        open={switchOpen}
        onOpenChange={setSwitchOpen}
        onConfirm={switchYearly}
        loading={busy === "switch"}
      />
    </section>
  );
}
