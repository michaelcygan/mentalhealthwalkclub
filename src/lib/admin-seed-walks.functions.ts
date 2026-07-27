import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin-only server functions for the Auto Walk Scheduler.
 *
 * All mutations verify caller has the `admin` role via has_role() before
 * touching the schedule table with the service-role client.
 */

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

const ScheduleInput = z.object({
  internal_name: z.string().trim().min(2).max(120),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  vibe: z.string().trim().max(120).nullable().optional(),

  place_id: z.string().uuid().nullable().optional(),
  venue_name: z.string().trim().max(200).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().max(120).nullable().optional(),
  country: z.string().trim().max(120).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),

  timezone: z.string().min(1).max(80),
  first_local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_local_time: z.string().regex(TIME_RE),
  frequency_weeks: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  duration_minutes: z.number().int().min(10).max(480).default(60),

  pace: z.enum(["easy", "moderate", "brisk"]).nullable().optional(),
  dog_friendly: z.boolean().default(false),
  kid_friendly: z.boolean().default(false),
  accessibility_notes: z.string().trim().max(1000).nullable().optional(),

  host_mode: z.enum(["community", "self"]).default("community"),
  active: z.boolean().default(true),
  horizon_occurrences: z.number().int().min(1).max(12).default(6),

  // Safety overrides (Wave 8). Default deny; admin can opt in per schedule.
  allow_off_hours: z.boolean().default(false),
  allow_long_duration: z.boolean().default(false),
});

const MIN_HOUR = 6; // 06:00 local
const MAX_HOUR_START = 21; // last legal start is 21:00 local
const MAX_ACTIVE_PER_CITY = 20;
const LONG_DURATION_MINUTES = 180;

function parseLocalHour(t: string): number {
  const [hh] = t.split(":").map((n) => parseInt(n, 10));
  return hh;
}

function assertSafetyGuardrails(input: {
  start_local_time?: string;
  duration_minutes?: number;
  allow_off_hours?: boolean;
  allow_long_duration?: boolean;
  place_id?: string | null;
  venue_name?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  city?: string;
}) {
  if (input.start_local_time && !input.allow_off_hours) {
    const hh = parseLocalHour(input.start_local_time);
    if (hh < MIN_HOUR || hh > MAX_HOUR_START) {
      throw new Error(
        `Start time must be between ${String(MIN_HOUR).padStart(2, "0")}:00 and ${String(MAX_HOUR_START).padStart(2, "0")}:00 local. Enable "off-hours" if this is intentional.`,
      );
    }
  }
  if (
    input.duration_minutes != null &&
    input.duration_minutes > LONG_DURATION_MINUTES &&
    !input.allow_long_duration
  ) {
    throw new Error(
      `Walks longer than ${LONG_DURATION_MINUTES} minutes need "long duration" enabled.`,
    );
  }
  // Location sufficiency
  if (input.city !== undefined) {
    const hasPlace = !!input.place_id;
    const hasVenueAndCoords =
      !!input.venue_name && (input.lat != null || input.lng != null || !!input.address);
    if (!hasPlace && !hasVenueAndCoords) {
      throw new Error(
        "Provide a place, or a venue name plus address or lat/lng, so the seed points somewhere real.",
      );
    }
  }
}


function assertValidTimezone(tz: string) {
  try {
    // Throws RangeError for invalid IANA names.
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    throw new Error(`Invalid timezone: ${tz}`);
  }
}

async function requireAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin access required");
}

async function resolvePlaceSnapshot(
  admin: any,
  place_id: string | null | undefined,
  fallback: {
    venue_name?: string | null;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
  },
) {
  if (!place_id) {
    return {
      place_id: null,
      venue_name: fallback.venue_name ?? null,
      address: fallback.address ?? null,
      lat: fallback.lat ?? null,
      lng: fallback.lng ?? null,
    };
  }
  const { data: p } = await admin
    .from("places")
    .select("id,name,address,lat,lng")
    .eq("id", place_id)
    .maybeSingle();
  if (!p) throw new Error("Place not found");
  return {
    place_id: p.id as string,
    venue_name: p.name ?? fallback.venue_name ?? null,
    address: p.address ?? fallback.address ?? null,
    lat: p.lat != null ? Number(p.lat) : (fallback.lat ?? null),
    lng: p.lng != null ? Number(p.lng) : (fallback.lng ?? null),
  };
}

