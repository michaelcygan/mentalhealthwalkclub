import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

const BASE_LOOKUP = "plus_monthly_v2";
const BASE_CENTS = 299;

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

/** Split subscription items into base (Plus $2.99) and donation lines. */
function splitItems(subscription: any) {
  const items: any[] = subscription.items?.data ?? [];
  const base = items.find((it) => it?.price?.lookup_key === BASE_LOOKUP) ?? items[0];
  const donation = items.find((it) => it && it !== base) ?? null;
  const donationCents =
    typeof donation?.price?.unit_amount === "number" ? donation.price.unit_amount : 0;
  return { base, donation, donationCents };
}

async function handleSubscriptionUpsert(
  subscription: any,
  env: StripeEnv,
  eventCreated: number,
) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata");
    return;
  }

  const { base, donation, donationCents } = splitItems(subscription);
  const priceId = pickPriceId(base);
  const productId = base?.price?.product;
  const periodStart = base?.current_period_start ?? subscription.current_period_start;
  const periodEnd = base?.current_period_end ?? subscription.current_period_end;
  const eventAtIso = new Date(eventCreated * 1000).toISOString();
  const monthlyCents = BASE_CENTS + donationCents;

  // Out-of-order guard
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
        subscription_kind: "plus",
        monthly_amount_cents: monthlyCents,
        selected_total_cents: monthlyCents,
        base_cents: BASE_CENTS,
        donation_cents_monthly: donationCents,
        membership_allocation_cents: BASE_CENTS,
        donation_allocation_cents: donationCents,
        stripe_base_item_id: base?.id ?? null,
        stripe_donation_item_id: donation?.id ?? null,
        allocation_model_version: "v2_unified",
        last_event_at: eventAtIso,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" },
    );
}

