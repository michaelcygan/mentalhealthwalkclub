import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  hours: z.number().int().min(1).max(168).default(48),
  limit: z.number().int().min(1).max(20).default(6),
});

function milesBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Walks happening within `hours` from now. RLS filters out group walks the
 * user can't see. When lat/lng provided, we Haversine-filter to ≤25mi.
 */
export const discoverNearbyWalks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const now = new Date();
    const until = new Date(now.getTime() + data.hours * 60 * 60 * 1000);

    const { data: rows, error } = await supabase
      .from("events")
      .select(
        "id,slug,title,starts_at,timezone,venue_name,city,neighborhood:meeting_point,lat,lng,attendee_count,image_url,audience_mode,visibility,group_id,host_user_id",
      )
      .eq("status", "published")
      .gte("starts_at", now.toISOString())
      .lte("starts_at", until.toISOString())
      .order("starts_at", { ascending: true })
      .limit(80);
    if (error) throw new Error(error.message);

    let withDist = (rows ?? []).map((r) => ({ ...r, miles: null as number | null }));
    if (data.lat != null && data.lng != null) {
      withDist = withDist
        .map((r) => {
          if (r.lat == null || r.lng == null) return { ...r, miles: null };
          const miles = milesBetween(data.lat!, data.lng!, Number(r.lat), Number(r.lng));
          return { ...r, miles };
        })
        .filter((r) => r.miles == null || r.miles <= 25)
        .sort((a, b) => {
          const t = new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
          if (t !== 0) return t;
          return (a.miles ?? 9999) - (b.miles ?? 9999);
        });
    }

    return { walks: withDist.slice(0, data.limit) };
  });

/* ---------- Featured events (admin-curated) ---------- */

export const discoverFeaturedEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limit: z.number().int().min(1).max(12).default(6) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const now = new Date().toISOString();
    const { data: rows, error } = await supabase
      .from("events")
      .select(
        "id,slug,title,starts_at,timezone,venue_name,city,neighborhood:meeting_point,lat,lng,attendee_count,image_url,audience_mode,visibility,group_id,host_user_id",
      )
      .eq("status", "published")
      .eq("is_featured", true)
      .gte("starts_at", now)
      .order("starts_at", { ascending: true })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { walks: (rows ?? []).map((r) => ({ ...r, miles: null as number | null })) };
  });

/* ---------- Friends going ---------- */

export const discoverFriendsGoing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limit: z.number().int().min(1).max(20).default(6) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Accepted friends
    const { data: friendRows } = await supabase
      .from("friendships")
      .select("user_low,user_high")
      .eq("status", "accepted")
      .or(`user_low.eq.${userId},user_high.eq.${userId}`);

    const friendIds = Array.from(
      new Set(
        (friendRows ?? []).map((r) => (r.user_low === userId ? r.user_high : r.user_low)),
      ),
    );

    // Circle-mates
    const { data: myCircles } = await supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", userId)
      .eq("status", "active");
    const circleIds = (myCircles ?? []).map((r) => r.circle_id);

    let mateIds: string[] = [];
    if (circleIds.length) {
      const { data: mateRows } = await supabase
        .from("circle_members")
        .select("user_id")
        .in("circle_id", circleIds)
        .eq("status", "active");
      mateIds = Array.from(
        new Set((mateRows ?? []).map((r) => r.user_id).filter((id) => id !== userId)),
      );
    }

    const connectedIds = Array.from(new Set([...friendIds, ...mateIds]));
    if (!connectedIds.length) return { events: [] as FriendGoingEvent[] };

    const now = new Date().toISOString();
    const { data: rsvpRows } = await supabase
      .from("event_rsvps")
      .select("event_id,user_id")
      .in("user_id", connectedIds)
      .eq("status", "going");

    const eventIds = Array.from(new Set((rsvpRows ?? []).map((r) => r.event_id)));
    if (!eventIds.length) return { events: [] as FriendGoingEvent[] };

    const { data: events } = await supabase
      .from("events")
      .select(
        "id,slug,title,starts_at,timezone,venue_name,city,neighborhood:meeting_point,lat,lng,attendee_count,image_url,audience_mode,visibility,host_user_id",
      )
      .in("id", eventIds)
      .eq("status", "published")
      .gte("starts_at", now)
      .order("starts_at", { ascending: true })
      .limit(data.limit);

    if (!events?.length) return { events: [] as FriendGoingEvent[] };

    // Resolve going friend profiles per event
    const rsvpMap = new Map<string, string[]>();
    for (const r of rsvpRows ?? []) {
      const list = rsvpMap.get(r.event_id) ?? [];
      list.push(r.user_id);
      rsvpMap.set(r.event_id, list);
    }

    const allUserIds = Array.from(new Set(connectedIds));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,display_name,username,avatar_url")
      .in("id", allUserIds);
    const pmap = new Map((profs ?? []).map((p) => [p.id, p]));

    const shaped: FriendGoingEvent[] = events.map((e) => {
      const goingIds = (rsvpMap.get(e.id) ?? []).filter((id) => id !== userId);
      const goingFriends = goingIds.map((id) => pmap.get(id)).filter(Boolean) as NonNullable<
        typeof pmap extends Map<string, infer V> ? V : never
      >[];
      return {
        ...e,
        miles: null as number | null,
        going_friends: goingFriends.slice(0, 3).map((p) => ({
          id: p.id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
        })),
        going_count: goingIds.length,
      };
    });

    return { events: shaped };
  });

