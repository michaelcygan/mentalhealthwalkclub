import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

const PLUS_TRIAL_DAYS = 30;
const SUPPORTER_MIN_CENTS_FALLBACK = 300;
const SUPPORTER_MAX_CENTS = 100_000; // $1,000/mo sanity cap

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

export type PlusPlan = "plus_monthly_v2" | "plus_yearly_v2";

export const createPlusCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { returnUrl: string; environment: StripeEnv; plan?: PlusPlan }) => {
      if (data.plan && data.plan !== "plus_monthly_v2" && data.plan !== "plus_yearly_v2") {
        throw new Error("Invalid plan");
      }
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const plan: PlusPlan = data.plan ?? "plus_monthly_v2";

    // Don't double-subscribe (Plus only — Supporter is a separate row)
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("status, current_period_end, subscription_kind")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .eq("subscription_kind", "plus")
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
      metadata: { userId: userId as string, kind: "plus", managed_payments: "true" },
      subscription_data: {
        trial_period_days: PLUS_TRIAL_DAYS,
        metadata: { userId: userId as string, kind: "plus" },
      },
      managed_payments: { enabled: true },
    } as never);

    return session.client_secret;
  });

export const createSupporterCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { amountCents: number; returnUrl: string; environment: StripeEnv }) => {
      if (
        !Number.isInteger(data.amountCents) ||
        data.amountCents < 100 ||
        data.amountCents > SUPPORTER_MAX_CENTS
      ) {
        throw new Error("Pick an amount between $1 and $1,000");
      }
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: settings } = await supabase
      .from("membership_settings")
      .select("supporter_min_cents, supporter_signups_paused")
      .eq("id", true)
      .maybeSingle();
    if (settings?.supporter_signups_paused) {
      throw new Error("Supporter signups are paused right now. Try again soon.");
    }
    const minCents = settings?.supporter_min_cents ?? SUPPORTER_MIN_CENTS_FALLBACK;
    if (data.amountCents < minCents) {
      throw new Error(`Minimum monthly amount is $${(minCents / 100).toFixed(0)}.`);
    }

    // Block double-subscribe (Supporter only — Plus is independent)
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .eq("subscription_kind", "supporter")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (
      existing &&
      ["trialing", "active", "past_due"].includes(existing.status as string)
    ) {
      throw new Error("You're already a Supporter. Use 'Change amount' in Settings.");
    }

    const stripe = createStripeClient(data.environment);

    const { data: userResp } = await supabase.auth.getUser();
    const email = userResp.user?.email ?? undefined;

    const customerId = await resolveOrCreateCustomer(stripe, {
      email,
      userId: userId as string,
    });

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            // Distinct Stripe Product so Supporter donations are easy to
            // separate from Plus subscriptions in the dashboard + Search API.
            product: "supporter",
            unit_amount: data.amountCents,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      customer: customerId,
      metadata: {
        userId: userId as string,
        kind: "supporter",
        donation: "true",
      },
      subscription_data: {
        description: "Supporter Donation",
        metadata: {
          userId: userId as string,
          kind: "supporter",
          donation: "true",
          amount_cents: String(data.amountCents),
        },
      },
      managed_payments: { enabled: true },
    } as never);

    return session.client_secret;
  });

type PortalFlow = "payment_method_update" | "subscription_cancel" | "subscription_update";

export const createBillingPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      returnUrl?: string;
      environment: StripeEnv;
      flow?: PortalFlow;
      kind?: "plus" | "supporter";
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let q = supabase
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, status, subscription_kind")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data.kind) q = q.eq("subscription_kind", data.kind);
    const { data: sub, error } = await q.maybeSingle();
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
      .eq("subscription_kind", "plus")
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

/** Swap an active monthly Plus subscription to the yearly price, pro-rating immediately. */
export const switchPlusToYearly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id, price_id, status, cancel_at_period_end")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .eq("subscription_kind", "plus")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !sub?.stripe_subscription_id) throw new Error("No active Plus subscription");
    if (sub.price_id === "plus_yearly" || sub.price_id === "plus_yearly_v2") return { ok: true, alreadyYearly: true };
    if (!["trialing", "active", "past_due"].includes(sub.status as string)) {
      throw new Error("Your Plus plan isn't active.");
    }

    const stripe = createStripeClient(data.environment);
    const prices = await stripe.prices.list({ lookup_keys: ["plus_yearly_v2"] });
    if (!prices.data.length) throw new Error("Yearly price not configured");
    const yearlyPrice = prices.data[0];

    const current = await stripe.subscriptions.retrieve(sub.stripe_subscription_id as string);
    const itemId = current.items.data[0]?.id;
    if (!itemId) throw new Error("Subscription item missing");

    await stripe.subscriptions.update(sub.stripe_subscription_id as string, {
      cancel_at_period_end: false,
      proration_behavior: "always_invoice",
      items: [{ id: itemId, price: yearlyPrice.id }],
    });
    return { ok: true, alreadyYearly: false };
  });

/**
 * One-shot read used by use-membership: returns Plus + Supporter state.
 * Wraps the user_membership Postgres helper so RLS is bypassed safely.
 */
export const getMembershipState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows } = await (supabase as never as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
    }).rpc("user_membership", { _user: userId, _env: data.environment });
    const row = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined;
    return {
      isPlus: Boolean(row?.is_plus),
      isSupporter: Boolean(row?.is_supporter),
      supporterCents: Number(row?.supporter_cents ?? 0),
      plusInterval: (row?.plus_interval as "monthly" | "yearly" | null) ?? null,
    };
  });

/** Public read of cap settings — used to size soft caps on the client. */
export const getMembershipSettings = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => data ?? {})
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("membership_settings")
      .select("saved_reads_cap, playlists_cap, collections_follow_cap, supporter_min_cents, supporter_suggested_amounts, supporter_signups_paused")
      .eq("id", true)
      .maybeSingle();
    return data ?? {
      saved_reads_cap: 15,
      playlists_cap: 3,
      collections_follow_cap: 5,
      supporter_min_cents: 300,
      supporter_suggested_amounts: [300, 500, 1000, 2500],
      supporter_signups_paused: false,
    };
  });
