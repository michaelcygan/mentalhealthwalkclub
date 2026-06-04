import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * A "Place" is derived from group_standing_walks: distinct meetup
 * locations (rounded to ~111m precision) where one or more active
 * public groups hold standing walks. Used to power /places and the
 * Places card on a host profile.
 *
 * Key format: `${latInt}_${lngInt}` where the ints are round(lat*1000).
 * This preserves URL-safety while giving stable bucketing.
 */

function placeKey(lat: number, lng: number) {
  return `${Math.round(lat * 1000)}_${Math.round(lng * 1000)}`;
}

function parsePlaceKey(key: string): { lat: number; lng: number } | null {
  const m = key.match(/^(-?\d+)_(-?\d+)$/);
  if (!m) return null;
  return { lat: parseInt(m[1], 10) / 1000, lng: parseInt(m[2], 10) / 1000 };
}

function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

type StandingRow = {
  id: string;
  group_id: string;
  day_of_week: number;
  start_local_time: string;
  meetup_label: string | null;
  meetup_lat: number | null;
  meetup_lng: number | null;
  groups: {
    id: string;
    name: string;
    slug: string;
    visibility: string;
    status: string;
    neighborhood: string | null;
    cover_image_url: string | null;
    owner_id: string;
  } | null;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function summarizeStanding(s: { day_of_week: number; start_local_time: string }) {
  const t = s.start_local_time?.slice(0, 5) ?? "";
  return `${DAYS[s.day_of_week] ?? "—"} ${t}`;
}

async function fetchActivePlacePool(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  scope: "public" | "owner",
  ownerId?: string,
): Promise<StandingRow[]> {
  let q = supabase
    .from("group_standing_walks")
    .select(
      "id,group_id,day_of_week,start_local_time,meetup_label,meetup_lat,meetup_lng,groups:groups!inner(id,name,slug,visibility,status,neighborhood,cover_image_url,owner_id)",
    )
    .eq("active", true)
    .not("meetup_lat", "is", null)
    .not("meetup_lng", "is", null);

  if (scope === "public") {
    q = q.eq("groups.visibility", "public").eq("groups.status", "active");
  } else if (scope === "owner" && ownerId) {
    q = q.eq("groups.owner_id", ownerId).eq("groups.status", "active");
  }
  const { data } = await q;
  return (data ?? []) as StandingRow[];
}

type PlaceTile = {
  key: string;
  lat: number;
  lng: number;
  label: string | null;
  neighborhood: string | null;
  cover_image_url: string | null;
  group_count: number;
  next_summary: string | null;
  miles: number | null;
  groups: Array<{ id: string; name: string; slug: string }>;
};

function aggregate(rows: StandingRow[], origin?: { lat: number; lng: number } | null): PlaceTile[] {
  const map = new Map<string, PlaceTile>();
  for (const r of rows) {
    if (r.meetup_lat == null || r.meetup_lng == null || !r.groups) continue;
    const lat = Number(r.meetup_lat);
    const lng = Number(r.meetup_lng);
    const key = placeKey(lat, lng);
    const summary = summarizeStanding(r);
    const existing = map.get(key);
    if (existing) {
      if (!existing.groups.find((x) => x.id === r.groups!.id)) {
        existing.groups.push({ id: r.groups.id, name: r.groups.name, slug: r.groups.slug });
        existing.group_count = existing.groups.length;
      }
      if (!existing.next_summary) existing.next_summary = summary;
      if (!existing.label && r.meetup_label) existing.label = r.meetup_label;
      if (!existing.neighborhood && r.groups.neighborhood) existing.neighborhood = r.groups.neighborhood;
      if (!existing.cover_image_url && r.groups.cover_image_url) existing.cover_image_url = r.groups.cover_image_url;
    } else {
      map.set(key, {
        key,
        lat,
        lng,
        label: r.meetup_label,
        neighborhood: r.groups.neighborhood,
        cover_image_url: r.groups.cover_image_url,
        group_count: 1,
        next_summary: summary,
        miles: origin ? haversineMiles(origin.lat, origin.lng, lat, lng) : null,
        groups: [{ id: r.groups.id, name: r.groups.name, slug: r.groups.slug }],
      });
    }
  }
  return [...map.values()];
}

/* -------- list places (discovery) -------- */

const DiscoverInput = z.object({
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  scope: z.enum(["local", "global"]).default("local"),
});

export const discoverPlaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => DiscoverInput.parse(d))
  .handler(async ({ data, context }) => {
    const rows = await fetchActivePlacePool(context.supabase, "public");
    const origin = data.lat != null && data.lng != null ? { lat: data.lat, lng: data.lng } : null;
    let tiles = aggregate(rows, origin);
    if (data.scope === "local" && origin) {
      tiles = tiles.filter((t) => t.miles == null || t.miles <= 25);
    }
    tiles.sort((a, b) => {
      if (a.miles != null && b.miles != null) return a.miles - b.miles;
      return b.group_count - a.group_count;
    });
    return { places: tiles.slice(0, 60) };
  });