export interface FriendGoingEvent {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  timezone: string | null;
  venue_name: string | null;
  city: string | null;
  neighborhood: string | null;
  lat: number | string | null;
  lng: number | string | null;
  attendee_count: number;
  image_url: string | null;
  audience_mode: string;
  visibility: string;
  host_user_id: string | null;
  miles: number | null;
  going_friends: Array<{ id: string; display_name: string | null; avatar_url: string | null }>;
  going_count: number;
}

/* ---------- Circle summary ---------- */

export const discoverMyCircleSummary = createServerFn({ method: "GET" })
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

    const all = [...(owned ?? []), ...(other ?? [])];
    const ids = all.map((c) => c.id);

    // member counts
    const counts = new Map<string, number>();
    const avatars = new Map<string, Array<{ avatar_url: string | null; display_name: string | null }>>();
    if (ids.length) {
      const { data: m } = await supabase
        .from("circle_members")
        .select("circle_id,user_id")
        .in("circle_id", ids)
        .eq("status", "active");
      for (const row of m ?? []) {
        counts.set(row.circle_id, (counts.get(row.circle_id) ?? 0) + 1);
      }
      const userIds = Array.from(new Set((m ?? []).map((r) => r.user_id)));
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,avatar_url,display_name")
          .in("id", userIds);
        const pmap = new Map((profs ?? []).map((p) => [p.id, p]));
        for (const row of m ?? []) {
          const p = pmap.get(row.user_id);
          if (!p) continue;
          const list = avatars.get(row.circle_id) ?? [];
          if (!list.some((x) => x.avatar_url === p.avatar_url && x.display_name === p.display_name)) {
            list.push({ avatar_url: p.avatar_url, display_name: p.display_name });
          }
          avatars.set(row.circle_id, list);
        }
      }
    }

    // active walkers this week per circle (unique members who completed a walk in last 7d)
    const activeWalkers = new Map<string, number>();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    if (ids.length) {
      const { data: cm } = await supabase
        .from("circle_members")
        .select("circle_id,user_id")
        .in("circle_id", ids)
        .eq("status", "active");
      const memberToCircles = new Map<string, string[]>();
      const allMemberIds = new Set<string>();
      for (const r of cm ?? []) {
        allMemberIds.add(r.user_id);
        const list = memberToCircles.get(r.user_id) ?? [];
        list.push(r.circle_id);
        memberToCircles.set(r.user_id, list);
      }
      if (allMemberIds.size) {
        // Single query: pull all recently-active member IDs, then fan out in JS.
        // Replaces per-circle .select(count) loop (N+1 → 1 round-trip).
        const { data: recent } = await supabase
          .from("walk_sessions")
          .select("user_id")
          .in("user_id", Array.from(allMemberIds))
          .eq("status", "completed")
          .gte("ended_at", weekAgo);
        const activeUserIds = new Set((recent ?? []).map((r) => r.user_id));
        // Count, per circle, members who appear in activeUserIds.
        for (const [uid, cids] of memberToCircles.entries()) {
          if (!activeUserIds.has(uid)) continue;
          for (const cid of cids) {
            activeWalkers.set(cid, (activeWalkers.get(cid) ?? 0) + 1);
          }
        }
      }
    }

    return {
      circles: all.map((c) => ({
        ...c,
        member_count: counts.get(c.id) ?? 0,
        avatars: (avatars.get(c.id) ?? []).slice(0, 4),
        active_walkers: activeWalkers.get(c.id) ?? 0,
        owned_by_me: (owned ?? []).some((o) => o.id === c.id),
      })),
    };
  });