async function handleSubscriptionDeleted(
  subscription: any,
  env: StripeEnv,
  eventCreated: number,
) {
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

/**
 * Write an immutable ledger row splitting the invoice into base + donation.
 * Idempotent via `stripe_event_id` unique constraint.
 */
async function handleInvoicePaid(
  invoice: any,
  env: StripeEnv,
  eventId: string,
  eventCreated: number,
) {
  const gross = Number(invoice.amount_paid ?? 0);
  if (!gross || gross <= 0) return; // trial/$0 invoices — nothing to allocate

  const subscriptionId =
    invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
  const customerId = invoice.customer;

  const userId = await resolveUserId({
    subscriptionId,
    customerId,
    metadataUserId: invoice.metadata?.userId,
    env,
  });

  // Load subscription row for dedication + display fields (PII stays there;
  // we copy the display-safe slice onto the immutable ledger row).
  let subRow: any = null;
  if (subscriptionId) {
    const { data } = await getSupabase()
      .from("subscriptions")
      .select(
        "user_id, dedication_type, honoree_name, dedication_message, public_donor_name, display_donation_publicly, donation_cents_monthly, base_cents",
      )
      .eq("stripe_subscription_id", subscriptionId)
      .eq("environment", env)
      .maybeSingle();
    subRow = data;
  }

  const baseCents = subRow?.base_cents ?? BASE_CENTS;
  const membership = Math.min(baseCents, gross);
  const donation = Math.max(0, gross - membership);

  const paidAtSec =
    invoice.status_transitions?.paid_at ??
    invoice.effective_at ??
    invoice.created ??
    eventCreated;

  const payload = {
    source: donation > 0 ? "plus_overage" : "legacy_plus_commitment",
    user_id: userId ?? subRow?.user_id ?? null,
    environment: env,
    currency: (invoice.currency ?? "usd").toLowerCase(),
    stripe_event_id: eventId,
    stripe_invoice_id: invoice.id ?? null,
    stripe_payment_intent_id: invoice.payment_intent ?? null,
    stripe_charge_id: invoice.charge ?? null,
    stripe_subscription_id: subscriptionId ?? null,
    gross_payment_cents: gross,
    membership_allocation_cents: membership,
    donation_allocation_cents: donation,
    status: "designated",
    paid_at: new Date(paidAtSec * 1000).toISOString(),
    dedication_type: subRow?.dedication_type ?? "none",
    honoree_name: subRow?.honoree_name ?? null,
    dedication_message: subRow?.dedication_message ?? null,
    public_donor_name: subRow?.public_donor_name ?? null,
    display_publicly: !!subRow?.display_donation_publicly,
  };

  const { error } = await getSupabase()
    .from("donation_allocations")
    .upsert(payload, { onConflict: "stripe_event_id", ignoreDuplicates: true });
  if (error) console.error("donation_allocations upsert failed", error);
}

async function handleChargeRefunded(charge: any, env: StripeEnv) {
  const chargeId = charge.id;
  if (!chargeId) return;
  const amount = Number(charge.amount ?? 0);
  const refunded = Number(charge.amount_refunded ?? 0);
  const fullRefund = refunded >= amount && amount > 0;

  const { data: rows } = await getSupabase()
    .from("donation_allocations")
    .select("id, transfer_batch_id, status")
    .eq("stripe_charge_id", chargeId)
    .eq("environment", env);
  const list = (rows as Array<{ id: string; transfer_batch_id: string | null; status: string }>) ?? [];
  for (const row of list) {
    if (row.transfer_batch_id) {
      console.warn(
        "Refund on allocation already in transfer batch — leaving status; admin flow handles clawback",
        row.id,
      );
      continue;
    }
    await getSupabase()
      .from("donation_allocations")
      .update({
        status: fullRefund ? "refunded" : "partially_refunded",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  }
}

async function handleDisputeCreated(dispute: any, env: StripeEnv) {
  const chargeId = dispute.charge;
  if (!chargeId) return;
  const { data: rows } = await getSupabase()
    .from("donation_allocations")
    .select("id, transfer_batch_id")
    .eq("stripe_charge_id", chargeId)
    .eq("environment", env);
  const list = (rows as Array<{ id: string; transfer_batch_id: string | null }>) ?? [];
  for (const row of list) {
    if (row.transfer_batch_id) {
      console.warn("Dispute on allocation already in transfer batch", row.id);
      continue;
    }
    await getSupabase()
      .from("donation_allocations")
      .update({ status: "disputed", updated_at: new Date().toISOString() })
      .eq("id", row.id);
  }
}

async function handleInvoicePaymentFailed(invoice: any, env: StripeEnv) {
  const subscriptionId =
    invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
  const customerId = invoice.customer;
  const userId = await resolveUserId({
    subscriptionId,
    customerId,
    metadataUserId: invoice.metadata?.userId,
    env,
  });
  if (!userId) return;
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
  if (!userId) return;
  await recordBillingEvent({
    userId,
    env,
    eventType: "trial_will_end",
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    metadata: { trial_end: subscription.trial_end, status: subscription.status },
  });
}

async function safe(fn: () => Promise<void>, label: string) {
  try {
    await fn();
  } catch (e) {
    console.error(`Webhook handler '${label}' failed:`, e);
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  const eventCreated =
    (event as { created?: number }).created ?? Math.floor(Date.now() / 1000);
  const eventId = (event as { id?: string }).id ?? `evt_${eventCreated}`;

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await safe(
        () => handleSubscriptionUpsert(event.data.object, env, eventCreated),
        event.type,
      );
      break;
    case "customer.subscription.deleted":
      await safe(
        () => handleSubscriptionDeleted(event.data.object, env, eventCreated),
        event.type,
      );
      break;
    case "customer.subscription.trial_will_end":
      await safe(() => handleTrialWillEnd(event.data.object, env), event.type);
      break;
    case "invoice.paid":
    case "invoice.payment_succeeded":
      await safe(
        () => handleInvoicePaid(event.data.object, env, eventId, eventCreated),
        event.type,
      );
      break;
    case "invoice.payment_failed":
      await safe(() => handleInvoicePaymentFailed(event.data.object, env), event.type);
      break;
    case "charge.refunded":
      await safe(() => handleChargeRefunded(event.data.object, env), event.type);
      break;
    case "charge.dispute.created":
      await safe(() => handleDisputeCreated(event.data.object, env), event.type);
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
