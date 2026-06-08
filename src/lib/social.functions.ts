import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UuidInput = z.object({ id: z.string().uuid() });
const UsernameInput = z.object({ username: z.string().min(1).max(120).trim() });

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "circle";
}

/* ---------------- CIRCLES ---------------- */

export const listMyCircles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: owned } = await supabase
      .from("circles")
      .select("id,name,slug,description,color,created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    const { data: memberRows } = await supabase
      .from("circle_members")
      .select("circle_id,role,status")
      .eq("user_id", userId)
      .eq("status", "active");

    const otherIds = (memberRows ?? [])
      .map((r) => r.circle_id)
      .filter((cid) => !(owned ?? []).some((o) => o.id === cid));

    let other: typeof owned = [];
    if (otherIds.length) {
      const { data } = await supabase
        .from("circles")
        .select("id,name,slug,description,color,created_at")
        .in("id", otherIds);
      other = data ?? [];
    }

    // counts per circle
    const ids = [...(owned ?? []), ...(other ?? [])].map((c) => c.id);
    const counts = new Map<string, number>();
    if (ids.length) {
      const { data: m } = await supabase
        .from("circle_members")
        .select("circle_id")
        .in("circle_id", ids)
        .eq("status", "active");
      for (const row of m ?? []) {
        counts.set(row.circle_id, (counts.get(row.circle_id) ?? 0) + 1);
      }
    }

    const withCount = (rows: NonNullable<typeof owned>) =>
      rows.map((c) => ({ ...c, member_count: counts.get(c.id) ?? 0 }));

    return {
      owned: withCount(owned ?? []),
      member: withCount(other ?? []),
    };
  });

const CreateCircleInput = z.object({
  name: z.string().min(1).max(60).trim(),
  description: z.string().max(280).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
});

const FREE_CIRCLES_CAP = 3;

export const createCircle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateCircleInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { count: ownedCount } = await supabase
      .from("circles")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId);
    if ((ownedCount ?? 0) >= FREE_CIRCLES_CAP) {
      const { isPlus } = await import("@/lib/plus-guard.server");
      const plus = await isPlus(supabase, userId as string);
      if (!plus) {
        throw new Error(`Free plan caps Circles at ${FREE_CIRCLES_CAP}. Upgrade to Plus for unlimited.`);
      }
    }
    const baseSlug = slugify(data.name);
    let slug = baseSlug;
    for (let i = 1; i < 50; i++) {
      const { data: exists } = await supabase
        .from("circles")
        .select("id")
        .eq("owner_id", userId)
        .eq("slug", slug)
        .maybeSingle();
      if (!exists) break;
      slug = `${baseSlug}-${i + 1}`;
    }
    const { data: row, error } = await supabase
      .from("circles")
      .insert({
        owner_id: userId,
        name: data.name,
        slug,
        description: data.description ?? null,
        color: data.color ?? null,
      })
      .select("id,name,slug")
      .single();
    if (error) throw new Error(error.message);
    // self as owner member
    await supabase
      .from("circle_members")
      .insert({ circle_id: row.id, user_id: userId, role: "owner", status: "active" });
    return row;
  });

const UpdateCircleInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(60).trim().optional(),
  description: z.string().max(280).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
});
export const updateCircle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpdateCircleInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...patch } = data;
    const { error } = await supabase.from("circles").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCircle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UuidInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("circles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCircleMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UuidInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows } = await supabase
      .from("circle_members")
      .select("id,user_id,role,status,joined_at")
      .eq("circle_id", data.id)
      .order("joined_at", { ascending: true });
    const ids = (rows ?? []).map((r) => r.user_id);
    let profs: Array<{ id: string; display_name: string | null; username: string | null; avatar_url: string | null }> = [];
    if (ids.length) {
      const { data } = await supabase
        .from("profiles")
        .select("id,display_name,username,avatar_url")
        .in("id", ids);
      profs = data ?? [];
    }
    const pmap = new Map(profs.map((p) => [p.id, p]));
    return {
      members: (rows ?? []).map((r) => ({
        ...r,
        profile: pmap.get(r.user_id) ?? null,
      })),
    };
  });

const AddMemberInput = z.object({
  circleId: z.string().uuid(),
  username: z.string().min(1).max(120).trim(),
});
export const addCircleMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AddMemberInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const uname = data.username.replace(/^@/, "");
    const { data: prof } = await supabase
      .from("profiles")
      .select("id,display_name,username")
      .or(`username.eq.${uname},display_name.eq.${uname}`)
      .maybeSingle();
    if (!prof) throw new Error("No user matches that username.");
    const { error } = await supabase
      .from("circle_members")
      .upsert(
        { circle_id: data.circleId, user_id: prof.id, status: "active", role: "member" },
        { onConflict: "circle_id,user_id" },
      );
    if (error) throw new Error(error.message);
    return { id: prof.id, display_name: prof.display_name, username: prof.username };
  });