/* ---------- Memories ---------- */

export const discoverMemories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limit: z.number().int().min(1).max(12).default(8) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: walkSessions } = await supabase
      .from("walk_sessions")
      .select("id,started_at,ended_at,duration_seconds,event_id")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("ended_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("ended_at", { ascending: false })
      .limit(data.limit);

    const memories = (walkSessions ?? []).map((ws) => ({
      id: ws.id,
      kind: "walk" as const,
      date: ws.started_at,
      duration_min: ws.duration_seconds ? Math.round(ws.duration_seconds / 60) : null,
      event_id: ws.event_id,
    }));

    return { memories };
  });

/* ---------- Quick RSVP ---------- */

const QuickRsvpInput = z.object({ eventId: z.string().uuid() });

export const quickRsvpEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => QuickRsvpInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify the event exists and is upcoming
    const { data: ev } = await supabase
      .from("events")
      .select("id,starts_at,status")
      .eq("id", data.eventId)
      .maybeSingle();
    if (!ev) throw new Error("Event not found.");
    if (ev.status !== "published") throw new Error("Event is not published.");
    if (new Date(ev.starts_at).getTime() < Date.now() - 3 * 60 * 60 * 1000) {
      throw new Error("This walk has already started.");
    }

    const { error } = await supabase
      .from("event_rsvps")
      .upsert({ event_id: data.eventId, user_id: userId, status: "going" }, { onConflict: "event_id,user_id" });
    if (error) throw new Error(error.message);

    return { ok: true };
  });

/* ---------- Admin: feature toggle ---------- */

const FeatureInput = z.object({
  eventId: z.string().uuid(),
  featured: z.boolean(),
});

