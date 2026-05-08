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
      .select("id,max_participants,status,facilitator_seat_reserved")
      .eq("id", data.roomId)
      .single();
    if (roomErr || !room) throw new Error("Walk & Talk not found");
    if (room.status !== "open") throw new Error("This walk is closed");

    // Walker cap = total seats minus the reserved facilitator seat (if any)
    const walkerCap = Math.max(
      1,
      room.max_participants - (room.facilitator_seat_reserved ? 1 : 0),
    );

    const { count: walkerCount } = await supabase
      .from("audio_room_participants")
      .select("id", { count: "exact", head: true })
      .eq("audio_room_id", data.roomId)
      .eq("status", "active")
      .neq("role", "facilitator");

    if ((walkerCount ?? 0) >= walkerCap) {
      throw new Error(`This pod is full (${walkerCap} of ${walkerCap})`);
    }

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

    return { ok: true, capacity: walkerCap, current: (walkerCount ?? 0) + (existing ? 0 : 1) };
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

    const { data: walk } = await supabase
      .from("walk_sessions")
      .select("id,user_id,status")
      .eq("id", data.walkSessionId)
      .single();
    if (!walk || walk.user_id !== userId) throw new Error("Walk not found");
    if (walk.status !== "active") throw new Error("Your walk isn't active");

    // Only match into spontaneous rooms (no scheduled_event_id, no parent_room_id)
    const { data: rooms } = await supabase
      .from("audio_rooms")
      .select("id,title,max_participants,current_participant_count,scheduled_event_id,parent_room_id,facilitator_seat_reserved")
      .eq("status", "open")
      .gt("current_participant_count", 0)
      .is("scheduled_event_id", null)
      .is("parent_room_id", null)
      .order("current_participant_count", { ascending: true })
      .limit(8);

    const walkerCapOf = (r: any) =>
      Math.max(1, r.max_participants - (r.facilitator_seat_reserved ? 1 : 0));
    const warm = (rooms ?? []).find(
      (r: any) => r.current_participant_count < walkerCapOf(r),
    );
    if (warm) {
      return { roomId: warm.id, title: warm.title, capacity: walkerCapOf(warm), created: false };
    }

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
        max_participants: 5, // 4 walkers + 1 reserved facilitator seat
        facilitator_seat_reserved: true,
        requires_active_walk: true,
      })
      .select("id,title,max_participants")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not open a walk");
    return { roomId: created.id, title: created.title, capacity: 4, created: true };
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

    // If this was a breakout pod, consolidate remaining pods so nobody
    // gets stranded alone before the host closes the walk.
    const { data: room } = await supabase
      .from("audio_rooms")
      .select("parent_room_id,scheduled_event_id")
      .eq("id", data.roomId)
      .single();
    const parentId = room?.parent_room_id;
    if (parentId) {
      const { data: parent } = await supabase
        .from("audio_rooms")
        .select("scheduled_event_id")
        .eq("id", parentId)
        .single();
      if (parent?.scheduled_event_id) {
        await consolidatePodsImpl(supabase, parent.scheduled_event_id).catch(() => {});
      }
    }
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────
// Scheduled audio walks + breakout pods
// ─────────────────────────────────────────────────────────────────────

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "walk";
}

const ScheduleSchema = z.object({
  groupId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().max(1000).nullable().optional(),
  theme: z.string().trim().max(40).nullable().optional(),
  startsAt: z.string().min(1),
  durationMinutes: z.number().int().min(15).max(180).default(45),
  capacity: z.number().int().min(2).max(32).default(8),
  breakoutSize: z.number().int().min(0).max(6).default(4),
  breakoutRotateMinutes: z.number().int().min(0).max(60).nullable().optional(),
});

