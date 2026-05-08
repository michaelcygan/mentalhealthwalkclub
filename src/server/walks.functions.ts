import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CHECKIN_RADIUS_METERS = 15;
const START_WINDOW_MINUTES = 30;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "walk";
}

const CreateSchema = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().max(1000).optional().nullable(),
  starts_at: z.string().min(1),
  duration_min: z.number().int().min(15).max(360).default(60),
  meeting_point: z.string().trim().max(200).optional().nullable(),
  vibe: z.string().trim().max(40).optional().nullable(),
  capacity: z.number().int().min(2).max(20).default(8),
  city: z.string().min(1),
  region: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  location_label: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
});

export const createLocalWalk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const startMs = new Date(data.starts_at).getTime();
    if (!Number.isFinite(startMs)) throw new Error("Invalid start time");
    const endsAt = new Date(startMs + data.duration_min * 60_000).toISOString();
    const slugBase = slugify(data.title);
    const slug = `${slugBase}-${Math.random().toString(36).slice(2, 7)}`;

    const { data: row, error } = await supabase.from("events").insert({
      title: data.title,
      slug,
      description: data.description ?? null,
      starts_at: data.starts_at,
      ends_at: endsAt,
      meeting_point: data.meeting_point ?? null,
      vibe: data.vibe ?? null,
      capacity: data.capacity,
      city: data.city,
      region: data.region ?? null,
      country: data.country ?? null,
      location_label: data.location_label,
      lat: data.lat,
      lng: data.lng,
      host_user_id: userId,
      event_type: "community_walk",
      status: "published",
      visibility: "public",
    }).select("slug").single();

    if (error) throw new Error(error.message);
    return { slug: row.slug };
  });

const StartSchema = z.object({ event_id: z.string().uuid() });

export const startLocalWalk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => StartSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ev, error } = await supabase
      .from("events")
      .select("id,host_user_id,status,starts_at")
      .eq("id", data.event_id)
      .single();
    if (error || !ev) throw new Error("Walk not found");
    if (ev.host_user_id !== userId) throw new Error("Only the host can start this walk");
    if (ev.status === "in_progress") return { ok: true };
    if (ev.status !== "published") throw new Error("This walk can't be started");

    const startMs = new Date(ev.starts_at).getTime();
    const diffMin = Math.abs(Date.now() - startMs) / 60_000;
    if (diffMin > START_WINDOW_MINUTES) {
      throw new Error(`You can start the walk within ${START_WINDOW_MINUTES} minutes of the scheduled time.`);
    }

    const { error: upErr } = await supabase
      .from("events")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", data.event_id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

const CheckInSchema = z.object({
  event_id: z.string().uuid(),
  lat: z.number(),
  lng: z.number(),
});

export const checkInToLocalWalk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CheckInSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ev, error } = await supabase
      .from("events")
      .select("id,status,lat,lng")
      .eq("id", data.event_id)
      .single();
    if (error || !ev) throw new Error("Walk not found");
    if (ev.status !== "in_progress") throw new Error("The host hasn't started this walk yet.");
    if (ev.lat == null || ev.lng == null) throw new Error("This walk has no location set.");

    const distance = haversineMeters(ev.lat, ev.lng, data.lat, data.lng);
    if (distance > CHECKIN_RADIUS_METERS) {
      const ft = Math.round(distance * 3.28084);
      throw new Error(`You're about ${ft} ft from the meeting point. Move closer and try again.`);
    }

    const { data: rsvp } = await supabase
      .from("event_rsvps")
      .select("id,status,checked_in_at")
      .eq("event_id", data.event_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!rsvp) {
      const { error: insErr } = await supabase.from("event_rsvps").insert({
        event_id: data.event_id,
        user_id: userId,
        status: "going",
        checked_in_at: new Date().toISOString(),
      });
      if (insErr) throw new Error(insErr.message);
    } else if (!rsvp.checked_in_at) {
      const { error: upErr } = await supabase
        .from("event_rsvps")
        .update({ checked_in_at: new Date().toISOString(), status: "going" })
        .eq("id", rsvp.id);
      if (upErr) throw new Error(upErr.message);
    }

    // Credit a walk_session if none exists for this user+event
    const { data: existingWalk } = await supabase
      .from("walk_sessions")
      .select("id")
      .eq("event_id", data.event_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingWalk) {
      await supabase.from("walk_sessions").insert({
        user_id: userId,
        event_id: data.event_id,
        walk_type: "irl_event",
        status: "active",
        privacy: "private",
      });
    }

    return { ok: true, distance_meters: Math.round(distance) };
  });

const HostCheckInSchema = z.object({
  event_id: z.string().uuid(),
  user_id: z.string().uuid(),
});

export const hostCheckInAttendee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => HostCheckInSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ev } = await supabase.from("events").select("host_user_id,status").eq("id", data.event_id).single();
    if (!ev || ev.host_user_id !== userId) throw new Error("Only the host can do this");
    if (ev.status !== "in_progress") throw new Error("Start the walk first");

    await supabase
      .from("event_rsvps")
      .update({ checked_in_at: new Date().toISOString(), status: "going" })
      .eq("event_id", data.event_id)
      .eq("user_id", data.user_id);

    const { data: existingWalk } = await supabase
      .from("walk_sessions")
      .select("id")
      .eq("event_id", data.event_id)
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (!existingWalk) {
      await supabase.from("walk_sessions").insert({
        user_id: data.user_id,
        event_id: data.event_id,
        walk_type: "irl_event",
        status: "active",
        privacy: "private",
      });
    }
    return { ok: true };
  });

const EndSchema = z.object({ event_id: z.string().uuid() });

export const endLocalWalk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => EndSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ev, error } = await supabase
      .from("events")
      .select("id,host_user_id,status")
      .eq("id", data.event_id)
      .single();
    if (error || !ev) throw new Error("Walk not found");
    if (ev.host_user_id !== userId) throw new Error("Only the host can end this walk");
    if (ev.status === "completed") return { ok: true };

    const now = new Date().toISOString();
    await supabase.from("events").update({ status: "completed", ended_at: now }).eq("id", data.event_id);

    // Close any active walk_sessions for this event
    await supabase
      .from("walk_sessions")
      .update({ status: "completed", ended_at: now })
      .eq("event_id", data.event_id)
      .eq("status", "active");

    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────
// Group-aware RSVP: gates group-only events behind membership
// ─────────────────────────────────────────────────────────────────────

const RsvpSchema = z.object({ event_id: z.string().uuid() });

export const rsvpToEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RsvpSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ev } = await supabase
      .from("events")
      .select("id,visibility,group_id")
      .eq("id", data.event_id)
      .single();
    if (!ev) throw new Error("Walk not found");

    if (ev.visibility === "group" && ev.group_id) {
      const { data: mem } = await supabase
        .from("group_memberships")
        .select("id")
        .eq("group_id", ev.group_id)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();
      if (!mem) {
        const { data: g } = await supabase
          .from("groups").select("name,slug").eq("id", ev.group_id).single();
        return {
          ok: false as const,
          requiresJoin: true as const,
          groupId: ev.group_id,
          groupName: g?.name ?? "the group",
          groupSlug: g?.slug ?? null,
        };
      }
    }

    const { error } = await supabase
      .from("event_rsvps")
      .insert({ event_id: data.event_id, user_id: userId, status: "going" });
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      throw new Error(error.message);
    }
    return { ok: true as const, requiresJoin: false as const };
  });