export const setEventFeatured = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => FeatureInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admin only.");
    const { error } = await supabase
      .from("events")
      .update({ is_featured: data.featured })
      .eq("id", data.eventId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- Home upcoming rail ---------- */

export interface HomeUpcomingMine {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  timezone: string | null;
  venue_name: string | null;
  city: string | null;
  image_url: string | null;
  attendee_count: number;
  role: "host" | "going";
}

export const getHomeUpcoming = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ mine: HomeUpcomingMine[]; friends: FriendGoingEvent[] }> => {
    const { supabase, userId } = context;
    const now = new Date();
    const nowIso = now.toISOString();
    const weekIso = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Hosted
    const { data: hosted } = await supabase
      .from("events")
      .select("id,slug,title,starts_at,timezone,venue_name,city,image_url,attendee_count")
      .eq("host_user_id", userId)
      .eq("status", "published")
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(5);

    // RSVP'd going
    const { data: rsvps } = await supabase
      .from("event_rsvps")
      .select("event_id")
      .eq("user_id", userId)
      .eq("status", "going");
    const rsvpIds = (rsvps ?? []).map((r) => r.event_id);

    let going: typeof hosted = [];
    if (rsvpIds.length) {
      const { data } = await supabase
        .from("events")
        .select("id,slug,title,starts_at,timezone,venue_name,city,image_url,attendee_count")
        .in("id", rsvpIds)
        .eq("status", "published")
        .gte("starts_at", nowIso)
        .order("starts_at", { ascending: true })
        .limit(5);
      going = data ?? [];
    }

    const seen = new Set<string>();
    const mine: HomeUpcomingMine[] = [];
    for (const e of hosted ?? []) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      mine.push({ ...e, role: "host" });
    }
    for (const e of going ?? []) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      mine.push({ ...e, role: "going" });
    }
    mine.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    const mineTop = mine.slice(0, 3);
    const mineIds = new Set(mineTop.map((m) => m.id));

    // Friends going this week (reuse logic, narrow window, exclude mine)
    const { data: friendRows } = await supabase
      .from("friendships")
      .select("user_low,user_high")
      .eq("status", "accepted")
      .or(`user_low.eq.${userId},user_high.eq.${userId}`);
    const friendIds = Array.from(
      new Set((friendRows ?? []).map((r) => (r.user_low === userId ? r.user_high : r.user_low))),
    );

    const { data: myCircles } = await supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", userId)
      .eq("status", "active");
    const circleIds = (myCircles ?? []).map((r) => r.circle_id);
    let mateIds: string[] = [];
    if (circleIds.length) {
      const { data: mateRows } = await supabase
        .from("circle_members")
        .select("user_id")
        .in("circle_id", circleIds)
        .eq("status", "active");
      mateIds = Array.from(
        new Set((mateRows ?? []).map((r) => r.user_id).filter((id) => id !== userId)),
      );
    }
    const connectedIds = Array.from(new Set([...friendIds, ...mateIds]));

    let friends: FriendGoingEvent[] = [];
    if (connectedIds.length) {
      const { data: friendRsvps } = await supabase
        .from("event_rsvps")
        .select("event_id,user_id")
        .in("user_id", connectedIds)
        .eq("status", "going");
      const candidateIds = Array.from(
        new Set((friendRsvps ?? []).map((r) => r.event_id).filter((id) => !mineIds.has(id))),
      );

      if (candidateIds.length) {
        const { data: events } = await supabase
          .from("events")
          .select(
            "id,slug,title,starts_at,timezone,venue_name,city,neighborhood:meeting_point,lat,lng,attendee_count,image_url,audience_mode,visibility,host_user_id",
          )
          .in("id", candidateIds)
          .eq("status", "published")
          .gte("starts_at", nowIso)
          .lte("starts_at", weekIso)
          .order("starts_at", { ascending: true })
          .limit(3);

        if (events?.length) {
          const rsvpMap = new Map<string, string[]>();
          for (const r of friendRsvps ?? []) {
            const list = rsvpMap.get(r.event_id) ?? [];
            list.push(r.user_id);
            rsvpMap.set(r.event_id, list);
          }
          const { data: profs } = await supabase
            .from("profiles")
            .select("id,display_name,username,avatar_url")
            .in("id", connectedIds);
          const pmap = new Map((profs ?? []).map((p) => [p.id, p]));
          friends = events.map((e) => {
            const goingIds = (rsvpMap.get(e.id) ?? []).filter((id) => id !== userId);
            const goingFriends = goingIds
              .map((id) => pmap.get(id))
              .filter(Boolean) as Array<{ id: string; display_name: string | null; avatar_url: string | null }>;
            return {
              ...e,
              miles: null,
              going_friends: goingFriends.slice(0, 3).map((p) => ({
                id: p.id,
                display_name: p.display_name,
                avatar_url: p.avatar_url,
              })),
              going_count: goingIds.length,
            };
          });
        }
      }
    }

    return { mine: mineTop, friends };
  });