/* -------- list places for a host profile -------- */

const HostInput = z.object({ user_id: z.string().uuid() });

export const listHostPlaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => HostInput.parse(d))
  .handler(async ({ data, context }) => {
    const rows = await fetchActivePlacePool(context.supabase, "owner", data.user_id);
    const tiles = aggregate(rows, null).sort((a, b) => b.group_count - a.group_count);
    return { places: tiles.slice(0, 12) };
  });

/* -------- place detail -------- */

const KeyInput = z.object({ key: z.string().min(1).max(40) });

export const getPlace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => KeyInput.parse(d))
  .handler(async ({ data, context }) => {
    const parsed = parsePlaceKey(data.key);
    if (!parsed) throw new Error("Invalid place key.");

    const rows = await fetchActivePlacePool(context.supabase, "public");
    const matching = rows.filter(
      (r) =>
        r.meetup_lat != null &&
        r.meetup_lng != null &&
        placeKey(Number(r.meetup_lat), Number(r.meetup_lng)) === data.key,
    );
    if (matching.length === 0) {
      return {
        place: {
          key: data.key,
          lat: parsed.lat,
          lng: parsed.lng,
          label: null,
          neighborhood: null,
          cover_image_url: null,
          group_count: 0,
          groups: [] as Array<{ id: string; name: string; slug: string; description: string | null; next_summary: string }>,
        },
        upcoming: [] as Array<{ id: string; slug: string; title: string; starts_at: string }>,
      };
    }

    const label = matching.find((m) => m.meetup_label)?.meetup_label ?? null;
    const neighborhood = matching.find((m) => m.groups?.neighborhood)?.groups?.neighborhood ?? null;
    const cover_image_url = matching.find((m) => m.groups?.cover_image_url)?.groups?.cover_image_url ?? null;

    const byGroup = new Map<
      string,
      { id: string; name: string; slug: string; description: string | null; next_summary: string }
    >();
    for (const m of matching) {
      if (!m.groups) continue;
      if (!byGroup.has(m.groups.id)) {
        byGroup.set(m.groups.id, {
          id: m.groups.id,
          name: m.groups.name,
          slug: m.groups.slug,
          description: null,
          next_summary: summarizeStanding(m),
        });
      }
    }

    // Hydrate descriptions.
    const ids = [...byGroup.keys()];
    if (ids.length) {
      const { data: gs } = await context.supabase
        .from("groups")
        .select("id,description")
        .in("id", ids);
      for (const g of gs ?? []) {
        const tile = byGroup.get(g.id);
        if (tile) tile.description = g.description;
      }
    }

    // Upcoming materialized events at this place's groups.
    const nowIso = new Date().toISOString();
    const { data: events } = await context.supabase
      .from("events")
      .select("id,slug,title,starts_at,group_id")
      .in("group_id", ids)
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(8);

    return {
      place: {
        key: data.key,
        lat: parsed.lat,
        lng: parsed.lng,
        label,
        neighborhood,
        cover_image_url,
        group_count: byGroup.size,
        groups: [...byGroup.values()],
      },
      upcoming: (events ?? []).map((e) => ({
        id: e.id,
        slug: e.slug,
        title: e.title,
        starts_at: e.starts_at,
      })),
    };
  });