export const scheduleAudioWalk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ScheduleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const startMs = new Date(data.startsAt).getTime();
    if (!Number.isFinite(startMs)) throw new Error("Invalid start time");
    const endsAt = new Date(startMs + data.durationMinutes * 60_000).toISOString();
    const slug = `${slugify(data.title)}-${Math.random().toString(36).slice(2, 7)}`;

    const { data: room, error: roomErr } = await supabase
      .from("audio_rooms")
      .insert({
        title: data.title,
        theme: data.theme ?? null,
        room_type: "open",
        status: "scheduled",
        host_user_id: userId,
        group_id: data.groupId ?? null,
        max_participants: data.capacity,
        requires_active_walk: true,
        starts_at: data.startsAt,
        ends_at: endsAt,
      })
      .select("id")
      .single();
    if (roomErr || !room) throw new Error(roomErr?.message ?? "Could not create circle");

    const { data: ev, error: evErr } = await supabase
      .from("events")
      .insert({
        title: data.title,
        slug,
        description: data.description ?? null,
        starts_at: data.startsAt,
        ends_at: endsAt,
        capacity: data.capacity,
        host_user_id: userId,
        group_id: data.groupId ?? null,
        event_type: "audio_walk",
        status: "published",
        visibility: data.groupId ? "group" : "public",
        vibe: data.theme ?? null,
        audio_room_id: room.id,
        breakout_size: data.breakoutSize,
        breakout_rotate_minutes: data.breakoutRotateMinutes ?? null,
      })
      .select("id,slug")
      .single();
    if (evErr || !ev) throw new Error(evErr?.message ?? "Could not schedule");

    await supabase.from("audio_rooms").update({ scheduled_event_id: ev.id }).eq("id", room.id);

    return { eventId: ev.id, slug: ev.slug, roomId: room.id };
  });

const OpenSchema = z.object({ eventId: z.string().uuid() });

// Internal helper used by both server fn and cron hook
export async function openScheduledRoomImpl(supabase: any, eventId: string) {
  const { data: ev } = await supabase
    .from("events")
    .select("id,audio_room_id,breakout_size,capacity")
    .eq("id", eventId)
    .single();
  if (!ev || !ev.audio_room_id) throw new Error("Audio walk not found");

  const { data: room } = await supabase
    .from("audio_rooms")
    .select("id,status,max_participants,title,theme,group_id,host_user_id")
    .eq("id", ev.audio_room_id)
    .single();
  if (!room) throw new Error("Circle not found");
  if (room.status === "open") return { ok: true, alreadyOpen: true };

  await supabase.from("audio_rooms").update({ status: "open" }).eq("id", room.id);

  // Pre-create pods sized to actual RSVPs (not nominal capacity)
  if (ev.breakout_size > 0) {
    const { count: rsvpCount } = await supabase
      .from("event_rsvps")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "going");
    const N = rsvpCount ?? 0;
    const podCount = Math.max(1, Math.ceil(N / ev.breakout_size));
    const pods = Array.from({ length: podCount }, (_, i) => ({
      title: `${room.title} · pod ${i + 1}`,
      theme: room.theme,
      room_type: "open",
      status: "open",
      host_user_id: room.host_user_id,
      group_id: room.group_id,
      max_participants: ev.breakout_size + 1, // walkers + 1 reserved facilitator seat
      facilitator_seat_reserved: true,
      requires_active_walk: true,
      scheduled_event_id: eventId,
      parent_room_id: room.id,
      pod_index: i + 1,
    }));
    await supabase.from("audio_rooms").insert(pods);
  }
  return { ok: true, alreadyOpen: false };
}

export const openScheduledRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => OpenSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ev } = await supabase.from("events").select("host_user_id").eq("id", data.eventId).single();
    if (!ev || ev.host_user_id !== userId) throw new Error("Only the host can open this circle");
    return openScheduledRoomImpl(supabase, data.eventId);
  });

const JoinScheduledSchema = z.object({ eventId: z.string().uuid() });