const SELECT_COLS =
  "id,created_by,host_user_id,internal_name,title,description,vibe,place_id,venue_name,address,city,state,country,lat,lng,timezone,first_local_date,start_local_time,frequency_weeks,duration_minutes,pace,dog_friendly,kid_friendly,accessibility_notes,active,horizon_occurrences,last_materialized_at,next_occurrence_at,last_error,created_at,updated_at";

/* ---------- list ---------- */

export const listSeedSchedules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("walk_seed_schedules")
      .select(SELECT_COLS)
      .order("city", { ascending: true })
      .order("start_local_time", { ascending: true });
    if (error) throw new Error(error.message);

    // Attach future occurrence count for each schedule
    const ids = (data ?? []).map((r) => r.id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: evs } = await supabaseAdmin
        .from("events")
        .select("seed_schedule_id,starts_at,status")
        .in("seed_schedule_id", ids)
        .gt("starts_at", new Date().toISOString())
        .neq("status", "cancelled");
      for (const e of evs ?? []) {
        const id = e.seed_schedule_id as string;
        counts[id] = (counts[id] ?? 0) + 1;
      }
    }
    return {
      schedules: (data ?? []).map((r) => ({
        ...r,
        future_count: counts[r.id] ?? 0,
      })),
    };
  });

/* ---------- occurrences ---------- */

export const listSeedScheduleOccurrences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ schedule_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("events")
      .select(
        "id,slug,title,starts_at,ends_at,timezone,venue_name,city,status,attendee_count,host_user_id",
      )
      .eq("seed_schedule_id", data.schedule_id)
      .order("starts_at", { ascending: true })
      .limit(24);
    if (error) throw new Error(error.message);
    return { occurrences: rows ?? [] };
  });

/* ---------- create ---------- */

export const createSeedSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ScheduleInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    assertValidTimezone(data.timezone);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const snap = await resolvePlaceSnapshot(supabaseAdmin, data.place_id ?? null, {
      venue_name: data.venue_name,
      address: data.address,
      lat: data.lat,
      lng: data.lng,
    });

    assertSafetyGuardrails({
      start_local_time: data.start_local_time,
      duration_minutes: data.duration_minutes,
      allow_off_hours: data.allow_off_hours,
      allow_long_duration: data.allow_long_duration,
      place_id: snap.place_id,
      venue_name: snap.venue_name,
      address: snap.address,
      lat: snap.lat,
      lng: snap.lng,
      city: data.city,
    });

    // City cap: no more than MAX_ACTIVE_PER_CITY active schedules per city.
    if (data.active) {
      const { count: cityCount } = await supabaseAdmin
        .from("walk_seed_schedules")
        .select("id", { count: "exact", head: true })
        .ilike("city", data.city)
        .eq("active", true);
      if ((cityCount ?? 0) >= MAX_ACTIVE_PER_CITY) {
        throw new Error(
          `At most ${MAX_ACTIVE_PER_CITY} active auto schedules per city. Pause one before adding another.`,
        );
      }
    }

    const host_user_id = data.host_mode === "self" ? context.userId : null;


    const { data: row, error } = await supabaseAdmin
      .from("walk_seed_schedules")
      .insert({
        created_by: context.userId,
        host_user_id,
        internal_name: data.internal_name,
        title: data.title,
        description: data.description ?? null,
        vibe: data.vibe ?? null,
        place_id: snap.place_id,
        venue_name: snap.venue_name,
        address: snap.address,
        city: data.city,
        state: data.state ?? null,
        country: data.country ?? null,
        lat: snap.lat,
        lng: snap.lng,
        timezone: data.timezone,
        first_local_date: data.first_local_date,
        start_local_time: data.start_local_time,
        frequency_weeks: data.frequency_weeks,
        duration_minutes: data.duration_minutes,
        pace: data.pace ?? null,
        dog_friendly: data.dog_friendly,
        kid_friendly: data.kid_friendly,
        accessibility_notes: data.accessibility_notes ?? null,
        active: data.active,
        horizon_occurrences: data.horizon_occurrences,
      })
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(error.message);

    // Immediate materialization so admin sees the six generated dates.
    const { data: matResult } = await supabaseAdmin.rpc("materialize_seed_walks", {
      _schedule_id: row.id,
    });
    return { schedule: row, materialize: matResult };
  });

