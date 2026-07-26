import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const EnvArg = z.object({ environment: z.enum(["sandbox", "live"]) });

export const adminListUnbatchedAllocations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => EnvArg.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: rows, error } = await db
      .from("donation_allocations")
      .select(
        "id, paid_at, source, gross_payment_cents, donation_allocation_cents, status, dedication_type, honoree_name, dedication_message, public_donor_name, display_publicly, stripe_charge_id, stripe_invoice_id, user_id",
      )
      .eq("environment", data.environment)
      .eq("status", "designated")
      .is("transfer_batch_id", null)
      .gt("donation_allocation_cents", 0)
      .order("paid_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    const total = (rows ?? []).reduce(
      (s: number, r: any) => s + Number(r.donation_allocation_cents ?? 0),
      0,
    );
    return { rows: rows ?? [], total_cents: total };
  });

export const adminListBatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => EnvArg.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: rows, error } = await db
      .from("donation_transfer_batches")
      .select("*")
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminGetBatch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ batchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: batch, error } = await db
      .from("donation_transfer_batches")
      .select("*")
      .eq("id", data.batchId)
      .maybeSingle();
    if (error || !batch) throw new Error(error?.message ?? "Batch not found");
    const { data: allocs, error: aErr } = await db
      .from("donation_allocations")
      .select(
        "id, paid_at, source, gross_payment_cents, donation_allocation_cents, status, dedication_type, honoree_name, dedication_message, public_donor_name, display_publicly",
      )
      .eq("transfer_batch_id", data.batchId)
      .order("paid_at", { ascending: true });
    if (aErr) throw new Error(aErr.message);
    return { batch, allocations: allocs ?? [] };
  });

export const adminCreateBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        environment: z.enum(["sandbox", "live"]),
        allocationIds: z.array(z.string().uuid()).min(1).max(2000),
        organizationName: z.string().min(1).max(120).default("988 Suicide & Crisis Lifeline"),
        organizationUrl: z.string().url().optional().nullable(),
        notes: z.string().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();

    // Verify all allocations are eligible: same env, designated, unbatched.
    const { data: allocs, error: aErr } = await db
      .from("donation_allocations")
      .select("id, donation_allocation_cents, paid_at, environment, status, transfer_batch_id")
      .in("id", data.allocationIds);
    if (aErr) throw new Error(aErr.message);
    const list = (allocs ?? []) as Array<{
      id: string;
      donation_allocation_cents: number;
      paid_at: string;
      environment: string;
      status: string;
      transfer_batch_id: string | null;
    }>;
    if (list.length !== data.allocationIds.length) {
      throw new Error("Some allocations were not found");
    }
    for (const r of list) {
      if (r.environment !== data.environment) throw new Error("Allocations span environments");
      if (r.status !== "designated") throw new Error(`Allocation ${r.id} is not designated`);
      if (r.transfer_batch_id) throw new Error(`Allocation ${r.id} is already batched`);
    }
    const total = list.reduce((s, r) => s + Number(r.donation_allocation_cents ?? 0), 0);
    const paidAts = list.map((r) => new Date(r.paid_at).getTime());
    const periodStart = new Date(Math.min(...paidAts)).toISOString().slice(0, 10);
    const periodEnd = new Date(Math.max(...paidAts)).toISOString().slice(0, 10);

    const { data: batch, error: bErr } = await db
      .from("donation_transfer_batches")
      .insert({
        environment: data.environment,
        organization_name: data.organizationName,
        organization_url: data.organizationUrl ?? null,
        period_start: periodStart,
        period_end: periodEnd,
        amount_cents: total,
        status: "pending",
        published: false,
        notes: data.notes ?? null,
        created_by: context.userId,
      })
      .select()
      .single();
    if (bErr || !batch) throw new Error(bErr?.message ?? "Batch create failed");

    const { error: uErr } = await db
      .from("donation_allocations")
      .update({ transfer_batch_id: batch.id, updated_at: new Date().toISOString() })
      .in("id", data.allocationIds);
    if (uErr) {
      // Best-effort rollback
      await db.from("donation_transfer_batches").delete().eq("id", batch.id);
      throw new Error(uErr.message);
    }
    return batch;
  });

export const adminMarkBatchTransferred = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        batchId: z.string().uuid(),
        transferredAt: z.string().datetime(),
        receiptStoragePath: z.string().max(500).optional().nullable(),
        notes: z.string().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const now = new Date().toISOString();
    const { error: bErr } = await db
      .from("donation_transfer_batches")
      .update({
        status: "transferred",
        transferred_at: data.transferredAt,
        receipt_storage_path: data.receiptStoragePath ?? null,
        notes: data.notes ?? null,
        updated_at: now,
      })
      .eq("id", data.batchId);
    if (bErr) throw new Error(bErr.message);
    const { error: aErr } = await db
      .from("donation_allocations")
      .update({
        status: "transferred",
        transferred_at: data.transferredAt,
        updated_at: now,
      })
      .eq("transfer_batch_id", data.batchId);
    if (aErr) throw new Error(aErr.message);
    return { ok: true };
  });

export const adminSetBatchPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ batchId: z.string().uuid(), published: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { error } = await db
      .from("donation_transfer_batches")
      .update({ published: data.published, updated_at: new Date().toISOString() })
      .eq("id", data.batchId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDissolveBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ batchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    // Only allow dissolving a batch that has not been transferred yet.
    const { data: batch } = await db
      .from("donation_transfer_batches")
      .select("status")
      .eq("id", data.batchId)
      .maybeSingle();
    if (!batch) throw new Error("Batch not found");
    if (batch.status === "transferred") {
      throw new Error("Cannot dissolve a transferred batch");
    }
    await db
      .from("donation_allocations")
      .update({ transfer_batch_id: null, updated_at: new Date().toISOString() })
      .eq("transfer_batch_id", data.batchId);
    await db.from("donation_transfer_batches").delete().eq("id", data.batchId);
    return { ok: true };
  });