export const joinScheduledWalk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => JoinScheduledSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ev } = await supabase
      .from("events")
      .select("id,audio_room_id,breakout_size,starts_at,status,group_id,visibility")
      .eq("id", data.eventId)
      .single();
    if (!ev || !ev.audio_room_id) throw new Error("Audio walk not found");

    // Group-only gate
    if (ev.visibility === "group" && ev.group_id) {
      const { data: mem } = await supabase
        .from("group_memberships")
        .select("id,status")
        .eq("group_id", ev.group_id)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();
      if (!mem) {
        const { data: g } = await supabase
          .from("groups").select("name,slug").eq("id", ev.group_id).single();
        return {
          requiresJoin: true as const,
          groupId: ev.group_id,
          groupName: g?.name ?? "the group",
          groupSlug: g?.slug ?? null,
        };
      }
    }

    // Auto-open if start time has passed and still scheduled
    const startMs = new Date(ev.starts_at).getTime();
    if (Date.now() >= startMs - 5 * 60_000) {
      const { data: roomCheck } = await supabase.from("audio_rooms").select("status").eq("id", ev.audio_room_id).single();
      if (roomCheck?.status === "scheduled") {
        await openScheduledRoomImpl(supabase, ev.id);
      }
    }

    // Find or create the user's active walk session
    const { data: existingSession } = await supabase
      .from("walk_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    let walkSessionId = existingSession?.id;
    if (!walkSessionId) {
      const { data: created, error: createErr } = await supabase
        .from("walk_sessions")
        .insert({
          user_id: userId,
          walk_type: "audio",
          status: "active",
          event_id: ev.id,
          privacy: "private",
        })
        .select("id")
        .single();
      if (createErr || !created) throw new Error(createErr?.message ?? "Could not start walk");
      walkSessionId = created.id;
    }

    // Pick target room: least-full pod, or umbrella if no pods
    let targetRoomId = ev.audio_room_id;
    let podIndex: number | null = null;
    let podCount = 0;

    if (ev.breakout_size > 0) {
      const { data: pods } = await supabase
        .from("audio_rooms")
        .select("id,pod_index,current_participant_count,max_participants")
        .eq("parent_room_id", ev.audio_room_id)
        .eq("status", "open")
        .order("current_participant_count", { ascending: true });
      podCount = pods?.length ?? 0;
      const open = (pods ?? []).find((p) => p.current_participant_count < p.max_participants);
      if (open) {
        targetRoomId = open.id;
        podIndex = open.pod_index;
      }
    }

    // Insert participant (idempotent)
    const { data: existing } = await supabase
      .from("audio_room_participants")
      .select("id")
      .eq("audio_room_id", targetRoomId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (!existing) {
      await supabase.from("audio_room_participants").insert({
        audio_room_id: targetRoomId,
        user_id: userId,
        walk_session_id: walkSessionId,
      });
      // Re-balance after late joins
      if (ev.breakout_size > 0) {
        await consolidatePodsImpl(supabase, ev.id).catch(() => {});
      }
    }

    return { requiresJoin: false as const, roomId: targetRoomId, walkSessionId, podIndex, podCount };
  });

const ReshuffleSchema = z.object({ eventId: z.string().uuid() });

export async function reshufflePodsImpl(supabase: any, eventId: string) {
  const { data: ev } = await supabase
    .from("events")
    .select("id,audio_room_id,breakout_size")
    .eq("id", eventId)
    .single();
  if (!ev?.audio_room_id || !ev.breakout_size) return { ok: true, rotated: 0 };

  const { data: pods } = await supabase
    .from("audio_rooms")
    .select("id")
    .eq("parent_room_id", ev.audio_room_id)
    .eq("status", "open");
  if (!pods || pods.length < 2) return { ok: true, rotated: 0 };

  const podIds = pods.map((p: { id: string }) => p.id);
  const { data: parts } = await supabase
    .from("audio_room_participants")
    .select("id,user_id,walk_session_id,audio_room_id")
    .in("audio_room_id", podIds)
    .eq("status", "active");
  if (!parts || parts.length < 2) return { ok: true, rotated: 0 };

  // Shuffle
  const shuffled = [...parts].sort(() => Math.random() - 0.5);
  let rotated = 0;
  for (let i = 0; i < shuffled.length; i++) {
    const target = podIds[i % podIds.length];
    if (shuffled[i].audio_room_id !== target) {
      await supabase.from("audio_room_participants").update({ audio_room_id: target }).eq("id", shuffled[i].id);
      rotated++;
    }
  }
  await supabase.from("events").update({ last_pod_rotation_at: new Date().toISOString() }).eq("id", eventId);
  return { ok: true, rotated };
}

