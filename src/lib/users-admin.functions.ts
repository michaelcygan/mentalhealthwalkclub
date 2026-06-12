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

export interface AdminUserRow {
  id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
  city: string | null;
  country: string | null;
  walks_hosted: number;
  walks_attended: number;
  created_at: string | null;
  is_admin: boolean;
}

export const adminSearchUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().trim().max(120).default("") }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<AdminUserRow[]> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.q;

    // Pull from profiles (search by display_name/username/city)
    let pq = supabaseAdmin
      .from("profiles")
      .select("id,display_name,username,city,country,walks_hosted,walks_attended,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (q) {
      const like = `%${q.replace(/[%_]/g, "")}%`;
      pq = pq.or(`display_name.ilike.${like},username.ilike.${like},city.ilike.${like}`);
    }
    const { data: profiles, error } = await pq;
    if (error) throw new Error(error.message);

    const ids = (profiles ?? []).map((p) => p.id as string);
    if (ids.length === 0) return [];

    // Pull emails via Auth Admin (per-id; small set)
    const emailMap = new Map<string, string | null>();
    await Promise.all(
      ids.map(async (id) => {
        try {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
          emailMap.set(id, u.user?.email ?? null);
        } catch { emailMap.set(id, null); }
      }),
    );

    // If email search supplied and no profile match, try email lookup
    if (q && profiles && profiles.length === 0 && q.includes("@")) {
      // best-effort; skip — Auth Admin doesn't support a filtered search by email reliably here.
    }

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", ids).eq("role", "admin");
    const adminSet = new Set((roles ?? []).map((r) => r.user_id as string));

    return (profiles ?? []).map((p) => ({
      id: p.id as string,
      email: emailMap.get(p.id as string) ?? null,
      display_name: p.display_name as string | null,
      username: p.username as string | null,
      city: p.city as string | null,
      country: p.country as string | null,
      walks_hosted: (p.walks_hosted as number) ?? 0,
      walks_attended: (p.walks_attended as number) ?? 0,
      created_at: (p.created_at as string) ?? null,
      is_admin: adminSet.has(p.id as string),
    }));
  });

export const adminSetUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid(), make_admin: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId && data.make_admin === false) {
      throw new Error("You can't remove your own admin role here.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.make_admin) {
      const { error } = await supabaseAdmin.from("user_roles").upsert({ user_id: data.user_id, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
