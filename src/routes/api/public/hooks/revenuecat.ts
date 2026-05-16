/**
 * RevenueCat webhook → upserts Plus entitlement into `subscriptions`.
 *
 * RevenueCat fires server-to-server events for the full subscription
 * lifecycle (INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, …).
 * We mirror them into the same `subscriptions` table Stripe writes to,
 * tagged with `gateway = 'revenuecat'`, so `has_active_subscription`
 * RPC works unchanged for native users.
 *
 * Security: RevenueCat signs each request with a shared Authorization
 * header value the dashboard lets you set. We compare in constant time.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { timingSafeEqual } from "node:crypto";

type RCEvent = {
  type: string;
  app_user_id: string;
  product_id?: string;
  period_type?: "TRIAL" | "NORMAL" | "INTRO";
  purchased_at_ms?: number;
  expiration_at_ms?: number;
  environment?: "SANDBOX" | "PRODUCTION";
  store?: string;
  original_transaction_id?: string;
  entitlement_ids?: string[];
};

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function mapStatus(eventType: string): string {
  switch (eventType) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "PRODUCT_CHANGE":
    case "UNCANCELLATION":
    case "NON_RENEWING_PURCHASE": // lifetime tier
      return "active";
    case "TRIAL_STARTED":
      return "trialing";
    case "CANCELLATION":
      // Sub still active until expiration; mark cancel_at_period_end.
      return "active";
    case "EXPIRATION":
      return "canceled";
    case "BILLING_ISSUE":
      return "past_due";
    default:
      return "active";
  }
}

export const Route = createFileRoute("/api/public/hooks/revenuecat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
        if (!expected) {
          console.error("[revenuecat] REVENUECAT_WEBHOOK_AUTH not configured");
          return new Response("Not configured", { status: 500 });
        }
        const got = request.headers.get("authorization") ?? "";
        if (!constantTimeEqual(got, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: { event?: RCEvent };
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        const ev = payload.event;
        if (!ev?.app_user_id || !ev?.type) {
          return new Response("Missing fields", { status: 400 });
        }

        // Basic uuid validation — app_user_id is always Supabase auth.uid().
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ev.app_user_id)) {
          return new Response("Invalid app_user_id", { status: 400 });
        }

        const environment = ev.environment === "PRODUCTION" ? "live" : "sandbox";
        const status = mapStatus(ev.type);
        const cancelAtPeriodEnd = ev.type === "CANCELLATION";
        const periodEnd = ev.expiration_at_ms
          ? new Date(ev.expiration_at_ms).toISOString()
          : null;
        const periodStart = ev.purchased_at_ms
          ? new Date(ev.purchased_at_ms).toISOString()
          : null;

        // Customer id we have for native is the RC original_transaction_id
        // (or app_user_id as fallback) — stored in stripe_customer_id slot
        // since that column is non-null. It's not a Stripe id but it's a
        // stable per-user identifier for the row.
        const customerSlot = ev.original_transaction_id ?? ev.app_user_id;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabaseAdmin.from("subscriptions") as any).upsert(
          {
            user_id: ev.app_user_id,
            gateway: "revenuecat",
            stripe_subscription_id: null,
            stripe_customer_id: customerSlot,
            product_id: ev.product_id ?? "walk_club_plus",
            price_id: ev.product_id ?? "walk_club_plus",
            status,
            current_period_start: periodStart,
            current_period_end: periodEnd,
            cancel_at_period_end: cancelAtPeriodEnd,
            environment,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,environment", ignoreDuplicates: false },
        );
        if (error) {
          console.error("[revenuecat] upsert failed:", error);
          return new Response("DB error", { status: 500 });
        }

        return Response.json({ received: true });
      },
    },
  },
});