/* ---------- update ---------- */

const UpdateInput = ScheduleInput.partial().extend({
  id: z.string().uuid(),
});

export const updateSeedSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpdateInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load current
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("walk_seed_schedules")
      .select(SELECT_COLS)
      .eq("id", data.id)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!existing) throw new Error("Schedule not found");

    if (data.timezone) assertValidTimezone(data.timezone);

    // Optional place resolution when place_id explicitly provided
    let snap = {
      place_id: existing.place_id,
      venue_name: existing.venue_name,
      address: existing.address,
      lat: existing.lat != null ? Number(existing.lat) : null,
      lng: existing.lng != null ? Number(existing.lng) : null,
    };
    if (data.place_id !== undefined || data.venue_name !== undefined || data.address !== undefined) {
      snap = await resolvePlaceSnapshot(supabaseAdmin, data.place_id ?? existing.place_id, {
        venue_name: data.venue_name ?? existing.venue_name,
        address: data.address ?? existing.address,
        lat: data.lat ?? (existing.lat != null ? Number(existing.lat) : null),
        lng: data.lng ?? (existing.lng != null ? Number(existing.lng) : null),
      });
    }

    const host_user_id =
      data.host_mode === undefined
        ? existing.host_user_id
        : data.host_mode === "self"
          ? context.userId
          : null;

    // Guardrails against the *effective* post-update values.
    const effectiveStart = data.start_local_time ?? existing.start_local_time;
    const effectiveDuration = data.duration_minutes ?? existing.duration_minutes;
    const effectiveCity = data.city ?? existing.city;
    const effectiveActive = data.active ?? existing.active;
    assertSafetyGuardrails({
      start_local_time: effectiveStart,
      duration_minutes: effectiveDuration,
      allow_off_hours: data.allow_off_hours ?? false,
      allow_long_duration: data.allow_long_duration ?? false,
      place_id: snap.place_id,
      venue_name: snap.venue_name,
      address: snap.address,
      lat: snap.lat,
      lng: snap.lng,
      city: effectiveCity,
    });

    // Re-check city cap when activating an inactive schedule, or when the city
    // is changing while it stays active.
    const activating = effectiveActive && !existing.active;
    const cityChanging =
      effectiveActive && data.city !== undefined && data.city !== existing.city;
    if (activating || cityChanging) {
      const { count: cityCount } = await supabaseAdmin
        .from("walk_seed_schedules")
        .select("id", { count: "exact", head: true })
        .ilike("city", effectiveCity)
        .eq("active", true)
        .neq("id", data.id);
      if ((cityCount ?? 0) >= MAX_ACTIVE_PER_CITY) {
        throw new Error(
          `At most ${MAX_ACTIVE_PER_CITY} active auto schedules per city. Pause one before adding another.`,
        );
      }
    }


    const recurrenceChanged =
      data.timezone !== undefined ||
      data.first_local_date !== undefined ||
      data.start_local_time !== undefined ||
      data.frequency_weeks !== undefined ||
      data.duration_minutes !== undefined ||
      data.place_id !== undefined ||
      data.venue_name !== undefined ||
      data.address !== undefined ||
      data.lat !== undefined ||
      data.lng !== undefined;

    const patch: Record<string, unknown> = {
      internal_name: data.internal_name ?? existing.internal_name,
      title: data.title ?? existing.title,
      description: data.description === undefined ? existing.description : data.description,
      vibe: data.vibe === undefined ? existing.vibe : data.vibe,
      place_id: snap.place_id,
      venue_name: snap.venue_name,
      address: snap.address,
      city: data.city ?? existing.city,
      state: data.state === undefined ? existing.state : data.state,
      country: data.country === undefined ? existing.country : data.country,
      lat: snap.lat,
      lng: snap.lng,
      timezone: data.timezone ?? existing.timezone,
      first_local_date: data.first_local_date ?? existing.first_local_date,
      start_local_time: data.start_local_time ?? existing.start_local_time,
      frequency_weeks: data.frequency_weeks ?? existing.frequency_weeks,
      duration_minutes: data.duration_minutes ?? existing.duration_minutes,
      pace: data.pace === undefined ? existing.pace : data.pace,
      dog_friendly: data.dog_friendly ?? existing.dog_friendly,
      kid_friendly: data.kid_friendly ?? existing.kid_friendly,
      accessibility_notes:
        data.accessibility_notes === undefined
          ? existing.accessibility_notes
          : data.accessibility_notes,
      host_user_id,
      active: data.active ?? existing.active,
      horizon_occurrences: data.horizon_occurrences ?? existing.horizon_occurrences,
    };

    const { error: upErr } = await supabaseAdmin
      .from("walk_seed_schedules")
      .update(patch as never)
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);

    let preserved = 0;
    let removed = 0;
    let created = 0;

    if (recurrenceChanged) {
      // Find future events. Preserve any within 24h OR with any RSVPs / guest RSVPs.
      const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data: futureEvents } = await supabaseAdmin
        .from("events")
        .select("id,starts_at")
        .eq("seed_schedule_id", data.id)
        .gt("starts_at", new Date().toISOString())
        .neq("status", "cancelled");

      for (const ev of futureEvents ?? []) {
        const withinWindow = ev.starts_at < cutoff;
        let hasRsvps = false;
        if (!withinWindow) {
          const { count: rsvpCount } = await supabaseAdmin
            .from("event_rsvps")
            .select("user_id", { count: "exact", head: true })
            .eq("event_id", ev.id);
          if ((rsvpCount ?? 0) > 0) hasRsvps = true;
          if (!hasRsvps) {
            const { count: guestCount } = await supabaseAdmin
              .from("event_rsvp_guests")
              .select("id", { count: "exact", head: true })
              .eq("event_id", ev.id);
            if ((guestCount ?? 0) > 0) hasRsvps = true;
          }
        }
        if (withinWindow || hasRsvps) {
          preserved++;
        } else {
          await supabaseAdmin
            .from("events")
            .update({ status: "cancelled" })
            .eq("id", ev.id);
          removed++;
        }
      }
    }

    // Always rematerialize so counts stay at horizon.
    const { data: matResult } = await supabaseAdmin.rpc("materialize_seed_walks", {
      _schedule_id: data.id,
    });
    if (matResult && typeof matResult === "object" && "inserted" in matResult) {
      created = Number((matResult as { inserted: number }).inserted ?? 0);
    }

    const { data: updated } = await supabaseAdmin
      .from("walk_seed_schedules")
      .select(SELECT_COLS)
      .eq("id", data.id)
      .maybeSingle();

    return { schedule: updated, preserved, removed, created };
  });

