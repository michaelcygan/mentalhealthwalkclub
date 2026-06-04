import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AGE_BANDS = ["18+", "21+", "25+", "40+", "65+"] as const;

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "group"
  );
}

/* -------- DOB / age band -------- */

export const getMyAgeBand = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles")
      .select("age_band")
      .eq("id", userId)
      .maybeSingle();
    const { data: dob } = await supabase
      .from("user_dob")
      .select("dob")
      .eq("user_id", userId)
      .maybeSingle();
    return { age_band: prof?.age_band ?? null, has_dob: !!dob };
  });

const SetDobInput = z.object({ dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
export const setMyDob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SetDobInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: band, error } = await supabase.rpc("set_my_dob", { _dob: data.dob });
    if (error) throw new Error(error.message);
    return { age_band: band as string };
  });

/* -------- Groups -------- */

const CreateGroupInput = z.object({
  name: z.string().min(1).max(80).trim(),
  description: z.string().max(600).optional().nullable(),
  visibility: z.enum(["public", "private"]).default("private"),
  scope: z.enum(["local", "global"]).default("local"),
  age_band_min: z.enum(AGE_BANDS).default("18+"),
  radius_miles: z.number().int().min(1).max(100).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  neighborhood: z.string().max(120).optional().nullable(),
});

export const createGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateGroupInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Age gate: user must have an age band that satisfies the requested floor.
    const { data: prof } = await supabase
      .from("profiles")
      .select("age_band")
      .eq("id", userId)
      .maybeSingle();
    if (!prof?.age_band) {
      throw new Error("Add your date of birth before creating a group.");
    }
    const { data: meets } = await supabase.rpc("age_band_meets", {
      _user_band: prof.age_band,
      _min_band: data.age_band_min,
    });
    if (!meets) throw new Error("You don't meet the age floor for this group.");

    // Trust gate for public groups.
    if (data.visibility === "public") {
      const { data: trust } = await supabase.rpc("host_trust_ok", { _user: userId });
      if (!trust) {
        throw new Error(
          "Public groups unlock after 3 completed walks, a confirmed email, and 14 days on the app. Until then you can create private groups.",
        );
      }
      // Rate limit: 1 public group / 7 days for first 30 days, 3/week after.
      const { count: recent7 } = await supabase
        .from("groups")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId)
        .eq("visibility", "public")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      const { data: u } = await supabase.auth.getUser();
      const createdAt = u.user?.created_at ? new Date(u.user.created_at).getTime() : Date.now();
      const newish = Date.now() - createdAt < 30 * 24 * 60 * 60 * 1000;
      const cap = newish ? 1 : 3;
      if ((recent7 ?? 0) >= cap) {
        throw new Error(`You can create ${cap} public group${cap === 1 ? "" : "s"} per week.`);
      }
    }

    // Unique slug per owner+global namespace.
    const base = slugify(data.name);
    let slug = base;
    for (let i = 1; i < 60; i++) {
      const { data: exists } = await supabase
        .from("groups")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!exists) break;
      slug = `${base}-${i + 1}`;
    }

    const { data: row, error } = await supabase
      .from("groups")
      .insert({
        owner_id: userId,
        name: data.name,
        slug,
        description: data.description ?? null,
        visibility: data.visibility,
        scope: data.scope,
        age_band_min: data.age_band_min,
        radius_miles: data.radius_miles ?? null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        neighborhood: data.neighborhood ?? null,
        status: "active",
      })
      .select("id,slug,name,visibility,status")
      .single();
    if (error) throw new Error(error.message);

    await supabase
      .from("group_memberships")
      .insert({ group_id: row.id, user_id: userId, role: "owner", status: "active" });

    return row;
  });

export const listMyGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: owned } = await supabase
      .from("groups")
      .select("id,name,slug,description,visibility,scope,neighborhood,cover_image_url,status,created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    const { data: memRows } = await supabase
      .from("group_memberships")
      .select("group_id,role")
      .eq("user_id", userId)
      .eq("status", "active");
    const otherIds = (memRows ?? [])
      .map((r) => r.group_id)
      .filter((gid) => !(owned ?? []).some((o) => o.id === gid));

    let member: NonNullable<typeof owned> = [];
    if (otherIds.length) {
      const { data } = await supabase
        .from("groups")
        .select("id,name,slug,description,visibility,scope,neighborhood,cover_image_url,status,created_at")
        .in("id", otherIds);
      member = data ?? [];
    }
    return { owned: owned ?? [], member };
  });

