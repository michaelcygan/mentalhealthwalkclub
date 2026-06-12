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

export const adminListSafetyReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.enum(["open", "resolved", "dismissed", "all"]).default("open") }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("safety_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Hydrate display names for reporter and reported user
    const ids = new Set<string>();
    for (const r of rows ?? []) {
      const obj = r as Record<string, unknown>;
      if (typeof obj.reporter_user_id === "string") ids.add(obj.reporter_user_id);
      if (typeof obj.reported_user_id === "string") ids.add(obj.reported_user_id);
    }
    const profiles = ids.size
      ? await supabaseAdmin.from("profiles").select("id,display_name,username").in("id", [...ids])
      : { data: [] as Array<{ id: string; display_name: string | null; username: string | null }> };
    const nameMap = new Map((profiles.data ?? []).map((p) => [p.id as string, (p.display_name as string) || (p.username as string) || "Walker"]));
    return (rows ?? []).map((r) => {
      const obj = r as Record<string, unknown>;
      return {
        ...obj,
        reporter_name: typeof obj.reporter_user_id === "string" ? nameMap.get(obj.reporter_user_id) ?? null : null,
        reported_name: typeof obj.reported_user_id === "string" ? nameMap.get(obj.reported_user_id) ?? null : null,
      };
    });
  });

export const adminUpdateSafetyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["open", "resolved", "dismissed"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("safety_reports").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
