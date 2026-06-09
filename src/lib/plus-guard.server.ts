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

/** Non-throwing variant — returns true when the user has an active Plus sub in the current Stripe env. */
export async function isPlus(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const env = serverStripeEnv();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).rpc("has_active_subscription", {
    user_uuid: userId,
    check_env: env,
  });
  return !!data;
}

export type CapSurface = "saved_reads" | "playlists" | "collections_follow";

const COLUMN_MAP: Record<CapSurface, "saved_reads_cap" | "playlists_cap" | "collections_follow_cap"> = {
  saved_reads: "saved_reads_cap",
  playlists: "playlists_cap",
  collections_follow: "collections_follow_cap",
};

/**
 * Soft-cap gate: throws if a free user is at/over the configured cap for the surface.
 * Plus users bypass the cap. Caps live in membership_settings (admin-tunable).
 */
export async function requireUnderCap(
  supabase: SupabaseClient,
  userId: string,
  opts: { surface: CapSurface; currentCount: number },
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: settings } = await (supabase as any)
    .from("membership_settings")
    .select(COLUMN_MAP[opts.surface])
    .eq("id", true)
    .maybeSingle();
  const cap = (settings?.[COLUMN_MAP[opts.surface]] as number | undefined) ?? null;
  if (cap === null) return;
  if (opts.currentCount < cap) return;
  if (await isPlus(supabase, userId)) return;
  const labels: Record<CapSurface, string> = {
    saved_reads: `Free plan keeps up to ${cap} saved reads`,
    playlists: `Free plan keeps up to ${cap} custom playlists`,
    collections_follow: `Free plan follows up to ${cap} collections`,
  };
  // Structured prefix so the client can detect a cap-limit error and open the upsell sheet.
  throw new Error(`CAP_LIMIT|${opts.surface}|${cap}|${labels[opts.surface]}. Upgrade to Plus for unlimited.`);
}

/** Parse a cap-limit error thrown by requireUnderCap. Returns null if not a cap error. */
export function parseCapError(
  err: unknown,
): { surface: CapSurface; cap: number; message: string } | null {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (!msg.startsWith("CAP_LIMIT|")) return null;
  const [, surface, cap, ...rest] = msg.split("|");
  if (!surface || !cap) return null;
  return {
    surface: surface as CapSurface,
    cap: Number(cap),
    message: rest.join("|"),
  };
}
