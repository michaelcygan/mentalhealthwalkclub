import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FREE_SAVED_TRAILS_CAP = 5;

async function fetchWikimediaThumb(name: string, lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggsradius=2000&ggscoord=${lat}|${lng}&ggslimit=10&ggsnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=800`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as { query?: { pages?: Record<string, { title?: string; imageinfo?: Array<{ thumburl?: string }> }> } };
    const pages = Object.values(json.query?.pages ?? {});
    if (pages.length === 0) return null;
    const nameLower = name.toLowerCase();
    const match = pages.find((p) => p.title?.toLowerCase().includes(nameLower)) ?? pages[0];
    return match?.imageinfo?.[0]?.thumburl ?? null;
  } catch {
    return null;
  }
}

function milesBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(a));
}

function cellKey(lat: number, lng: number) {
  const r = (n: number) => Math.round(n * 10) / 10;
  return `${r(lat).toFixed(1)}_${r(lng).toFixed(1)}`;
}

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

async function fetchOverpass(lat: number, lng: number, radiusMeters: number) {
  const q = `
[out:json][timeout:25];
(
  node["leisure"="park"](around:${radiusMeters},${lat},${lng});
  way["leisure"="park"](around:${radiusMeters},${lat},${lng});
  way["highway"="path"]["foot"="designated"](around:${radiusMeters},${lat},${lng});
  way["highway"="footway"]["foot"!="no"](around:${radiusMeters},${lat},${lng});
);
out center tags 200;
`.trim();
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(q)}`,
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { elements: OsmElement[] };
      return json.elements ?? [];
    } catch {
      // try next endpoint
    }
  }
  return [];
}

function kindFromTags(tags: Record<string, string>): string {
  if (tags["leisure"] === "park") return "park";
  if (tags["highway"] === "path") return "path";
  if (tags["highway"] === "footway") return "footway";
  return "trail";
}

export const discoverTrails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        limit: z.number().int().min(1).max(40).default(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const key = cellKey(data.lat, data.lng);
    const { data: cell } = await supabase
      .from("trail_search_log")
      .select("cell_key,last_synced_at")
      .eq("cell_key", key)
      .maybeSingle();

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const isStale = !cell || new Date(cell.last_synced_at).getTime() < sevenDaysAgo;

    if (isStale) {
      const elements = await fetchOverpass(data.lat, data.lng, 40_000);
      if (elements.length > 0) {
        const rows = elements
          .map((el) => {
            const lat = el.lat ?? el.center?.lat;
            const lon = el.lon ?? el.center?.lon;
            if (lat == null || lon == null) return null;
            const tags = el.tags ?? {};
            const name = (tags["name"] ?? "").trim() || null;
            // Skip unnamed footways/paths to avoid noise; keep parks regardless
            const kind = kindFromTags(tags);
            if (!name && kind !== "park") return null;
            return {
              source: "osm",
              osm_id: `${el.type}/${el.id}`,
              kind,
              name: name ?? "Unnamed park",
              lat,
              lng: lon,
              tags,
              length_m: null as number | null,
              last_synced_at: new Date().toISOString(),
            };
          })
          .filter(Boolean) as Array<Record<string, unknown>>;
        if (rows.length > 0) {
          await supabase.from("trails").upsert(rows as never, { onConflict: "source,osm_id" });
        }
      }
      await supabase
        .from("trail_search_log")
        .upsert({ cell_key: key, last_synced_at: new Date().toISOString() });
    }

    // Pull a generous bbox then sort by haversine.
    const dLat = 0.6; // ~40mi
    const dLng = 0.8;
    const { data: rows } = await supabase
      .from("trails")
      .select("id,name,kind,lat,lng,tags,length_m")
      .gte("lat", data.lat - dLat)
      .lte("lat", data.lat + dLat)
      .gte("lng", data.lng - dLng)
      .lte("lng", data.lng + dLng)
      .limit(200);

    const withMiles = (rows ?? [])
      .map((r) => ({ ...r, miles: milesBetween(data.lat, data.lng, r.lat, r.lng) }))
      .filter((r) => r.miles <= 25)
      .sort((a, b) => a.miles - b.miles)
      .slice(0, data.limit);

    return { trails: withMiles };
  });

export const listMySavedTrails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_saved_trails")
      .select("id,position,note,trail:trails(id,name,kind,lat,lng,tags,length_m)")
      .eq("user_id", userId)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return { saved: data ?? [] };
  });

export const saveTrail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ trail_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { count } = await supabase
      .from("user_saved_trails")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) >= FREE_SAVED_TRAILS_CAP) {
      throw new Error(`Free plan caps saved trails at ${FREE_SAVED_TRAILS_CAP}. Upgrade for unlimited.`);
    }
    const { error } = await supabase.from("user_saved_trails").insert({
      user_id: userId,
      trail_id: data.trail_id,
      position: count ?? 0,
    });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const unsaveTrail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ trail_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_saved_trails")
      .delete()
      .eq("user_id", context.userId)
      .eq("trail_id", data.trail_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderSavedTrails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Update positions one at a time; small lists.
    for (let i = 0; i < data.ids.length; i++) {
      await supabase
        .from("user_saved_trails")
        .update({ position: i })
        .eq("user_id", userId)
        .eq("trail_id", data.ids[i]);
    }
    return { ok: true };
  });

export const getTrail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: trail, error } = await supabase
      .from("trails")
      .select("id,name,kind,lat,lng,tags,length_m,source,osm_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!trail) throw new Error("Trail not found.");

    const { data: savedRow } = await supabase
      .from("user_saved_trails")
      .select("id")
      .eq("user_id", userId)
      .eq("trail_id", trail.id)
      .maybeSingle();

    const cover_image_url = await fetchWikimediaThumb(trail.name ?? "", trail.lat, trail.lng);

    return { trail, saved: !!savedRow, cover_image_url };
  });

export const trailsNearPoint = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radius_miles: z.number().min(0.1).max(10).default(1),
        limit: z.number().int().min(1).max(20).default(6),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const dLat = data.radius_miles / 69;
    const dLng = data.radius_miles / 55;
    const { data: rows } = await context.supabase
      .from("trails")
      .select("id,name,kind,lat,lng,tags")
      .gte("lat", data.lat - dLat)
      .lte("lat", data.lat + dLat)
      .gte("lng", data.lng - dLng)
      .lte("lng", data.lng + dLng)
      .limit(60);
    const withMiles = (rows ?? [])
      .map((r) => ({ ...r, miles: milesBetween(data.lat, data.lng, r.lat, r.lng) }))
      .filter((r) => r.miles <= data.radius_miles)
      .sort((a, b) => a.miles - b.miles)
      .slice(0, data.limit);
    return { trails: withMiles };
  });