const RemoveMemberInput = z.object({
  circleId: z.string().uuid(),
  userId: z.string().uuid(),
});
export const removeCircleMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => RemoveMemberInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("circle_members")
      .delete()
      .eq("circle_id", data.circleId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- FRIENDSHIPS ---------------- */

export const listFriends = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase
      .from("friendships")
      .select("id,user_low,user_high,requested_by,status,created_at")
      .or(`user_low.eq.${userId},user_high.eq.${userId}`)
      .order("created_at", { ascending: false });

    const otherIds = Array.from(
      new Set((rows ?? []).map((r) => (r.user_low === userId ? r.user_high : r.user_low))),
    );

    let profs: Array<{ id: string; display_name: string | null; username: string | null; avatar_url: string | null }> = [];
    if (otherIds.length) {
      const { data } = await supabase
        .from("profiles")
        .select("id,display_name,username,avatar_url")
        .in("id", otherIds);
      profs = data ?? [];
    }
    const pmap = new Map(profs.map((p) => [p.id, p]));

    const shape = (r: NonNullable<typeof rows>[number]) => {
      const otherId = r.user_low === userId ? r.user_high : r.user_low;
      return {
        id: r.id,
        status: r.status,
        requested_by: r.requested_by,
        i_requested: r.requested_by === userId,
        other: pmap.get(otherId) ?? { id: otherId, display_name: null, username: null, avatar_url: null },
      };
    };

    return {
      accepted: (rows ?? []).filter((r) => r.status === "accepted").map(shape),
      incoming: (rows ?? []).filter((r) => r.status === "pending" && r.requested_by !== userId).map(shape),
      outgoing: (rows ?? []).filter((r) => r.status === "pending" && r.requested_by === userId).map(shape),
    };
  });

export const sendFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UsernameInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const uname = data.username.replace(/^@/, "");
    const { data: prof } = await supabase
      .from("profiles")
      .select("id,display_name,username")
      .or(`username.eq.${uname},display_name.eq.${uname}`)
      .maybeSingle();
    if (!prof) throw new Error("No user matches that username.");
    if (prof.id === userId) throw new Error("You can't friend yourself.");
    const low = userId < prof.id ? userId : prof.id;
    const high = userId < prof.id ? prof.id : userId;
    const { error } = await supabase
      .from("friendships")
      .upsert(
        { user_low: low, user_high: high, requested_by: userId, status: "pending" },
        { onConflict: "user_low,user_high", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
    return { ok: true, other: prof };
  });

const RespondInput = z.object({
  id: z.string().uuid(),
  action: z.enum(["accept", "decline"]),
});
export const respondFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => RespondInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("friendships")
      .update({ status: data.action === "accept" ? "accepted" : "declined" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeFriendship = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UuidInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("friendships").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- EVENT AUDIENCE ---------------- */

const AudienceModeInput = z.object({
  eventId: z.string().uuid(),
  mode: z.enum(["public", "friends", "circles_allowlist", "friends_except_blocklist"]),
});
export const setEventAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AudienceModeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ev } = await supabase
      .from("events")
      .select("host_user_id")
      .eq("id", data.eventId)
      .maybeSingle();
    if (!ev || ev.host_user_id !== userId) throw new Error("Not allowed.");
    const { error } = await supabase
      .from("events")
      .update({ audience_mode: data.mode })
      .eq("id", data.eventId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getEventAudience = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ev } = await supabase
      .from("events")
      .select("host_user_id,audience_mode")
      .eq("id", data.eventId)
      .maybeSingle();
    if (!ev || ev.host_user_id !== userId) throw new Error("Not allowed.");

    const { data: allow } = await supabase
      .from("event_circle_allowlist")
      .select("circle_id")
      .eq("event_id", data.eventId);
    const allowIds = (allow ?? []).map((r) => r.circle_id);
    let allowCircles: Array<{ id: string; name: string }> = [];
    if (allowIds.length) {
      const { data } = await supabase.from("circles").select("id,name").in("id", allowIds);
      allowCircles = data ?? [];
    }

    const { data: block } = await supabase
      .from("event_blocklist")
      .select("user_id")
      .eq("event_id", data.eventId);
    const blockIds = (block ?? []).map((r) => r.user_id);
    let blockUsers: Array<{ id: string; display_name: string | null; username: string | null }> = [];
    if (blockIds.length) {
      const { data } = await supabase
        .from("profiles")
        .select("id,display_name,username")
        .in("id", blockIds);
      blockUsers = data ?? [];
    }

    return {
      mode: (ev.audience_mode ?? "public") as
        | "public"
        | "friends"
        | "circles_allowlist"
        | "friends_except_blocklist",
      allowCircles,
      blockUsers,
      isHost: true,
    };
  });

const AllowlistMutate = z.object({
  eventId: z.string().uuid(),
  circleId: z.string().uuid(),
});
export const addAllowlistCircle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AllowlistMutate.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("event_circle_allowlist")
      .insert({ event_id: data.eventId, circle_id: data.circleId });
    if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
    return { ok: true };
  });

