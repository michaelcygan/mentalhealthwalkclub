import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";

export type BillingEventType =
  | "plus_intent_selected"
  | "checkout_opened"
  | "checkout_completed"
  | "checkout_dismissed"
  | "subscription_cancel_clicked"
  | "subscription_resumed"
  | "billing_portal_opened"
  | "payment_method_update_clicked";

export async function trackBillingEvent(
  eventType: BillingEventType,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const { data: u } = await supabase.auth.getUser();
    const userId = u.user?.id;
    if (!userId) return;
    await supabase.from("billing_events" as never).insert({
      user_id: userId,
      event_type: eventType,
      environment: getStripeEnvironment(),
      source: "client",
      metadata,
    } as never);
  } catch (e) {
    // Analytics must never break UX
    console.warn("trackBillingEvent failed", e);
  }
}
