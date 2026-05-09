import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

const PLUS_TRIAL_DAYS = 30;

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export type PlusPlan = "plus_monthly" | "plus_yearly";

export const createPlusCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { returnUrl: string; environment: StripeEnv; plan?: PlusPlan }) => {
      if (data.plan && data.plan !== "plus_monthly" && data.plan !== "plus_yearly") {
        throw new Error("Invalid plan");
      }
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const plan: PlusPlan = data.plan ?? "plus_monthly";

    // Don't double-subscribe
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (
      existing &&
      ["trialing", "active", "past_due"].includes(existing.status as string)
    ) {
      throw new Error("You're already on Plus.");
    }

    const stripe = createStripeClient(data.environment);

    const prices = await stripe.prices.list({ lookup_keys: [plan] });
    if (!prices.data.length) throw new Error("Plus price not configured");
    const stripePrice = prices.data[0];

    const { data: userResp } = await supabase.auth.getUser();
    const email = userResp.user?.email ?? undefined;

    const customerId = await resolveOrCreateCustomer(stripe, {
      email,
      userId: userId as string,
    });

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: "subscription",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      customer: customerId,
      metadata: { userId: userId as string, managed_payments: "true" },
      subscription_data: {
        trial_period_days: PLUS_TRIAL_DAYS,
        metadata: { userId: userId as string },
      },
      // Full compliance handling — Stripe acts as merchant of record (tax + fraud + disputes + support).
      managed_payments: { enabled: true },
    } as any);

    return session.client_secret;
  });

type PortalFlow = "payment_method_update" | "subscription_cancel" | "subscription_update";

export const createBillingPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { returnUrl?: string; environment: StripeEnv; flow?: PortalFlow }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, status")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !sub?.stripe_customer_id) throw new Error("No subscription found");

    const stripe = createStripeClient(data.environment);

    let flowData: Record<string, unknown> | undefined;
    if (data.flow && sub.stripe_subscription_id) {
      if (data.flow === "payment_method_update") {
        flowData = { type: "payment_method_update" };
      } else if (data.flow === "subscription_cancel") {
        flowData = {
          type: "subscription_cancel",
          subscription_cancel: { subscription: sub.stripe_subscription_id },
        };
      } else if (data.flow === "subscription_update") {
        flowData = {
          type: "subscription_update",
          subscription_update: { subscription: sub.stripe_subscription_id },
        };
      }
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id as string,
      ...(data.returnUrl && { return_url: data.returnUrl }),
      ...(flowData && { flow_data: flowData as never }),
    });
    return portal.url;
  });

export const resumePlusSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id, status, cancel_at_period_end")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !sub?.stripe_subscription_id) throw new Error("No subscription found");
    if (!sub.cancel_at_period_end) return { ok: true, alreadyActive: true };

    const stripe = createStripeClient(data.environment);
    await stripe.subscriptions.update(sub.stripe_subscription_id as string, {
      cancel_at_period_end: false,
    });
    return { ok: true, alreadyActive: false };
  });
