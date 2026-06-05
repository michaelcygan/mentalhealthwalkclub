import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ---------- helpers ---------- */

function randomSlug(): string {
  // 9-char URL-safe (~52 bits)
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 9; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/* ---------- list hostable groups + circles ---------- */

export const listMyHostableGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // groups: owner or active member
    const { data: ownedGroups } = await supabase
      .from("groups")
      .select("id,name,slug,cover_image_url")
      .eq("owner_id", userId)
      .eq("status", "active");

    const { data: memberRows } = await supabase
      .from("group_memberships")
      .select("group_id,groups(id,name,slug,cover_image_url,status)")
      .eq("user_id", userId)
      .eq("status", "active");

    const memberGroups = (memberRows ?? [])
      .map((r) => (r as { groups: { id: string; name: string; slug: string; cover_image_url: string | null; status: string } | null }).groups)
      .filter((g): g is { id: string; name: string; slug: string; cover_image_url: string | null; status: string } => !!g && g.status === "active");

    const groupMap = new Map<string, { id: string; name: string; slug: string; cover_image_url: string | null }>();
    for (const g of [...(ownedGroups ?? []), ...memberGroups]) {
      groupMap.set(g.id, { id: g.id, name: g.name, slug: g.slug, cover_image_url: g.cover_image_url });
    }

    // circles: owned by user
    const { data: circles } = await supabase
      .from("circles")
      .select("id,name,slug,color")
      .eq("owner_id", userId);

    return {
      groups: [...groupMap.values()],
      circles: (circles ?? []).map((c) => ({ id: c.id, name: c.name, slug: c.slug, color: c.color })),
    };
  });

/* ---------- create walk ---------- */

const CreateInput = z.object({
  title: z.string().trim().min(2).max(120),
  vibe: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime().optional().nullable(),
  timezone: z.string().min(1).max(80).optional().nullable(),
  audience: z.enum(["open", "group", "link_only"]),
  group_id: z.string().uuid().optional().nullable(),
  circle_id: z.string().uuid().optional().nullable(),
  place_id: z.string().uuid().optional().nullable(),
  cover_override_url: z.string().url().optional().nullable(),
  meeting_point: z.string().trim().max(280).optional().nullable(),
  pace: z.enum(["easy", "moderate", "brisk"]).optional().nullable(),
  distance_meters: z.number().int().positive().max(100000).optional().nullable(),
  dog_friendly: z.boolean().optional(),
  kid_friendly: z.boolean().optional(),
  accessibility_notes: z.string().trim().max(500).optional().nullable(),
});

export const createWalk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // resolve place fields if provided
    let venue_name: string | null = null;
    let address: string | null = null;
    let city: string | null = null;
    let lat: number | null = null;
    let lng: number | null = null;
    let image_url: string | null = data.cover_override_url ?? null;

    if (data.place_id) {
      const { data: place } = await supabase
        .from("places")
        .select("name,address,lat,lng,hero_url")
        .eq("id", data.place_id)
        .maybeSingle();
      if (place) {
        venue_name = place.name;
        address = place.address;
        lat = place.lat != null ? Number(place.lat) : null;
        lng = place.lng != null ? Number(place.lng) : null;
        if (!image_url) image_url = place.hero_url;
        // crude city extraction: penultimate comma chunk
        if (place.address) {
          const parts = place.address.split(",").map((p) => p.trim());
          if (parts.length >= 2) city = parts[parts.length - 2] || null;
        }
      }
    }

    // validate group/circle ownership/membership
    if (data.audience === "group") {
      if (!data.group_id && !data.circle_id) {
        throw new Error("Pick a group or circle.");
      }
      if (data.group_id) {
        const { data: g } = await supabase
          .from("groups")
          .select("id,owner_id")
          .eq("id", data.group_id)
          .maybeSingle();
        if (!g) throw new Error("Group not found.");
        if (g.owner_id !== userId) {
          const { data: m } = await supabase
            .from("group_memberships")
            .select("status")
            .eq("group_id", data.group_id)
            .eq("user_id", userId)
            .maybeSingle();
          if (m?.status !== "active") throw new Error("You're not in that group.");
        }
      }
      if (data.circle_id) {
        const { data: c } = await supabase
          .from("circles")
          .select("owner_id")
          .eq("id", data.circle_id)
          .maybeSingle();
        if (!c || c.owner_id !== userId) throw new Error("You don't own that circle.");
      }
    }

    const visibility =
      data.audience === "open" ? "public" : data.audience === "group" ? "group" : "link_only";

    // generate unique slug
    let slug = randomSlug();
    for (let i = 0; i < 5; i++) {
      const { data: exists } = await supabase
        .from("events")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!exists) break;
      slug = randomSlug();
    }

    const { data: row, error } = await supabase
      .from("events")
      .insert({
        title: data.title,
        slug,
        description: data.description ?? null,
        vibe: data.vibe ?? null,
        event_type: "community_walk",
        host_user_id: userId,
        starts_at: data.starts_at,
        ends_at: data.ends_at ?? null,
        timezone: data.timezone ?? null,
        visibility,
        audience_mode: data.audience === "open" ? "public" : "private",
        group_id: data.audience === "group" ? data.group_id ?? null : null,
        circle_id: data.audience === "group" ? data.circle_id ?? null : null,
        place_id: data.place_id ?? null,
        venue_name,
        address,
        city,
        lat,
        lng,
        image_url,
        cover_override_url: data.cover_override_url ?? null,
        meeting_point: data.meeting_point ?? null,
        pace: data.pace ?? null,
        distance_meters: data.distance_meters ?? null,
        dog_friendly: !!data.dog_friendly,
        kid_friendly: !!data.kid_friendly,
        accessibility_notes: data.accessibility_notes ?? null,
        status: "published",
      })
      .select("id,slug")
      .single();

    if (error) {
      console.error("createWalk error", error);
      throw new Error(error.message);
    }
    return { id: row.id, slug: row.slug };
  });

/* ---------- broadcasts ---------- */

const SendBroadcastInput = z.object({
  eventId: z.string().uuid(),
  body: z.string().trim().min(1).max(500),
});

export const sendBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SendBroadcastInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("event_broadcasts")
      .insert({ event_id: data.eventId, author_id: userId, body: data.body })
      .select("id,created_at")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, created_at: row.created_at };
  });

const ListBroadcastsInput = z.object({ eventId: z.string().uuid() });

export const listBroadcasts = createServerFn({ method: "GET" })
  .inputValidator((d) => ListBroadcastsInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("event_broadcasts")
      .select("id,body,created_at,author_id")
      .eq("event_id", data.eventId)
      .order("created_at", { ascending: false })
      .limit(30);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.author_id)));
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id,display_name,avatar_url").in("id", ids)
      : { data: [] as Array<{ id: string; display_name: string | null; avatar_url: string | null }> };
    const pmap = new Map((profs ?? []).map((p) => [p.id, p]));
    return {
      broadcasts: (rows ?? []).map((r) => ({
        id: r.id,
        body: r.body,
        created_at: r.created_at,
        author: {
          id: r.author_id,
          display_name: pmap.get(r.author_id)?.display_name ?? null,
          avatar_url: pmap.get(r.author_id)?.avatar_url ?? null,
        },
      })),
    };
  });
