import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePlus } from "@/lib/plus-guard.server";

// short, URL-friendly, unambiguous (no 0/O/1/l)
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
function makeCode(len = 6) {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

/** Create a Friend Walk: room + walk_session + host participant. Returns share code + walk id. */
export const createFriendWalk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requirePlus(supabase, userId as string);

    // Get a unique code (retry up to 5x)
    let code = "";
    for (let i = 0; i < 5; i++) {
      const c = makeCode();
      const { data: existing } = await supabase.from("audio_rooms").select("id").eq("share_code", c).maybeSingle();
      if (!existing) { code = c; break; }
    }
    if (!code) throw new Error("couldn't mint a share code");

    // Display name for room title
    const { data: profile } = await supabase.from("profiles").select("display_name, username").eq("id", userId).maybeSingle();
    const name = profile?.display_name || profile?.username || "a friend";

    const { data: room, error: roomErr } = await supabase
      .from("audio_rooms")
      .insert({
        title: `${name}'s walk`,
        room_type: "friend",
        host_user_id: userId,
        max_participants: 4,
        requires_active_walk: false,
        share_code: code,
        status: "open",
        audience_mode: "broadcast",
        allow_guest_listeners: true,
        reactions_enabled: true,
      })
      .select("id")
      .single();
    if (roomErr || !room) throw new Error(roomErr?.message ?? "couldn't open room");

    const { data: walk, error: walkErr } = await supabase
      .from("walk_sessions")
      .insert({ user_id: userId, walk_type: "audio", status: "active", audio_room_id: room.id })
      .select("id")
      .single();
    if (walkErr || !walk) throw new Error(walkErr?.message ?? "couldn't start walk");

    await supabase.from("audio_room_participants").insert({
      audio_room_id: room.id,
      walk_session_id: walk.id,
      user_id: userId,
      role: "host",
      participant_role: "speaker",
      status: "active",
    });

    return { code, walkId: walk.id, roomId: room.id };
  });

/** Schedule a Friend Walk for a future time. Returns share code (room only — no walk session yet). */
export const scheduleFriendWalk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      startsAt: z.string().datetime(),
      durationMinutes: z.number().int().min(15).max(240).default(45),
      title: z.string().trim().max(80).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requirePlus(supabase, userId as string);
    if (startsAt.getTime() < Date.now() - 60_000) throw new Error("pick a future time");
    const endsAt = new Date(startsAt.getTime() + data.durationMinutes * 60_000);

    let code = "";
    for (let i = 0; i < 5; i++) {
      const c = makeCode();
      const { data: existing } = await supabase.from("audio_rooms").select("id").eq("share_code", c).maybeSingle();
      if (!existing) { code = c; break; }
    }
    if (!code) throw new Error("couldn't mint a share code");

    const { data: profile } = await supabase.from("profiles").select("display_name, username").eq("id", userId).maybeSingle();
    const name = profile?.display_name || profile?.username || "a friend";

    const { data: room, error: roomErr } = await supabase
      .from("audio_rooms")
      .insert({
        title: data.title?.trim() || `${name}'s walk`,
        room_type: "friend",
        host_user_id: userId,
        max_participants: 4,
        requires_active_walk: false,
        share_code: code,
        status: "scheduled",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        audience_mode: "broadcast",
        allow_guest_listeners: true,
        reactions_enabled: true,
      })
      .select("id")
      .single();
    if (roomErr || !room) throw new Error(roomErr?.message ?? "couldn't schedule walk");

    return { code, roomId: room.id, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
  });

/** Cancel a scheduled or open Friend Walk (host only). */
export const cancelFriendWalk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ roomId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: room } = await supabase.from("audio_rooms").select("host_user_id, status").eq("id", data.roomId).maybeSingle();
    if (!room) throw new Error("walk not found");
    if (room.host_user_id !== userId) throw new Error("only the host can cancel");
    if (room.status === "closed" || room.status === "canceled") return { ok: true };
    await supabase.from("audio_rooms").update({ status: "canceled", ends_at: new Date().toISOString() }).eq("id", data.roomId);
    return { ok: true };
  });