export const reshufflePods = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ReshuffleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ev } = await supabase.from("events").select("host_user_id").eq("id", data.eventId).single();
    if (!ev || ev.host_user_id !== userId) throw new Error("Only the host can reshuffle");
    return reshufflePodsImpl(supabase, data.eventId);
  });

// ─────────────────────────────────────────────────────────────────────
// Adaptive consolidation: merge under-filled pods so nobody is stranded
// ─────────────────────────────────────────────────────────────────────

export async function consolidatePodsImpl(supabase: any, eventId: string) {
  const { data: ev } = await supabase
    .from("events")
    .select("id,audio_room_id,breakout_size")
    .eq("id", eventId)
    .single();
  if (!ev?.audio_room_id || !ev.breakout_size || ev.breakout_size < 1) {
    return { ok: true, merged: 0 };
  }
  const B: number = ev.breakout_size;

  let merged = 0;
  // bounded loop — protects against any quirk
  for (let pass = 0; pass < 16; pass++) {
    const { data: pods } = await supabase
      .from("audio_rooms")
      .select("id,current_participant_count")
      .eq("parent_room_id", ev.audio_room_id)
      .eq("status", "open")
      .order("current_participant_count", { ascending: true });
    const list = (pods ?? []).filter((p: any) => (p.current_participant_count ?? 0) >= 0);
    if (list.length < 2) break;

    const A = list[0];
    // find the smallest other pod that fits A's people
    const target = list.slice(1).find(
      (p: any) => (A.current_participant_count ?? 0) + (p.current_participant_count ?? 0) <= B,
    );
    if (!target) break;

    // move A's active participants → target
    const { error: moveErr } = await supabase
      .from("audio_room_participants")
      .update({ audio_room_id: target.id })
      .eq("audio_room_id", A.id)
      .eq("status", "active");
    if (moveErr) break;

    // close A (the trigger also closes a room when count hits 0; this is explicit)
    await supabase
      .from("audio_rooms")
      .update({ status: "closed", ends_at: new Date().toISOString() })
      .eq("id", A.id);
    merged++;
  }
  return { ok: true, merged };
}

const ConsolidateSchema = z.object({ eventId: z.string().uuid() });

export const consolidatePods = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ConsolidateSchema.parse(input))
  .handler(async ({ data, context }) => {
    return consolidatePodsImpl(context.supabase, data.eventId);
  });

// ─────────────────────────────────────────────────────────────────────
// Host: end the scheduled walk
// ─────────────────────────────────────────────────────────────────────

const EndScheduledSchema = z.object({ eventId: z.string().uuid() });

export const endScheduledWalk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => EndScheduledSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ev } = await supabase
      .from("events")
      .select("id,host_user_id,audio_room_id,status")
      .eq("id", data.eventId)
      .single();
    if (!ev) throw new Error("Walk not found");
    if (ev.host_user_id !== userId) throw new Error("Only the host can end this walk");
    if (ev.status === "completed") return { ok: true };

    const now = new Date().toISOString();
    if (ev.audio_room_id) {
      // Close umbrella + all open pods
      await supabase
        .from("audio_rooms")
        .update({ status: "closed", ends_at: now })
        .or(`id.eq.${ev.audio_room_id},parent_room_id.eq.${ev.audio_room_id}`)
        .neq("status", "closed");
      // Mark active participants as left
      const { data: rooms } = await supabase
        .from("audio_rooms")
        .select("id")
        .or(`id.eq.${ev.audio_room_id},parent_room_id.eq.${ev.audio_room_id}`);
      const ids = (rooms ?? []).map((r: any) => r.id);
      if (ids.length) {
        await supabase
          .from("audio_room_participants")
          .update({ status: "left", left_at: now })
          .in("audio_room_id", ids)
          .eq("status", "active");
      }
    }
    await supabase
      .from("events")
      .update({ status: "completed", ended_at: now })
      .eq("id", data.eventId);
    return { ok: true };
  });
