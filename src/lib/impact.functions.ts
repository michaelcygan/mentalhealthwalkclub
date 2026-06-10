import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

/** Public — list published impact donation rows for the /impact page. */
export const listImpactDonations = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("impact_donations")
    .select(
      "id,period_start,period_end,gross_revenue_cents,net_profit_cents,donation_amount_cents,donation_percent,organization_name,organization_url,notes,published",
    )
    .eq("published", true)
    .order("period_end", { ascending: false });
  if (error) throw new Error(error.message);
  const total = (data ?? []).reduce((s, r) => s + (r.donation_amount_cents ?? 0), 0);
  return { rows: data ?? [], total_donated_cents: total };
});

const DONATION_PERCENT = 100;
// Rough Stripe fees on a $1.99 charge with managed_payments (+3.5%): ~2.9% + $0.30 + 3.5% = ~6.4% + $0.30.
// Net = gross * 0.936 - $0.30 per charge. We approximate per-row when summing.
function estimateNetCents(grossCents: number, chargeCount: number): number {
  const fee = Math.round(grossCents * 0.064) + chargeCount * 30;
  return Math.max(0, grossCents - fee);
}

const RecomputeInput = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  environment: z.enum(["sandbox", "live"]),
  organization_name: z.string().min(1).max(120).default("NAMI"),
  organization_url: z.string().url().optional().nullable(),
  publish: z.boolean().default(false),
});

/** Admin only — sum successful Stripe charges in the period for our Plus product, compute 50% donation. */
export const recomputeImpactForPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => RecomputeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: admin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!admin) throw new Error("Admin only.");

    const env: StripeEnv = data.environment;
    const stripe = createStripeClient(env);

    const startTs = Math.floor(new Date(data.period_start + "T00:00:00Z").getTime() / 1000);
    const endTs = Math.floor(new Date(data.period_end + "T23:59:59Z").getTime() / 1000);

    let gross = 0;
    let count = 0;
    let starting_after: string | undefined;
    // Paginate up to 10 pages (1000 charges) — plenty for early-stage volume.
    for (let i = 0; i < 10; i++) {
      const page = await stripe.charges.list({
        created: { gte: startTs, lte: endTs },
        limit: 100,
        ...(starting_after ? { starting_after } : {}),
      });
      for (const ch of page.data) {
        if (ch.status !== "succeeded" || ch.refunded) continue;
        gross += ch.amount;
        count += 1;
      }
      if (!page.has_more) break;
      starting_after = page.data[page.data.length - 1]?.id;
      if (!starting_after) break;
    }

    const net = estimateNetCents(gross, count);
    const donation = Math.round((net * DONATION_PERCENT) / 100);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("impact_donations")
      .upsert(
        {
          period_start: data.period_start,
          period_end: data.period_end,
          gross_revenue_cents: gross,
          net_profit_cents: net,
          donation_amount_cents: donation,
          donation_percent: DONATION_PERCENT,
          organization_name: data.organization_name,
          organization_url: data.organization_url ?? null,
          published: data.publish,
          notes: `Auto-computed from ${count} successful Stripe charges (${env}).`,
        },
        { onConflict: "period_start,period_end" } as never,
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, row };
  });