/** Reschedule a scheduled Friend Walk to a new start time (host only). */
export const rescheduleFriendWalk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      roomId: z.string().uuid(),
      startsAt: z.string().datetime(),
      durationMinutes: z.number().int().min(15).max(240).default(45),
      title: z.string().trim().max(80).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: room } = await supabase.from("audio_rooms").select("host_user_id, status").eq("id", data.roomId).maybeSingle();
    if (!room) throw new Error("walk not found");
    if (room.host_user_id !== userId) throw new Error("only the host can reschedule");
    if (room.status !== "scheduled") throw new Error("only scheduled walks can be rescheduled");

    const startsAt = new Date(data.startsAt);
    if (startsAt.getTime() < Date.now() - 60_000) throw new Error("pick a future time");
    const endsAt = new Date(startsAt.getTime() + data.durationMinutes * 60_000);

    const patch: { starts_at: string; ends_at: string; title?: string } = {
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    };
    if (data.title) patch.title = data.title;
    await supabase.from("audio_rooms").update(patch).eq("id", data.roomId);
    return { ok: true, startsAt: startsAt.toISOString() };
  });

/** List the current user's friend walks (scheduled + recently live). Returns empty list when unauthenticated. */
export const listMyFriendWalks = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const request = getRequest();
      const authHeader = request?.headers?.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) return { walks: [] };
      const token = authHeader.slice(7);
      const { data: claims } = await supabaseAdmin.auth.getClaims(token);
      const userId = claims?.claims?.sub;
      if (!userId) return { walks: [] };
      const { data } = await supabaseAdmin
        .from("audio_rooms")
        .select("id, title, share_code, status, starts_at, ends_at, current_participant_count, created_at")
        .eq("room_type", "friend")
        .eq("host_user_id", userId)
        .in("status", ["scheduled", "open"])
        .order("starts_at", { ascending: true, nullsFirst: false })
        .limit(20);
      return { walks: data ?? [] };
    } catch (e) {
      console.error("listMyFriendWalks failed:", e);
      return { walks: [] };
    }
  });


/** Join an existing Friend Walk by share code. Returns walk id to navigate to. */
export const joinFriendWalk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ code: z.string().min(3).max(16), asListener: z.boolean().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: room } = await supabase
      .from("audio_rooms")
      .select("id, status, max_participants, host_user_id, current_participant_count, starts_at")
      .eq("share_code", data.code.toLowerCase())
      .maybeSingle();
    if (!room) throw new Error("walk not found");
    if (room.status === "closed") throw new Error("this walk has ended");
    if (room.status === "canceled") throw new Error("this walk was called off");
    // re-fetch lock state
    const { data: roomLock } = await supabase.from("audio_rooms").select("is_locked").eq("id", room.id).maybeSingle();
    const isHost = room.host_user_id === userId;
    if (roomLock?.is_locked && !isHost) throw new Error("the host has locked this walk");

    // Scheduled flow: host opens it on first join; others must wait until start time.
    if (room.status === "scheduled") {
      const startMs = room.starts_at ? new Date(room.starts_at).getTime() : 0;
      if (!isHost && startMs > Date.now()) throw new Error("this walk hasn't started yet");
      await supabase.from("audio_rooms").update({ status: "open" }).eq("id", room.id);
    }

    // Speakers stay capped at 4. Anyone over that joins the lobby (signed-in listener pool).
    const speakerCount = room.current_participant_count ?? 0;
    const forceListener = data.asListener || speakerCount >= (room.max_participants ?? 4);
    const participantRole = forceListener ? "lobby" : "speaker";

    // Create a fresh walk_session for this joiner
    const { data: walk, error: walkErr } = await supabase
      .from("walk_sessions")
      .insert({ user_id: userId, walk_type: "audio", status: "active", audio_room_id: room.id })
      .select("id")
      .single();
    if (walkErr || !walk) throw new Error(walkErr?.message ?? "couldn't start walk");

    await supabase.from("audio_room_participants").insert({
      audio_room_id: room.id,
      walk_session_id: walk.id,
      user_id: userId,
      role: room.host_user_id === userId ? "host" : "participant",
      participant_role: participantRole,
      status: "active",
    });

    return { walkId: walk.id, roomId: room.id, asListener: forceListener };
  });