/* ---------- pause / resume ---------- */

const PauseInput = z.object({ id: z.string().uuid() });

export const pauseSeedSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => PauseInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("walk_seed_schedules")
      .update({ active: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resumeSeedSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => PauseInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("walk_seed_schedules")
      .update({ active: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    const { data: matResult } = await supabaseAdmin.rpc("materialize_seed_walks", {
      _schedule_id: data.id,
    });
    return { ok: true, materialize: matResult };
  });

/* ---------- manual materialize ---------- */

export const materializeSeedScheduleNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => PauseInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: matResult, error } = await supabaseAdmin.rpc("materialize_seed_walks", {
      _schedule_id: data.id,
    });
    if (error) throw new Error(error.message);
    return { materialize: matResult };
  });

/* ---------- unpublish empty occurrence ---------- */

const UnpublishInput = z.object({ event_id: z.string().uuid() });

export const unpublishEmptySeedOccurrence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UnpublishInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ev } = await supabaseAdmin
      .from("events")
      .select("id,starts_at,is_seed,seed_schedule_id,status")
      .eq("id", data.event_id)
      .maybeSingle();
    if (!ev) throw new Error("Event not found");
    if (!ev.is_seed) throw new Error("Not a seeded event");
    if (new Date(ev.starts_at).getTime() <= Date.now()) {
      throw new Error("Walk has already started; can't unpublish.");
    }
    const { count: rsvpCount } = await supabaseAdmin
      .from("event_rsvps")
      .select("user_id", { count: "exact", head: true })
      .eq("event_id", ev.id);
    const { count: guestCount } = await supabaseAdmin
      .from("event_rsvp_guests")
      .select("id", { count: "exact", head: true })
      .eq("event_id", ev.id);
    if ((rsvpCount ?? 0) > 0 || (guestCount ?? 0) > 0) {
      throw new Error("People have RSVPd. Contact attendees before cancelling.");
    }
    const { error } = await supabaseAdmin
      .from("events")
      .update({ status: "cancelled" })
      .eq("id", ev.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