export const removeAllowlistCircle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AllowlistMutate.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("event_circle_allowlist")
      .delete()
      .eq("event_id", data.eventId)
      .eq("circle_id", data.circleId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const BlocklistAdd = z.object({
  eventId: z.string().uuid(),
  username: z.string().min(1).max(120).trim(),
});
export const addBlocklistUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => BlocklistAdd.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const uname = data.username.replace(/^@/, "");
    const { data: prof } = await supabase
      .from("profiles")
      .select("id,display_name,username")
      .or(`username.eq.${uname},display_name.eq.${uname}`)
      .maybeSingle();
    if (!prof) throw new Error("No user matches that username.");
    const { error } = await supabase
      .from("event_blocklist")
      .insert({ event_id: data.eventId, user_id: prof.id });
    if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
    return { id: prof.id, display_name: prof.display_name, username: prof.username };
  });

const BlocklistRemove = z.object({
  eventId: z.string().uuid(),
  userId: z.string().uuid(),
});
export const removeBlocklistUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => BlocklistRemove.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("event_blocklist")
      .delete()
      .eq("event_id", data.eventId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- HOME: FRIEND PULSE ---------------- */

export interface CircleActivityItem {
  kind: "completed_walk" | "posted_walk";
  ts: string;
  user: { id: string; display_name: string | null; username: string | null; avatar_url: string | null };
  // for completed_walk
  walk_session_id?: string;
  duration_min?: number;
  already_fived?: boolean;
  // for posted_walk
  event_id?: string;
  event_slug?: string | null;
  event_title?: string | null;
  starts_at?: string | null;
}

export const getCircleActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CircleActivityItem[]> => {
    const { supabase, userId } = context;

    // Find circle-mates
    const { data: myCircles } = await supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", userId)
      .eq("status", "active");
    const circleIds = (myCircles ?? []).map((r) => r.circle_id);
    if (!circleIds.length) return [];

    const { data: mateRows } = await supabase
      .from("circle_members")
      .select("user_id")
      .in("circle_id", circleIds)
      .eq("status", "active");
    const mateIds = Array.from(new Set((mateRows ?? []).map((r) => r.user_id).filter((id) => id !== userId)));
    if (!mateIds.length) return [];

    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();

    const [{ data: walks }, { data: events }] = await Promise.all([
      supabase
        .from("walk_sessions")
        .select("id,user_id,duration_seconds,ended_at,status")
        .in("user_id", mateIds)
        .eq("status", "completed")
        .gte("ended_at", since)
        .order("ended_at", { ascending: false })
        .limit(10),
      supabase
        .from("events")
        .select("id,slug,title,host_user_id,starts_at,status,created_at")
        .in("host_user_id", mateIds)
        .eq("status", "published")
        .gte("starts_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const walkIds = (walks ?? []).map((w) => w.id);
    const { data: fives } = walkIds.length
      ? await supabase
          .from("high_fives")
          .select("walk_session_id")
          .eq("from_user_id", userId)
          .in("walk_session_id", walkIds)
      : { data: [] as Array<{ walk_session_id: string }> };
    const fivedSet = new Set((fives ?? []).map((f) => f.walk_session_id));

    const allUserIds = Array.from(new Set([
      ...((walks ?? []).map((w) => w.user_id)),
      ...((events ?? []).map((e) => e.host_user_id)),
    ]));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,display_name,username,avatar_url")
      .in("id", allUserIds);
    const pmap = new Map((profs ?? []).map((p) => [p.id, p]));

    const items: CircleActivityItem[] = [];
    for (const w of walks ?? []) {
      const u = pmap.get(w.user_id);
      if (!u) continue;
      items.push({
        kind: "completed_walk",
        ts: w.ended_at as string,
        user: { id: u.id, display_name: u.display_name, username: u.username, avatar_url: u.avatar_url },
        walk_session_id: w.id,
        duration_min: Math.round((w.duration_seconds ?? 0) / 60),
        already_fived: fivedSet.has(w.id),
      });
    }
    for (const e of events ?? []) {
      const u = pmap.get(e.host_user_id);
      if (!u) continue;
      items.push({
        kind: "posted_walk",
        ts: e.created_at as string,
        user: { id: u.id, display_name: u.display_name, username: u.username, avatar_url: u.avatar_url },
        event_id: e.id,
        event_slug: e.slug,
        event_title: e.title,
        starts_at: e.starts_at,
      });
    }
    items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    return items.slice(0, 6);
  });

const HighFiveInput = z.object({ walkSessionId: z.string().uuid() });
export const sendHighFive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => HighFiveInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: walk } = await supabase
      .from("walk_sessions")
      .select("user_id")
      .eq("id", data.walkSessionId)
      .maybeSingle();
    if (!walk) throw new Error("Walk not found.");
    if (walk.user_id === userId) throw new Error("You can't high-five yourself.");
    const { error } = await supabase
      .from("high_fives")
      .insert({ from_user_id: userId, to_user_id: walk.user_id, walk_session_id: data.walkSessionId });
    if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
    return { ok: true };
  });
