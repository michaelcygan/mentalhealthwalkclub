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

export type EligibilityStatus =
  | "pending_age"
  | "adult_active"
  | "underage_blocked"
  | "age_review"
  | "safety_suspended";

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
  eligibility_status: EligibilityStatus;
  age_band: string | null;
  age_attested_at: string | null;
}

const SearchInput = z.object({
  q: z.string().trim().max(120).default(""),
  filter: z.enum(["all", "pending", "blocked", "adult"]).default("all"),
});

export const adminSearchUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SearchInput.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<AdminUserRow[]> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.q;

    let pq = supabaseAdmin
      .from("profiles")
      .select("id,display_name,username,city,country,walks_hosted,walks_attended,created_at,age_band")
      .order("created_at", { ascending: false })
      .limit(100);
    if (q) {
      const like = `%${q.replace(/[%_]/g, "")}%`;
      pq = pq.or(`display_name.ilike.${like},username.ilike.${like},city.ilike.${like}`);
    }
    const { data: profiles, error } = await pq;
    if (error) throw new Error(error.message);

    const ids = (profiles ?? []).map((p) => p.id as string);
    if (ids.length === 0) return [];

    const emailMap = new Map<string, string | null>();
    await Promise.all(
      ids.map(async (id) => {
        try {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
          emailMap.set(id, u.user?.email ?? null);
        } catch { emailMap.set(id, null); }
      }),
    );

    const [{ data: roles }, { data: safety }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", ids).eq("role", "admin"),
      supabaseAdmin
        .from("account_safety")
        .select("user_id,eligibility_status,age_attested_at")
        .in("user_id", ids),
    ]);
    const adminSet = new Set((roles ?? []).map((r) => r.user_id as string));
    const safetyMap = new Map<string, { status: EligibilityStatus; attested_at: string | null }>(
      (safety ?? []).map((s) => [
        s.user_id as string,
        {
          status: (s.eligibility_status as EligibilityStatus) ?? "pending_age",
          attested_at: (s.age_attested_at as string | null) ?? null,
        },
      ]),
    );

    const rows: AdminUserRow[] = (profiles ?? []).map((p) => {
      const sf = safetyMap.get(p.id as string);
      return {
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
        eligibility_status: sf?.status ?? "pending_age",
        age_band: (p.age_band as string | null) ?? null,
        age_attested_at: sf?.attested_at ?? null,
      };
    });

    return rows.filter((r) => {
      if (data.filter === "all") return true;
      if (data.filter === "pending") return r.eligibility_status === "pending_age";
      if (data.filter === "adult") return r.eligibility_status === "adult_active";
      if (data.filter === "blocked") {
        return r.eligibility_status === "underage_blocked"
          || r.eligibility_status === "age_review"
          || r.eligibility_status === "safety_suspended";
      }
      return true;
    });
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

export const adminCorrectUserDob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
      reason: z.string().trim().min(3).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabase } = context;
    const client = supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { error } = await client.rpc("admin_correct_user_dob", {
      _user_id: data.user_id,
      _dob: data.dob,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
