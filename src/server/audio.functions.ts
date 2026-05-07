import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const JoinSchema = z.object({
  roomId: z.string().uuid(),
  walkSessionId: z.string().uuid(),
});

export const joinAudioRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => JoinSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: walk, error: walkErr } = await supabase
      .from("walk_sessions")
      .select("id,status,user_id")
      .eq("id", data.walkSessionId)
      .single();
    if (walkErr || !walk) throw new Error("Walk session not found");
    if (walk.user_id !== userId) throw new Error("Not your walk");
    if (walk.status !== "active") throw new Error("You must be on an active walk to join audio");

    const { data: room, error: roomErr } = await supabase
      .from("audio_rooms")
      .select("id,max_participants,status")
      .eq("id", data.roomId)
      .single();
    if (roomErr || !room) throw new Error("Walk & Talk not found");
    if (room.status !== "open") throw new Error("This room is closed");

    const { count } = await supabase
      .from("audio_room_participants")
      .select("id", { count: "exact", head: true })
      .eq("audio_room_id", data.roomId)
      .eq("status", "active");

    if ((count ?? 0) >= room.max_participants) {
      throw new Error(`This walk is full (${room.max_participants} of ${room.max_participants})`);
    }

    // Upsert-style: if already active, do nothing
    const { data: existing } = await supabase
      .from("audio_room_participants")
      .select("id,status")
      .eq("audio_room_id", data.roomId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (!existing) {
      const { error: insertErr } = await supabase.from("audio_room_participants").insert({
        audio_room_id: data.roomId,
        user_id: userId,
        walk_session_id: data.walkSessionId,
      });
      if (insertErr) throw new Error(insertErr.message);
    }

    return { ok: true, capacity: room.max_participants, current: (count ?? 0) + (existing ? 0 : 1) };
  });

const MatchSchema = z.object({
  walkSessionId: z.string().uuid(),
  mood: z.string().trim().max(40).optional().nullable(),
});

function timeOfDayBucket(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return "late night";
  if (h < 9) return "morning";
  if (h < 12) return "late morning";
  if (h < 14) return "midday";
  if (h < 17) return "afternoon";
  if (h < 20) return "evening";
  return "night";
}

export const matchOrCreateAudioRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => MatchSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify walk is active and belongs to user
    const { data: walk } = await supabase
      .from("walk_sessions")
      .select("id,user_id,status")
      .eq("id", data.walkSessionId)
      .single();
    if (!walk || walk.user_id !== userId) throw new Error("Walk not found");
    if (walk.status !== "active") throw new Error("Your walk isn't active");

    // Find warm rooms (open, under cap, with at least 1 walker), prefer the loneliest
    const { data: rooms } = await supabase
      .from("audio_rooms")
      .select("id,title,max_participants,current_participant_count")
      .eq("status", "open")
      .gt("current_participant_count", 0)
      .order("current_participant_count", { ascending: true })
      .limit(8);

    const warm = (rooms ?? []).find((r) => r.current_participant_count < r.max_participants);
    if (warm) {
      return { roomId: warm.id, title: warm.title, capacity: warm.max_participants, created: false };
    }

    // Otherwise spin up a fresh persistent room
    const bucket = timeOfDayBucket();
    const title = `${bucket.charAt(0).toUpperCase() + bucket.slice(1)} walk`;
    const { data: created, error } = await supabase
      .from("audio_rooms")
      .insert({
        title,
        theme: data.mood ?? bucket,
        room_type: "open",
        status: "open",
        host_user_id: userId,
        max_participants: 8,
        requires_active_walk: true,
      })
      .select("id,title,max_participants")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not open a room");
    return { roomId: created.id, title: created.title, capacity: created.max_participants, created: true };
  });

const LeaveSchema = z.object({ roomId: z.string().uuid() });

export const leaveAudioRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => LeaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("audio_room_participants")
      .update({ status: "left", left_at: new Date().toISOString() })
      .eq("audio_room_id", data.roomId)
      .eq("user_id", userId)
      .eq("status", "active");
    return { ok: true };
  });
