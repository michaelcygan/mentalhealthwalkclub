import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    const startsAt = new Date(data.startsAt);
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

/** List the current user's friend walks (scheduled + recently live). */
export const listMyFriendWalks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("audio_rooms")
      .select("id, title, share_code, status, starts_at, ends_at, current_participant_count, created_at")
      .eq("room_type", "friend")
      .eq("host_user_id", userId)
      .in("status", ["scheduled", "open"])
      .order("starts_at", { ascending: true, nullsFirst: false })
      .limit(20);
    return { walks: data ?? [] };
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
      const isHost = room.host_user_id === userId;
      if (!isHost && startMs > Date.now()) throw new Error("this walk hasn't started yet");
      await supabase.from("audio_rooms").update({ status: "open" }).eq("id", room.id);
    }

    // Auto-listener if room is at speaker capacity
    const speakerCount = room.current_participant_count ?? 0;
    const forceListener = data.asListener || speakerCount >= (room.max_participants ?? 4);
    const participantRole = forceListener ? "listener" : "speaker";

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
