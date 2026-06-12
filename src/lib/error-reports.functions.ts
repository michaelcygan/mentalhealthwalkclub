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

const ConsoleEntry = z.object({
  level: z.enum(["error", "warn"]),
  message: z.string().max(2000),
  at: z.string().max(40),
});

const SubmitSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  url: z.string().max(500).optional(),
  user_agent: z.string().max(500).optional(),
  app_version: z.string().max(80).optional(),
  console_tail: z.array(ConsoleEntry).max(20).optional(),
  include_diagnostics: z.boolean().default(true),
});

/** Submit an error report. Auth optional (anon allowed). */
export const submitErrorReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SubmitSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Best-effort user id from bearer (optional; anon allowed).
    let userId: string | null = null;
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const req = getRequest();
      const auth = req.headers.get("authorization") ?? "";
      const token = auth.replace(/^Bearer\s+/i, "");
      if (token) {
        const { data: u } = await supabaseAdmin.auth.getUser(token);
        userId = u.user?.id ?? null;
      }
    } catch { /* anon */ }

    // Rate limit: 1 report per user per 30s (best-effort).
    if (userId) {
      const since = new Date(Date.now() - 30_000).toISOString();
      const { count } = await supabaseAdmin
        .from("error_reports")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", since);
      if ((count ?? 0) > 0) throw new Error("Please wait a moment before sending another report.");
    }

    const diag = data.include_diagnostics;
    const { error } = await supabaseAdmin.from("error_reports").insert({
      user_id: userId,
      message: data.message,
      url: diag ? (data.url ?? null) : null,
      user_agent: diag ? (data.user_agent ?? null) : null,
      app_version: diag ? (data.app_version ?? null) : null,
      console_tail: diag ? (data.console_tail ?? []) : null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListErrorReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.enum(["open", "triaged", "closed", "all"]).default("open") }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("error_reports")
      .select("id,user_id,message,url,user_agent,app_version,console_tail,status,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminUpdateErrorReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["open", "triaged", "closed"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("error_reports").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
