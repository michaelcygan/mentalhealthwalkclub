import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

const BASE_CENTS = 299;
const MAX_DONATION_CENTS = 100_000; // $1,000/mo sanity cap
const BASE_LOOKUP = "plus_monthly_v2";
const DONATION_LOOKUP = "plus_donation_stub";

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

/** Resolves the Stripe Product IDs for base ($2.99) and donation via lookup keys. */
async function resolveProducts(stripe: ReturnType<typeof createStripeClient>) {
  const [base, donation] = await Promise.all([
    stripe.prices.list({ lookup_keys: [BASE_LOOKUP] }),
    stripe.prices.list({ lookup_keys: [DONATION_LOOKUP] }),
  ]);
  const basePrice = base.data[0];
  const donationPrice = donation.data[0];
  if (!basePrice) throw new Error("Plus base price not configured");
  if (!donationPrice) throw new Error("Plus donation product not configured");
  const baseProduct = typeof basePrice.product === "string" ? basePrice.product : basePrice.product.id;
  const donationProduct =
    typeof donationPrice.product === "string" ? donationPrice.product : donationPrice.product.id;
  return { basePriceId: basePrice.id, baseProduct, donationProduct };
}

export const createPlusCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { returnUrl: string; environment: StripeEnv; donationCents?: number }) => {
      const donation = data.donationCents ?? 0;
      if (!Number.isInteger(donation) || donation < 0 || donation > MAX_DONATION_CENTS) {
        throw new Error("Invalid donation amount");
      }
      return { ...data, donationCents: donation };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const donationCents = data.donationCents ?? 0;

    // Don't double-subscribe
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
    const { basePriceId, donationProduct } = await resolveProducts(stripe);

    const { data: userResp } = await supabase.auth.getUser();
    const email = userResp.user?.email ?? undefined;

    const customerId = await resolveOrCreateCustomer(stripe, {
      email,
      userId: userId as string,
    });

    const lineItems: Array<Record<string, unknown>> = [
      { price: basePriceId, quantity: 1 },
    ];
    if (donationCents > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product: donationProduct,
          unit_amount: donationCents,
          recurring: { interval: "month" },
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      line_items: lineItems as never,
      mode: "subscription",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      customer: customerId,
      metadata: {
        userId: userId as string,
        kind: "plus",
        base_cents: String(BASE_CENTS),
        donation_cents: String(donationCents),
      },
      subscription_data: {
        metadata: {
          userId: userId as string,
          kind: "plus",
          base_cents: String(BASE_CENTS),
          donation_cents: String(donationCents),
        },
      },
      managed_payments: { enabled: true },
    } as never);

    return session.client_secret;
  });

/** Adjust the donation line item on an existing active Plus subscription. */
export const updatePlusDonationAmount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv; donationCents: number }) => {
    if (
      !Number.isInteger(data.donationCents) ||
      data.donationCents < 0 ||
      data.donationCents > MAX_DONATION_CENTS
    ) {
      throw new Error("Invalid donation amount");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id, status")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .eq("subscription_kind", "plus")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !sub?.stripe_subscription_id) throw new Error("No active Plus subscription");
    if (!["trialing", "active", "past_due"].includes(sub.status as string)) {
      throw new Error("Your Plus plan isn't active.");
    }

    const stripe = createStripeClient(data.environment);
    const { donationProduct } = await resolveProducts(stripe);
    const current = await stripe.subscriptions.retrieve(sub.stripe_subscription_id as string, {
      expand: ["items.data.price"],
    });

    const donationItem = current.items.data.find((it) => {
      const p = it.price?.product;
      const productId = typeof p === "string" ? p : p?.id;
      return productId === donationProduct;
    });

    const items: Array<Record<string, unknown>> = [];
    if (donationItem && data.donationCents > 0) {
      // Update in place with a new inline price
      items.push({
        id: donationItem.id,
        price_data: {
          currency: "usd",
          product: donationProduct,
          unit_amount: data.donationCents,
          recurring: { interval: "month" },
        },
      });
    } else if (donationItem && data.donationCents === 0) {
      // Remove the donation line
      items.push({ id: donationItem.id, deleted: true });
    } else if (!donationItem && data.donationCents > 0) {
      // Add a donation line
      items.push({
        price_data: {
          currency: "usd",
          product: donationProduct,
          unit_amount: data.donationCents,
          recurring: { interval: "month" },
        },
        quantity: 1,
      });
    } else {
      // No donation before, no donation now — nothing to do
      return { ok: true, unchanged: true };
    }

    await stripe.subscriptions.update(sub.stripe_subscription_id as string, {
      cancel_at_period_end: false,
      proration_behavior: "always_invoice",
      items: items as never,
      metadata: {
        ...(current.metadata ?? {}),
        base_cents: String(BASE_CENTS),
        donation_cents: String(data.donationCents),
      },
    });
    return { ok: true, unchanged: false };
  });

type PortalFlow = "payment_method_update" | "subscription_cancel" | "subscription_update";

export const createBillingPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      returnUrl?: string;
      environment: StripeEnv;
      flow?: PortalFlow;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, status, subscription_kind")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .eq("subscription_kind", "plus")
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

/**
 * One-shot read used by use-membership: returns Plus base + donation.
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
    const donationCents = Number(row?.supporter_cents ?? 0);
    return {
      isPlus: Boolean(row?.is_plus),
      donationCents,
      monthlyCents: Boolean(row?.is_plus) ? BASE_CENTS + donationCents : 0,
    };
  });

/** Public read of cap settings. */
export const getMembershipSettings = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => data ?? {})
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("membership_settings")
      .select("saved_reads_cap, playlists_cap, collections_follow_cap")
      .eq("id", true)
      .maybeSingle();
    return data ?? {
      saved_reads_cap: 15,
      playlists_cap: 3,
      collections_follow_cap: 5,
    };
  });