/** Toggle hand-raise / lower for the current user in a room. */
export const toggleRaiseHand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ roomId: z.string().uuid(), raised: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("audio_room_participants")
      .update({ participant_role: data.raised ? "raised_hand" : "listener" })
      .eq("audio_room_id", data.roomId)
      .eq("user_id", userId)
      .eq("status", "active");
    return { ok: true };
  });

/** Host promotes a listener (or raised hand) to speaker. */
export const promoteToSpeaker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ roomId: z.string().uuid(), userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: room } = await supabase.from("audio_rooms").select("host_user_id").eq("id", data.roomId).maybeSingle();
    if (!room || room.host_user_id !== userId) throw new Error("only the host can promote");
    await supabase
      .from("audio_room_participants")
      .update({ participant_role: "speaker" })
      .eq("audio_room_id", data.roomId)
      .eq("user_id", data.userId)
      .eq("status", "active");
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────
// Public audience: guest-friendly listening + reactions
// ─────────────────────────────────────────────────────────


const REACTION_KINDS = ["heart", "clap", "leaf", "fire", "tear"] as const;

/** Public room snapshot for the landing page — guest safe (no auth required). */
export const getFriendWalkPublic = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ code: z.string().min(3).max(16) }).parse(input))
  .handler(async ({ data }) => {
    const { data: room } = await supabaseAdmin
      .from("audio_rooms")
      .select("id, title, status, starts_at, ends_at, room_type, host_user_id, max_participants, current_participant_count, audience_count, audience_mode, allow_guest_listeners, reactions_enabled, is_locked")
      .eq("share_code", data.code.toLowerCase())
      .maybeSingle();
    if (!room || room.room_type !== "friend") return { room: null };
    let host: { display_name: string | null; avatar_url: string | null } | null = null;
    if (room.host_user_id) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", room.host_user_id)
        .maybeSingle();
      if (p) host = { display_name: p.display_name, avatar_url: p.avatar_url };
    }
    return { room: { ...room, host } };
  });

/** Guest joins the audience (read-only). Requires a stable guest_id from the client. */
export const joinAudience = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      code: z.string().min(3).max(16),
      guestId: z.string().min(8).max(64).regex(/^[a-z0-9-]+$/i),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const { data: room } = await supabaseAdmin
      .from("audio_rooms")
      .select("id, room_type, status, allow_guest_listeners")
      .eq("share_code", data.code.toLowerCase())
      .maybeSingle();
    if (!room || room.room_type !== "friend") throw new Error("walk not found");
    if (room.status === "closed" || room.status === "canceled") throw new Error("this walk has ended");
    if (!room.allow_guest_listeners) throw new Error("guest listening isn't enabled");

    await supabaseAdmin
      .from("room_audience_presence")
      .upsert(
        { audio_room_id: room.id, guest_id: data.guestId, last_seen_at: new Date().toISOString() },
        { onConflict: "audio_room_id,guest_id" }
      );

    const { count } = await supabaseAdmin
      .from("room_audience_presence")
      .select("id", { count: "exact", head: true })
      .eq("audio_room_id", room.id)
      .gte("last_seen_at", new Date(Date.now() - 60_000).toISOString());

    await supabaseAdmin.from("audio_rooms").update({ audience_count: count ?? 0 }).eq("id", room.id);

    return { roomId: room.id, audienceCount: count ?? 0 };
  });

