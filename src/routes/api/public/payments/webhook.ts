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

  await getSupabase()
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer,
        product_id: productId,
        price_id: priceId,
        status: subscription.status,
        current_period_start: periodStart
          ? new Date(periodStart * 1000).toISOString()
          : null,
        current_period_end: periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end || false,
        environment: env,
        last_event_at: eventAtIso,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" },
    );
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