const SlugInput = z.object({ slug: z.string().min(1).max(80) });

export const getGroupBySlug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SlugInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: g, error } = await supabase
      .from("groups")
      .select(
        "id,owner_id,name,slug,description,visibility,scope,age_band_min,radius_miles,lat,lng,neighborhood,cover_image_url,status,created_at",
      )
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!g) throw new Error("Group not found.");

    const { count: memberCount } = await supabase
      .from("group_memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("group_id", g.id)
      .eq("status", "active");

    const { data: my } = await supabase
      .from("group_memberships")
      .select("role,status")
      .eq("group_id", g.id)
      .eq("user_id", userId)
      .maybeSingle();

    // Public location coarsening: only show exact pin to members.
    const isMember = !!my && my.status === "active";
    const exactLocation = isMember || g.owner_id === userId;
    const coarseLat = g.lat != null ? Math.round(Number(g.lat) * 100) / 100 : null;
    const coarseLng = g.lng != null ? Math.round(Number(g.lng) * 100) / 100 : null;

    return {
      group: {
        ...g,
        lat: exactLocation ? g.lat : coarseLat,
        lng: exactLocation ? g.lng : coarseLng,
      },
      member_count: memberCount ?? 0,
      my_role: my?.role ?? null,
      my_status: my?.status ?? null,
      is_owner: g.owner_id === userId,
    };
  });

const UuidInput = z.object({ id: z.string().uuid() });

export const joinGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UuidInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: g } = await supabase
      .from("groups")
      .select("id,visibility,status,age_band_min")
      .eq("id", data.id)
      .maybeSingle();
    if (!g) throw new Error("Group not found.");
    if (g.status !== "active") throw new Error("This group isn't accepting new members.");
    if (g.visibility !== "public") throw new Error("This group is invite-only.");

    const { data: prof } = await supabase
      .from("profiles")
      .select("age_band")
      .eq("id", userId)
      .maybeSingle();
    if (!prof?.age_band) throw new Error("Add your date of birth before joining a group.");
    const { data: meets } = await supabase.rpc("age_band_meets", {
      _user_band: prof.age_band,
      _min_band: g.age_band_min,
    });
    if (!meets) throw new Error(`This group is for ages ${g.age_band_min}.`);

    const { error } = await supabase
      .from("group_memberships")
      .upsert(
        { group_id: data.id, user_id: userId, role: "member", status: "active" },
        { onConflict: "group_id,user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const leaveGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UuidInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: g } = await supabase
      .from("groups")
      .select("owner_id")
      .eq("id", data.id)
      .maybeSingle();
    if (g?.owner_id === userId) throw new Error("Owners can't leave their own group. Delete it instead.");
    const { error } = await supabase
      .from("group_memberships")
      .delete()
      .eq("group_id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UuidInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("groups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------- Discovery (preview) -------- */

const DiscoverInput = z.object({
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  scope: z.enum(["local", "global"]).default("local"),
});

export const discoverPublicGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => DiscoverInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("groups")
      .select("id,name,slug,description,scope,neighborhood,cover_image_url,lat,lng,created_at")
      .eq("visibility", "public")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(60);
    if (data.scope === "global") q = q.eq("scope", "global");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    let withDist = (rows ?? []).map((r) => ({ ...r, miles: null as number | null }));
    if (data.lat != null && data.lng != null) {
      const toRad = (n: number) => (n * Math.PI) / 180;
      withDist = withDist
        .map((r) => {
          if (r.lat == null || r.lng == null) return { ...r, miles: null };
          const dLat = toRad(Number(r.lat) - data.lat!);
          const dLng = toRad(Number(r.lng) - data.lng!);
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(data.lat!)) * Math.cos(toRad(Number(r.lat))) * Math.sin(dLng / 2) ** 2;
          const miles = 3958.8 * 2 * Math.asin(Math.sqrt(a));
          return { ...r, miles };
        })
        .filter((r) => data.scope === "global" || r.miles == null || r.miles <= 25)
        .sort((a, b) => (a.miles ?? 9999) - (b.miles ?? 9999));
    }

    return { groups: withDist };
  });
