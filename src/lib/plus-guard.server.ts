import type { SupabaseClient } from "@supabase/supabase-js";

function serverStripeEnv(): "sandbox" | "live" {
  const token =
    process.env.VITE_PAYMENTS_CLIENT_TOKEN ??
    (typeof import.meta !== "undefined" ? (import.meta as { env?: Record<string, string> }).env?.VITE_PAYMENTS_CLIENT_TOKEN : undefined);
  return token?.startsWith("pk_live_") ? "live" : "sandbox";
}

/**
 * Server-side Plus gate.
 * Throws a user-friendly error when the caller doesn't have an active Plus subscription
 * in the current Stripe environment. Use in any server function that exposes a Plus-only feature.
 */
export async function requirePlus(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const env = serverStripeEnv();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("has_active_subscription", {
    user_uuid: userId,
    check_env: env,
  });
  if (error) throw new Error("Couldn't verify your subscription. Try again.");
  if (!data) throw new Error("Walk Club Plus is required for this. Start your free trial from your profile.");
}
