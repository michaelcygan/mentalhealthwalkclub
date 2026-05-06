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
    if (roomErr || !room) throw new Error("Group walk not found");
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
