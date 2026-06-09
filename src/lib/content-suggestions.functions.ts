import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Not authorized");
}

export const createContentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      title: z.string().trim().min(2).max(160),
      url: z.string().url().max(500).optional().or(z.literal("")),
      kind: z.enum(["podcast", "ambient", "guided", "blog", "other"]).default("other"),
      notes: z.string().trim().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("content_requests").insert({
      user_id: userId,
      title: data.title,
      url: data.url || null,
      kind: data.kind,
      notes: data.notes || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListContentRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ status: z.enum(["open", "in_review", "approved", "declined", "all"]).default("open") }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("content_requests").select("id,title,url,kind,notes,status,created_at,user_id").order("created_at", { ascending: false });
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q.limit(100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminUpdateContentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["open", "in_review", "approved", "declined"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("content_requests").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminInsightsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
    const since7 = new Date(Date.now() - 7 * 86400_000).toISOString();

    const [terms, events, requests] = await Promise.all([
      supabaseAdmin.from("listen_search_log").select("q,result_count,created_at").gte("created_at", since30).limit(2000),
      supabaseAdmin.from("listen_events").select("kind,item_id,user_id,action,created_at").gte("created_at", since7).limit(5000),
      supabaseAdmin.from("content_requests").select("id,status").eq("status", "open"),
    ]);

    const termTally = new Map<string, { count: number; zero: number }>();
    for (const r of terms.data ?? []) {
      const k = (r.q as string).trim().toLowerCase();
      if (!k) continue;
      const e = termTally.get(k) ?? { count: 0, zero: 0 };
      e.count += 1;
      if ((r.result_count ?? 0) === 0) e.zero += 1;
      termTally.set(k, e);
    }
    const topTerms = [...termTally.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 12).map(([q, v]) => ({ q, count: v.count, zero: v.zero }));
    const zeroResultTerms = [...termTally.entries()].filter(([, v]) => v.zero > 0).sort((a, b) => b[1].zero - a[1].zero).slice(0, 12).map(([q, v]) => ({ q, zero: v.zero }));

    const actions = { open: 0, play: 0, save: 0, queue: 0 } as Record<string, number>;
    const distinctUsers = new Set<string>();
    for (const r of (events.data ?? []) as Array<{ action: string; user_id: string }>) {
      actions[r.action] = (actions[r.action] ?? 0) + 1;
      distinctUsers.add(r.user_id);
    }

    return {
      topTerms,
      zeroResultTerms,
      events7d: {
        total: (events.data ?? []).length,
        distinctUsers: distinctUsers.size,
        byAction: actions,
      },
      openRequests: (requests.data ?? []).length,
    };
  });