/** Heartbeat for an audience member (guest or signed in). */
export const audienceHeartbeat = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      roomId: z.string().uuid(),
      guestId: z.string().min(8).max(64).regex(/^[a-z0-9-]+$/i).optional(),
      userId: z.string().uuid().optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    if (!data.guestId && !data.userId) throw new Error("missing identity");
    const payload = {
      audio_room_id: data.roomId,
      last_seen_at: new Date().toISOString(),
      ...(data.userId ? { user_id: data.userId } : {}),
      ...(data.guestId ? { guest_id: data.guestId } : {}),
    };
    const conflict = data.userId ? "audio_room_id,user_id" : "audio_room_id,guest_id";
    await supabaseAdmin.from("room_audience_presence").upsert(payload, { onConflict: conflict });
    return { ok: true };
  });

/** Send a reaction. Works for guest + signed in. Server-side rate limited. */
export const sendReaction = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      roomId: z.string().uuid(),
      kind: z.enum(REACTION_KINDS),
      guestId: z.string().min(8).max(64).regex(/^[a-z0-9-]+$/i).optional(),
      userId: z.string().uuid().optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const { data: room } = await supabaseAdmin
      .from("audio_rooms")
      .select("id, room_type, status, reactions_enabled")
      .eq("id", data.roomId)
      .maybeSingle();
    if (!room || room.room_type !== "friend") throw new Error("walk not found");
    if (!room.reactions_enabled) throw new Error("reactions are off");
    if (room.status === "closed" || room.status === "canceled") throw new Error("walk has ended");
    if (!data.guestId && !data.userId) throw new Error("missing identity");

    // rate limit: max 6 reactions / 10s per actor
    const since = new Date(Date.now() - 10_000).toISOString();
    const q = supabaseAdmin
      .from("room_reactions")
      .select("id", { count: "exact", head: true })
      .eq("audio_room_id", data.roomId)
      .gte("created_at", since);
    if (data.userId) q.eq("user_id", data.userId);
    else if (data.guestId) q.eq("guest_id", data.guestId);
    const { count } = await q;
    if ((count ?? 0) >= 6) return { ok: false, throttled: true };

    await supabaseAdmin.from("room_reactions").insert({
      audio_room_id: data.roomId,
      kind: data.kind,
      user_id: data.userId ?? null,
      guest_id: data.guestId ?? null,
    });
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────
// Host controls
// ─────────────────────────────────────────────────────────

const hostOnly = async (supabase: { from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: { host_user_id: string } | null }> } } } }, roomId: string, userId: string) => {
  const { data: room } = await supabase.from("audio_rooms").select("host_user_id").eq("id", roomId).maybeSingle();
  if (!room || room.host_user_id !== userId) throw new Error("only the host can do that");
};

/** Lock or unlock the room (host only). */
export const setRoomLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ roomId: z.string().uuid(), locked: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await hostOnly(supabase as never, data.roomId, userId);
    await supabase.from("audio_rooms").update({ is_locked: data.locked }).eq("id", data.roomId);
    return { ok: true };
  });

/** Pause / resume reactions (host only). */
export const setReactionsEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ roomId: z.string().uuid(), enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await hostOnly(supabase as never, data.roomId, userId);
    await supabase.from("audio_rooms").update({ reactions_enabled: data.enabled }).eq("id", data.roomId);
    return { ok: true };
  });

/** Demote a speaker back to lobby (host only). */
export const demoteToLobby = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ roomId: z.string().uuid(), userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await hostOnly(supabase as never, data.roomId, userId);
    await supabase
      .from("audio_room_participants")
      .update({ participant_role: "lobby", is_muted: true })
      .eq("audio_room_id", data.roomId)
      .eq("user_id", data.userId)
      .eq("status", "active");
    return { ok: true };
  });

/** Remove someone from the room entirely (host only). */
export const kickParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ roomId: z.string().uuid(), userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await hostOnly(supabase as never, data.roomId, userId);
    await supabase
      .from("audio_room_participants")
      .update({ status: "removed", left_at: new Date().toISOString() })
      .eq("audio_room_id", data.roomId)
      .eq("user_id", data.userId)
      .eq("status", "active");
    return { ok: true };
  });
