import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Compute the UTC timestamp for the next occurrence of `dow` at `localTime`
 * in `timezone`, strictly after `after`. Uses an Intl-based search.
 */
function nextOccurrenceUtc(
  dow: number,
  localTime: string,
  timezone: string,
  after: Date,
  weekOffset: number,
): Date {
  const [hh, mm] = localTime.split(":").map((n) => parseInt(n, 10));
  // Start search from `after` and step forward day by day; cap at 21 days.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Walk forward day-by-day in the target timezone until we find the right weekday,
  // then construct a UTC timestamp for that local Y-M-D + hh:mm by iterating
  // candidates (handles DST transitions reasonably).
  for (let d = 0; d < 21 + weekOffset * 7; d++) {
    const candidate = new Date(after.getTime() + d * 24 * 60 * 60 * 1000);
    const parts = Object.fromEntries(
      fmt.formatToParts(candidate).map((p) => [p.type, p.value]),
    );
    const wkIdx = DAYS.indexOf(parts.weekday as (typeof DAYS)[number]);
    if (wkIdx !== dow) continue;

    // Build local Y-M-D at hh:mm in the target tz: convert by trial.
    const year = parseInt(parts.year, 10);
    const month = parseInt(parts.month, 10);
    const day = parseInt(parts.day, 10);
    // Guess UTC; then correct by tz offset diff.
    let guess = new Date(Date.UTC(year, month - 1, day, hh, mm, 0));
    for (let i = 0; i < 3; i++) {
      const gp = Object.fromEntries(fmt.formatToParts(guess).map((p) => [p.type, p.value]));
      const gh = parseInt(gp.hour, 10);
      const gm = parseInt(gp.minute, 10);
      const diffMin = (hh - gh) * 60 + (mm - gm);
      if (diffMin === 0) break;
      guess = new Date(guess.getTime() + diffMin * 60 * 1000);
    }
    if (guess.getTime() > after.getTime() && weekOffset === 0) return guess;
    if (weekOffset > 0) {
      weekOffset -= 1;
      after = new Date(guess.getTime() + 60 * 1000);
    }
  }
  return new Date(after.getTime() + 7 * 24 * 60 * 60 * 1000);
}

const StandingInput = z.object({
  group_id: z.string().uuid(),
  day_of_week: z.number().int().min(0).max(6),
  start_local_time: z.string().regex(TIME_RE),
  timezone: z.string().min(1).max(80),
  meetup_label: z.string().max(160).optional().nullable(),
  meetup_lat: z.number().min(-90).max(90).optional().nullable(),
  meetup_lng: z.number().min(-180).max(180).optional().nullable(),
  duration_minutes: z.number().int().min(10).max(480).default(60),
});

export const createStandingWalk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => StandingInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: g } = await supabase
      .from("groups")
      .select("id,owner_id,name")
      .eq("id", data.group_id)
      .maybeSingle();
    if (!g || g.owner_id !== userId) throw new Error("Only the group owner can add a standing walk.");

    const { count } = await supabase
      .from("group_standing_walks")
      .select("id", { count: "exact", head: true })
      .eq("group_id", data.group_id)
      .eq("active", true);
    if ((count ?? 0) >= 2) throw new Error("Groups can have at most 2 active standing walks.");

    const { data: row, error } = await supabase
      .from("group_standing_walks")
      .insert({
        group_id: data.group_id,
        day_of_week: data.day_of_week,
        start_local_time: data.start_local_time,
        timezone: data.timezone,
        meetup_label: data.meetup_label ?? null,
        meetup_lat: data.meetup_lat ?? null,
        meetup_lng: data.meetup_lng ?? null,
        duration_minutes: data.duration_minutes,
        active: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await materializeForGroupInner(supabase, data.group_id, userId);
    return row;
  });

export const deleteStandingWalk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sw } = await supabase
      .from("group_standing_walks")
      .select("group_id, groups!inner(owner_id)")
      .eq("id", data.id)
      .maybeSingle();
    const owner = (sw as { groups?: { owner_id?: string } } | null)?.groups?.owner_id;
    if (!sw || owner !== userId) throw new Error("Only the group owner can remove standing walks.");
    const { error } = await supabase
      .from("group_standing_walks")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listStandingWalks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ group_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("group_standing_walks")
      .select("id,day_of_week,start_local_time,timezone,meetup_label,meetup_lat,meetup_lng,duration_minutes,active")
      .eq("group_id", data.group_id)
      .order("day_of_week", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

/** List upcoming materialized walks for a group. Member-visible per RLS. */
export const listGroupUpcomingWalks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ group_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const nowIso = new Date().toISOString();
    const { data: rows, error } = await context.supabase
      .from("events")
      .select("id,slug,title,starts_at,ends_at,timezone,meeting_point,lat,lng,attendee_count")
      .eq("group_id", data.group_id)
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(8);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

/** Public-ish: rematerialize (owner-only). */
export const materializeGroupWalks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ group_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: g } = await supabase
      .from("groups")
      .select("owner_id")
      .eq("id", data.group_id)
      .maybeSingle();
    if (!g || g.owner_id !== userId) throw new Error("Only the owner can materialize.");
    return materializeForGroupInner(supabase, data.group_id, userId);
  });

async function materializeForGroupInner(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  groupId: string,
  ownerId: string,
) {
  const { data: g } = await supabase
    .from("groups")
    .select("id,name,age_band_min")
    .eq("id", groupId)
    .single();
  const { data: standings } = await supabase
    .from("group_standing_walks")
    .select("id,day_of_week,start_local_time,timezone,meetup_label,meetup_lat,meetup_lng,duration_minutes,active")
    .eq("group_id", groupId)
    .eq("active", true);

  const inserted: Array<{ starts_at: string }> = [];
  const now = new Date();

  for (const s of standings ?? []) {
    for (let i = 0; i < 4; i++) {
      const start = nextOccurrenceUtc(
        s.day_of_week,
        s.start_local_time.slice(0, 5),
        s.timezone || "UTC",
        i === 0 ? now : new Date(now.getTime() + i * 7 * 24 * 60 * 60 * 1000),
        0,
      );
      const end = new Date(start.getTime() + s.duration_minutes * 60 * 1000);
      const slugBase = `${g.name}-${start.toISOString().slice(0, 10)}-${s.start_local_time.replace(":", "")}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || `walk-${start.getTime()}`;

      const { error } = await supabase.from("events").insert({
        title: `${g.name} walk`,
        slug: `${slugBase}-${Math.random().toString(36).slice(2, 6)}`,
        event_type: "group_walk",
        host_user_id: ownerId,
        group_id: groupId,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        timezone: s.timezone,
        meeting_point: s.meetup_label ?? null,
        lat: s.meetup_lat,
        lng: s.meetup_lng,
        visibility: "public",
        audience_mode: "group",
        status: "scheduled",
        price_cents: 0,
        donation_percent: 0,
      });
      if (!error) inserted.push({ starts_at: start.toISOString() });
      // ignore duplicate-key errors (idempotent on (group_id, starts_at))
    }
  }
  return { inserted: inserted.length };
}
