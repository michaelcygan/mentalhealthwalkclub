import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const UserIdInput = z.object({ userId: z.string().uuid() });
const UsernameInput = z.object({ username: z.string().min(1).max(64) });

function buildPublicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/* ---------------- Public: read profile by username (no auth) ---------------- */

export const getPublicProfileByUsername = createServerFn({ method: "GET" })
  .inputValidator((d) => UsernameInput.parse(d))
  .handler(async ({ data }) => {
    const supabase = buildPublicClient();
    if (!supabase) return null;
    const uname = data.username.replace(/^@/, "").toLowerCase();
    const { data: prof } = await supabase
      .from("public_profiles")
      .select(
        "id,username,display_name,bio,avatar_url,location_label,walks_hosted,walks_attended,current_streak_weeks,is_host_account,created_at",
      )
      .ilike("username", uname)
      .maybeSingle();
    if (!prof || !prof.id) return null;

    const { data: counts } = await supabase.rpc("follow_counts", { _user: prof.id });
    const c = Array.isArray(counts) ? counts[0] : counts;

    // Public upcoming walks they host.
    const { data: upcoming } = await supabase
      .from("public_events" as never)
      .select(
        "id,slug,title,starts_at,timezone,venue_name,city,neighborhood,lat,lng,attendee_count,image_url,cover_override_url,host_user_id,group_id,audience_mode,visibility",
      )
      .eq("host_user_id", prof.id)
      .order("starts_at", { ascending: true })
      .limit(12);

    type EventRow = {
      id: string; slug: string; title: string; starts_at: string;
      timezone: string | null; venue_name: string | null; city: string | null;
      neighborhood: string | null; lat: number | string | null; lng: number | string | null;
      attendee_count: number; image_url: string | null; cover_override_url: string | null;
      host_user_id: string | null; group_id: string | null;
      audience_mode: string; visibility: string;
    };
    const upcomingWalks = ((upcoming ?? []) as unknown as EventRow[]).map((r) => ({
      ...r,
      image_url: r.cover_override_url ?? r.image_url,
    }));

    return {
      profile: prof,
      counts: {
        followers: c?.followers ?? 0,
        following: c?.following ?? 0,
        mutuals: c?.mutuals ?? 0,
      },
      upcomingWalks,
    };
  });

/* ---------------- Signed-in: follow state, follow, unfollow ---------------- */

export const getFollowState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UserIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.userId === userId) return { iFollow: false, followsMe: false, mutual: false, self: true };
    const { data: rows } = await supabase
      .from("follows")
      .select("follower_id,followee_id")
      .or(
        `and(follower_id.eq.${userId},followee_id.eq.${data.userId}),and(follower_id.eq.${data.userId},followee_id.eq.${userId})`,
      );
    const iFollow = !!rows?.some((r) => r.follower_id === userId && r.followee_id === data.userId);
    const followsMe = !!rows?.some((r) => r.follower_id === data.userId && r.followee_id === userId);
    return { iFollow, followsMe, mutual: iFollow && followsMe, self: false };
  });

export const followUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UserIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.userId === userId) throw new Error("You can't follow yourself.");
    const { error } = await supabase
      .from("follows")
      .upsert({ follower_id: userId, followee_id: data.userId }, { onConflict: "follower_id,followee_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);

    // Check for mutual now.
    const { data: back } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", data.userId)
      .eq("followee_id", userId)
      .maybeSingle();
    const mutual = !!back;

    const { data: me } = await supabase
      .from("profiles")
      .select("display_name,username")
      .eq("id", userId)
      .maybeSingle();
    const who = me?.display_name ?? me?.username ?? "Someone";
    try {
      const { emitNotification } = await import("./notifications.server");
      await emitNotification({
        userId: data.userId,
        actorId: userId,
        kind: mutual ? "mutual" : "follow",
        title: mutual ? `${who} follows you back` : `${who} started following you`,
        link: me?.username ? `/u/${me.username}` : "/",
        entityId: userId,
      });
    } catch { /* ignore notification failure */ }

    return { ok: true, mutual };
  });

export const unfollowUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UserIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", userId)
      .eq("followee_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Signed-in: list followers / following / mutuals ---------------- */

const ListInput = z.object({
  userId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).default(50),
});

type ProfileLite = { id: string; display_name: string | null; username: string | null; avatar_url: string | null };
type AnySupabase = ReturnType<typeof buildPublicClient>;

async function loadProfiles(supabase: AnySupabase | unknown, ids: string[]) {
  if (!ids.length || !supabase) return new Map<string, ProfileLite>();
  const { data } = await (supabase as NonNullable<AnySupabase>)
    .from("profiles")
    .select("id,display_name,username,avatar_url")
    .in("id", ids);
  return new Map<string, ProfileLite>((data ?? []).map((p) => [p.id, p]));
}

export const listFollowers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ListInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("follows")
      .select("follower_id,created_at")
      .eq("followee_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    const ids = (rows ?? []).map((r) => r.follower_id);
    const pmap = await loadProfiles(context.supabase, ids);
    return (rows ?? []).map((r) => ({
      user: pmap.get(r.follower_id) ?? { id: r.follower_id, display_name: null, username: null, avatar_url: null },
      created_at: r.created_at,
    }));
  });

export const listFollowing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ListInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("follows")
      .select("followee_id,created_at")
      .eq("follower_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    const ids = (rows ?? []).map((r) => r.followee_id);
    const pmap = await loadProfiles(context.supabase, ids);
    return (rows ?? []).map((r) => ({
      user: pmap.get(r.followee_id) ?? { id: r.followee_id, display_name: null, username: null, avatar_url: null },
      created_at: r.created_at,
    }));
  });

export const listMutuals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid().optional(), limit: z.number().int().min(1).max(100).default(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const uid = data.userId ?? context.userId;
    const { data: mine } = await context.supabase
      .from("follows")
      .select("followee_id")
      .eq("follower_id", uid)
      .limit(500);
    const followeeIds = (mine ?? []).map((r) => r.followee_id);
    if (!followeeIds.length) return [];
    const { data: back } = await context.supabase
      .from("follows")
      .select("follower_id")
      .eq("followee_id", uid)
      .in("follower_id", followeeIds)
      .limit(data.limit);
    const ids = (back ?? []).map((r) => r.follower_id);
    const pmap = await loadProfiles(context.supabase, ids);
    return ids.map((id) => pmap.get(id) ?? { id, display_name: null, username: null, avatar_url: null });
  });
