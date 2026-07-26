import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type StripeEnv = "sandbox" | "live";
const EnvSchema = z.enum(["sandbox", "live"]).default("live");

function admin() {
  return import("@/integrations/supabase/client.server").then(m => m.supabaseAdmin);
}

/** Aggregate designated/transferred/awaiting cents for the transparency page. */
export const getTransparencyTotals = createServerFn({ method: "GET" })
  .inputValidator((d: { environment?: StripeEnv } | undefined) => ({
    environment: EnvSchema.parse(d?.environment ?? "live"),
  }))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: rows, error } = await (sb as never as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
    }).rpc("transparency_totals", { _env: data.environment });
    if (error) throw new Error((error as { message?: string }).message ?? "totals failed");
    const row = Array.isArray(rows) ? (rows[0] as Record<string, unknown>) : ({} as Record<string, unknown>);
    return {
      designatedCents: Number(row?.designated_cents ?? 0),
      transferredCents: Number(row?.transferred_cents ?? 0),
      awaitingCents: Number(row?.awaiting_cents ?? 0),
    };
  });

export interface TransparencyFeedRow {
  paid_at: string;
  public_donor_name: string;
  donation_cents: number;
  source: string;
  dedication_type: string;
  honoree_name: string | null;
  dedication_message: string | null;
  status: string;
}

/** Recent designations feed. PII-safe: only shows first name / anonymized values. */
export const listTransparencyFeed = createServerFn({ method: "GET" })
  .inputValidator((d: { environment?: StripeEnv; limit?: number } | undefined) => ({
    environment: EnvSchema.parse(d?.environment ?? "live"),
    limit: Math.min(Math.max(d?.limit ?? 100, 1), 200),
  }))
  .handler(async ({ data }): Promise<TransparencyFeedRow[]> => {
    const sb = await admin();
    const { data: rows, error } = await (sb as never as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
    }).rpc("transparency_feed", { _env: data.environment, _limit: data.limit });
    if (error) throw new Error((error as { message?: string }).message ?? "feed failed");
    return (rows as TransparencyFeedRow[]) ?? [];
  });

export interface TransferBatchRow {
  id: string;
  organization_name: string;
  organization_url: string | null;
  amount_cents: number;
  transferred_at: string | null;
  period_start: string;
  period_end: string;
  receipt_storage_path: string | null;
  notes: string | null;
  status: string;
}

/** Published transfer batches (public reads via existing RLS policy). */
export const listTransferBatches = createServerFn({ method: "GET" })
  .inputValidator((d: { environment?: StripeEnv } | undefined) => ({
    environment: EnvSchema.parse(d?.environment ?? "live"),
  }))
  .handler(async ({ data }): Promise<TransferBatchRow[]> => {
    const sb = await admin();
    const { data: rows, error } = await sb
      .from("donation_transfer_batches")
      .select(
        "id, organization_name, organization_url, amount_cents, transferred_at, period_start, period_end, receipt_storage_path, notes, status",
      )
      .eq("published", true)
      .eq("environment", data.environment)
      .order("transferred_at", { ascending: false, nullsFirst: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows as TransferBatchRow[]) ?? [];
  });
