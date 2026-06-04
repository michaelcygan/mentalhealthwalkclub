import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  hours: z.number().int().min(1).max(168).default(48),
  limit: z.number().int().min(1).max(20).default(6),
});

function milesBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Walks happening within `hours` from now. RLS filters out group walks the
 * user can't see. When lat/lng provided, we Haversine-filter to ≤25mi.
 */
export const discoverNearbyWalks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const now = new Date();
    const until = new Date(now.getTime() + data.hours * 60 * 60 * 1000);

    const { data: rows, error } = await supabase
      .from("events")
      .select(
        "id,slug,title,starts_at,timezone,venue_name,city,neighborhood:meeting_point,lat,lng,attendee_count,image_url,audience_mode,visibility,group_id",
      )
      .eq("status", "published")
      .gte("starts_at", now.toISOString())
      .lte("starts_at", until.toISOString())
      .order("starts_at", { ascending: true })
      .limit(80);
    if (error) throw new Error(error.message);

    let withDist = (rows ?? []).map((r) => ({ ...r, miles: null as number | null }));
    if (data.lat != null && data.lng != null) {
      withDist = withDist
        .map((r) => {
          if (r.lat == null || r.lng == null) return { ...r, miles: null };
          const miles = milesBetween(data.lat!, data.lng!, Number(r.lat), Number(r.lng));
          return { ...r, miles };
        })
        .filter((r) => r.miles == null || r.miles <= 25)
        .sort((a, b) => {
          // chronological first, then distance as tiebreaker
          const t = new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
          if (t !== 0) return t;
          return (a.miles ?? 9999) - (b.miles ?? 9999);
        });
    }

    return { walks: withDist.slice(0, data.limit) };
  });
