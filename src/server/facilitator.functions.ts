import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Gate: must have facilitator role and approved profile.
async function assertFacilitator(supabase: any, userId: string) {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isFacilitator =
    !!roles?.some((r: { role: string }) => r.role === "facilitator") ||
    !!roles?.some((r: { role: string }) => r.role === "admin");
  if (!isFacilitator) throw new Error("You're not registered as a facilitator");

  const { data: prof } = await supabase
    .from("facilitator_profiles")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();
  // Admins bypass approval; otherwise must be approved.
  const isAdmin = !!roles?.some((r: { role: string }) => r.role === "admin");
  if (!isAdmin && (!prof || prof.status !== "approved")) {
    throw new Error("Your facilitator account isn't approved yet");
  }
  return { isAdmin };
}

export const startFacilitatorShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertFacilitator(supabase, userId);

    // Close any abandoned previous session
    await supabase
      .from("facilitator_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("facilitator_user_id", userId)
      .neq("status", "ended");

    const { data, error } = await supabase
      .from("facilitator_sessions")
      .insert({ facilitator_user_id: userId, status: "available" })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not start shift");
    return { sessionId: data.id };
  });

export const endFacilitatorShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Detach from any current room
    const { data: sess } = await supabase
      .from("facilitator_sessions")
      .select("id,current_audio_room_id,facilitator_user_id")
      .eq("id", data.sessionId)
      .single();
    if (!sess || sess.facilitator_user_id !== userId) throw new Error("Not your shift");

    if (sess.current_audio_room_id) {
      await supabase
        .from("audio_rooms")
        .update({ facilitator_user_id: null })
        .eq("id", sess.current_audio_room_id)
        .eq("facilitator_user_id", userId);
      await supabase
        .from("audio_room_participants")
        .update({ status: "left", left_at: new Date().toISOString() })
        .eq("audio_room_id", sess.current_audio_room_id)
        .eq("user_id", userId)
        .eq("status", "active");
    }

    await supabase
      .from("facilitator_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString(), current_audio_room_id: null })
      .eq("id", data.sessionId);

    return { ok: true };
  });

export const setFacilitatorBreak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ sessionId: z.string().uuid(), onBreak: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("facilitator_sessions")
      .update({ status: data.onBreak ? "on_break" : "available" })
      .eq("id", data.sessionId)
      .eq("facilitator_user_id", userId);
    return { ok: true };
  });

// Find next pod to facilitate — fairness scoring
export const nextPodForFacilitator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Recently visited rooms in this shift (skip re-entry within 30 min)
    const since = new Date(Date.now() - 30 * 60_000).toISOString();
    const { data: recent } = await supabase
      .from("facilitator_visits")
      .select("audio_room_id")
      .eq("facilitator_session_id", data.sessionId)
      .gte("joined_at", since);
    const recentIds = (recent ?? []).map((r: { audio_room_id: string }) => r.audio_room_id);

    let q = supabase
      .from("audio_rooms")
      .select(
        "id,title,scheduled_event_id,facilitator_user_id,current_participant_count,max_participants,starts_at,ends_at,group_id",
      )
      .eq("status", "open")
      .is("facilitator_user_id", null)
      .not("scheduled_event_id", "is", null)
      .gte("current_participant_count", 2);

    if (recentIds.length > 0) {
      q = q.not("id", "in", `(${recentIds.join(",")})`);
    }

    const { data: candidates } = await q;
    if (!candidates || candidates.length === 0) {
      return { status: "no_pods" as const, retryAfterSeconds: 30 };
    }

    // Fairness: pull last-facilitated time from past visits per room
    const ids = candidates.map((c: { id: string }) => c.id);
    const { data: history } = await supabase
      .from("facilitator_visits")
      .select("audio_room_id,left_at")
      .in("audio_room_id", ids)
      .order("left_at", { ascending: false });

    const lastVisit = new Map<string, number>();
    for (const h of history ?? []) {
      if (!lastVisit.has(h.audio_room_id) && h.left_at) {
        lastVisit.set(h.audio_room_id, new Date(h.left_at).getTime());
      }
    }

    // Sort: never-visited first, then oldest visit, then most walkers, then soonest end
    const scored = [...candidates].sort((a: any, b: any) => {
      const la = lastVisit.get(a.id) ?? 0;
      const lb = lastVisit.get(b.id) ?? 0;
      if (la !== lb) return la - lb;
      if (a.current_participant_count !== b.current_participant_count) {
        return b.current_participant_count - a.current_participant_count;
      }
      const ea = a.ends_at ? new Date(a.ends_at).getTime() : Infinity;
      const eb = b.ends_at ? new Date(b.ends_at).getTime() : Infinity;
      return ea - eb;
    });

    const room = scored[0];
    return {
      status: "found" as const,
      roomId: room.id,
      title: room.title,
      walkerCount: room.current_participant_count,
      eventId: room.scheduled_event_id,
    };
  });

