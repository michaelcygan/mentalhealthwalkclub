import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

function pickPriceId(item: any): string | undefined {
  return (
    item?.price?.lookup_key ||
    item?.price?.metadata?.lovable_external_id ||
    item?.price?.id
  );
}

async function handleSubscriptionUpsert(subscription: any, env: StripeEnv, eventCreated: number) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata");
    return;
  }
  const item = subscription.items?.data?.[0];
  const priceId = pickPriceId(item);
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const eventAtIso = new Date(eventCreated * 1000).toISOString();

  // Kind: 'plus' or 'supporter'. Supporter rows use price_data, so price_id is
  // opaque — we tag the row with subscription_kind from metadata and store the
  // monthly amount. Legacy 'patron' metadata is mapped to 'supporter'.
  const kindMeta = subscription.metadata?.kind;
  const kind: "plus" | "supporter" =
    kindMeta === "supporter" || kindMeta === "patron" ? "supporter" : "plus";
  const unitAmount =
    typeof item?.price?.unit_amount === "number"
      ? item.price.unit_amount
      : kind === "supporter"
        ? Number(subscription.metadata?.amount_cents ?? 0) || null
        : null;
  const normalizedPriceId = kind === "supporter" ? "supporter_custom" : priceId;

  // Out-of-order guard: skip if a newer event has already been applied.
  const { data: existing } = await getSupabase()
    .from("subscriptions")
    .select("last_event_at")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();
  if (existing?.last_event_at && existing.last_event_at > eventAtIso) {
    console.log("Skipping stale event for", subscription.id);
    return;
  }

  // The subscriptions upsert and the supporter_profile mirror touch
  // different tables and don't depend on each other — run in parallel.
  const subUpsert = getSupabase()
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer,
        product_id: productId,
        price_id: normalizedPriceId,
        status: subscription.status,
        current_period_start: periodStart
          ? new Date(periodStart * 1000).toISOString()
          : null,
        current_period_end: periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end || false,
        environment: env,
        subscription_kind: kind,
        monthly_amount_cents: unitAmount,
        last_event_at: eventAtIso,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" },
    );

  let supporterMirror: Promise<unknown> = Promise.resolve();
  if (kind === "supporter") {
    const active = ["active", "trialing", "past_due"].includes(subscription.status);
    if (active) {
      supporterMirror = getSupabase()
        .from("supporter_profile")
        .upsert(
          {
            user_id: userId,
            monthly_amount_cents: unitAmount ?? 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
    } else {
      supporterMirror = getSupabase()
        .from("supporter_profile")
        .update({ monthly_amount_cents: 0, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    }
  }

  await Promise.all([subUpsert, supporterMirror]);
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv, eventCreated: number) {
  const eventAtIso = new Date(eventCreated * 1000).toISOString();
  const { data: existing } = await getSupabase()
    .from("subscriptions")
    .select("last_event_at")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();
  if (existing?.last_event_at && existing.last_event_at > eventAtIso) return;

  await getSupabase()
    .from("subscriptions")
    .update({
      status: "canceled",
      last_event_at: eventAtIso,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
}

// Resolve userId from a subscription/invoice payload (metadata first, then DB lookup).
async function resolveUserId(opts: {
  subscriptionId?: string;
  customerId?: string;
  metadataUserId?: string;
  env: StripeEnv;
}): Promise<string | null> {
  if (opts.metadataUserId) return opts.metadataUserId;
  if (opts.subscriptionId) {
    const { data } = await getSupabase()
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", opts.subscriptionId)
      .eq("environment", opts.env)
      .maybeSingle();
    if (data?.user_id) return data.user_id;
  }
  if (opts.customerId) {
    const { data } = await getSupabase()
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", opts.customerId)
      .eq("environment", opts.env)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.user_id) return data.user_id;
  }
  return null;
}

async function recordBillingEvent(params: {
  userId: string;
  env: StripeEnv;
  eventType: "payment_failed" | "trial_will_end";
  subscriptionId?: string;
  customerId?: string;
  metadata?: Record<string, unknown>;
}) {
  await getSupabase().from("billing_events").insert({
    user_id: params.userId,
    event_type: params.eventType,
    environment: params.env,
    source: "webhook",
    stripe_subscription_id: params.subscriptionId ?? null,
    stripe_customer_id: params.customerId ?? null,
    metadata: params.metadata ?? {},
  });
}

async function handleInvoicePaymentFailed(invoice: any, env: StripeEnv) {
  const subscriptionId = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
  const customerId = invoice.customer;
  const userId = await resolveUserId({
    subscriptionId,
    customerId,
    metadataUserId: invoice.metadata?.userId,
    env,
  });
  if (!userId) {
    console.warn("payment_failed: no userId resolved");
    return;
  }
  await recordBillingEvent({
    userId,
    env,
    eventType: "payment_failed",
    subscriptionId,
    customerId,
    metadata: {
      invoice_id: invoice.id,
      amount_due: invoice.amount_due,
      currency: invoice.currency,
      attempt_count: invoice.attempt_count,
      next_payment_attempt: invoice.next_payment_attempt,
    },
  });
}

async function handleTrialWillEnd(subscription: any, env: StripeEnv) {
  const userId = await resolveUserId({
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    metadataUserId: subscription.metadata?.userId,
    env,
  });
  if (!userId) {
    console.warn("trial_will_end: no userId resolved");
    return;
  }
  await recordBillingEvent({
    userId,
    env,
    eventType: "trial_will_end",
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    metadata: {
      trial_end: subscription.trial_end,
      status: subscription.status,
    },
  });
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  const eventCreated = (event as { created?: number }).created ?? Math.floor(Date.now() / 1000);
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpsert(event.data.object, env, eventCreated);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env, eventCreated);
      break;
    case "customer.subscription.trial_will_end":
      await handleTrialWillEnd(event.data.object, env);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object, env);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook received with invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