export const joinPodAsFacilitator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        sessionId: z.string().uuid(),
        roomId: z.string().uuid(),
        plannedDurationSeconds: z.number().int().min(60).max(1800).default(300),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertFacilitator(supabase, userId);

    // Race-safe claim of the facilitator seat
    const { data: claimed, error: claimErr } = await supabase
      .from("audio_rooms")
      .update({ facilitator_user_id: userId })
      .eq("id", data.roomId)
      .is("facilitator_user_id", null)
      .eq("status", "open")
      .select("id,title")
      .maybeSingle();
    if (claimErr) throw new Error(claimErr.message);
    if (!claimed) throw new Error("Another facilitator just took this pod — looking for the next one");

    // Facilitators need a walk_session_id (NOT NULL) — create a lightweight marker session
    const { data: ws } = await supabase
      .from("walk_sessions")
      .insert({ user_id: userId, walk_type: "audio", status: "active", privacy: "private" })
      .select("id")
      .single();
    if (ws) {
      await supabase.from("audio_room_participants").insert({
        audio_room_id: data.roomId,
        user_id: userId,
        walk_session_id: ws.id,
        role: "facilitator",
      });
    }

    // Visit row
    const { data: visit } = await supabase
      .from("facilitator_visits")
      .insert({
        facilitator_session_id: data.sessionId,
        facilitator_user_id: userId,
        audio_room_id: data.roomId,
        planned_duration_seconds: data.plannedDurationSeconds,
      })
      .select("id")
      .single();

    await supabase
      .from("facilitator_sessions")
      .update({ status: "in_pod", current_audio_room_id: data.roomId })
      .eq("id", data.sessionId);

    return { visitId: visit?.id, roomId: data.roomId, title: claimed.title };
  });

export const leavePodAsFacilitator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        sessionId: z.string().uuid(),
        visitId: z.string().uuid(),
        roomId: z.string().uuid(),
        outcome: z.enum(["completed", "left_early", "pod_ended"]).default("completed"),
        notes: z.string().trim().max(2000).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: visit } = await supabase
      .from("facilitator_visits")
      .select("joined_at")
      .eq("id", data.visitId)
      .single();
    const seconds = visit?.joined_at
      ? Math.max(0, Math.round((Date.now() - new Date(visit.joined_at).getTime()) / 1000))
      : 0;

    await supabase
      .from("facilitator_visits")
      .update({
        left_at: new Date().toISOString(),
        outcome: data.outcome,
        notes: data.notes ?? null,
      })
      .eq("id", data.visitId)
      .eq("facilitator_user_id", userId);

    // Release seat
    await supabase
      .from("audio_rooms")
      .update({ facilitator_user_id: null })
      .eq("id", data.roomId)
      .eq("facilitator_user_id", userId);

    await supabase
      .from("audio_room_participants")
      .update({ status: "left", left_at: new Date().toISOString() })
      .eq("audio_room_id", data.roomId)
      .eq("user_id", userId)
      .eq("status", "active");

    // Increment shift counters
    const { data: sess } = await supabase
      .from("facilitator_sessions")
      .select("pods_visited,total_seconds")
      .eq("id", data.sessionId)
      .single();
    await supabase
      .from("facilitator_sessions")
      .update({
        status: "available",
        current_audio_room_id: null,
        pods_visited: (sess?.pods_visited ?? 0) + 1,
        total_seconds: (sess?.total_seconds ?? 0) + seconds,
      })
      .eq("id", data.sessionId);

    return { ok: true, seconds };
  });

export const reportFromPod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        sessionId: z.string().uuid(),
        visitId: z.string().uuid(),
        roomId: z.string().uuid(),
        reportedUserIds: z.array(z.string().uuid()).min(1).max(10),
        reason: z.string().trim().min(2).max(80),
        details: z.string().trim().max(2000).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Insert one safety report per reported user
    const rows = data.reportedUserIds.map((uid) => ({
      reporter_user_id: userId,
      reported_user_id: uid,
      audio_room_id: data.roomId,
      reason: data.reason,
      details: data.details ?? null,
    }));
    const { error: repErr } = await supabase.from("safety_reports").insert(rows);
    if (repErr) throw new Error(repErr.message);

    // Force-close the room
    await supabase
      .from("audio_rooms")
      .update({ status: "closed", ends_at: new Date().toISOString(), facilitator_user_id: null })
      .eq("id", data.roomId);
    await supabase
      .from("audio_room_participants")
      .update({ status: "left", left_at: new Date().toISOString() })
      .eq("audio_room_id", data.roomId)
      .eq("status", "active");

    await supabase
      .from("facilitator_visits")
      .update({ left_at: new Date().toISOString(), outcome: "reported" })
      .eq("id", data.visitId)
      .eq("facilitator_user_id", userId);

    await supabase
      .from("facilitator_sessions")
      .update({ status: "available", current_audio_room_id: null })
      .eq("id", data.sessionId);

    return { ok: true };
  });

export const getFacilitatorOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isFacilitator = !!roles?.some(
      (r: { role: string }) => r.role === "facilitator" || r.role === "admin",
    );

    const { data: profile } = await supabase
      .from("facilitator_profiles")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();

    // Today's stats
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const { data: todays } = await supabase
      .from("facilitator_sessions")
      .select("pods_visited,total_seconds")
      .eq("facilitator_user_id", userId)
      .gte("started_at", since.toISOString());

    const podsToday = (todays ?? []).reduce(
      (s, r) => s + (r.pods_visited ?? 0),
      0,
    );
    const secondsToday = (todays ?? []).reduce(
      (s, r) => s + (r.total_seconds ?? 0),
      0,
    );

    // Live pod count
    const { count: livePodCount } = await supabase
      .from("audio_rooms")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .not("scheduled_event_id", "is", null)
      .gte("current_participant_count", 1);

    return {
      isFacilitator,
      status: profile?.status ?? null,
      podsToday,
      secondsToday,
      livePodCount: livePodCount ?? 0,
    };
  });
