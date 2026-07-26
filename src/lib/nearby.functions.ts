import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const Input = z.object({
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  city: z.string().trim().min(1).max(120).nullable().optional(),
  hours: z.number().int().min(1).max(168).default(72),
  limit: z.number().int().min(1).max(24).default(8),
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
 * Public nearby-walks reader — no auth required.
 * Reads from the `public_events` view (only display-safe columns) via a
 * publishable-key Supabase client. RLS on the underlying `events` table is
 * scoped to public+published+upcoming rows for `anon`.
 */
export const nearbyWalksPublic = createServerFn({ method: "GET" })
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return { walks: [] };

    const supabase = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const now = new Date();
    const until = new Date(now.getTime() + data.hours * 60 * 60 * 1000);

    const { data: rows, error } = await supabase
      .from("public_events" as never)
      .select(
        "id,slug,title,starts_at,timezone,venue_name,city,neighborhood,lat,lng,attendee_count,image_url,cover_override_url,host_user_id,group_id,audience_mode,visibility",
      )
      .gte("starts_at", now.toISOString())
      .lte("starts_at", until.toISOString())
      .order("starts_at", { ascending: true })
      .limit(80);

    if (error) {
      console.error("nearbyWalksPublic error", error.message);
      return { walks: [] };
    }

    type Row = {
      id: string; slug: string; title: string; starts_at: string;
      timezone: string | null; venue_name: string | null; city: string | null;
      neighborhood: string | null; lat: number | string | null; lng: number | string | null;
      attendee_count: number; image_url: string | null; cover_override_url: string | null;
      host_user_id: string | null; group_id: string | null;
      audience_mode: string; visibility: string;
    };
    const list = (rows ?? []) as unknown as Row[];

    const withDist = list.map((r) => ({
      ...r,
      image_url: r.cover_override_url ?? r.image_url,
      miles:
        data.lat != null && data.lng != null && r.lat != null && r.lng != null
          ? milesBetween(data.lat, data.lng, Number(r.lat), Number(r.lng))
          : null,
    }));

    const cityNorm = data.city?.trim().toLowerCase() || null;
    const hasCoords = data.lat != null && data.lng != null;
    const hasFilter = cityNorm != null || hasCoords;

    let filtered = withDist;
    if (hasFilter) {
      const seen = new Set<string>();
      filtered = withDist.filter((r) => {
        const cityMatch =
          cityNorm != null && (r.city?.trim().toLowerCase() ?? "") === cityNorm;
        const withinRadius = hasCoords && r.miles != null && r.miles <= 25;
        if (!cityMatch && !withinRadius) return false;
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });
    }

    filtered = filtered.slice().sort((a, b) => {
      const t = new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
      if (t !== 0) return t;
      return (a.miles ?? 9999) - (b.miles ?? 9999);
    });

    return { walks: filtered.slice(0, data.limit) };
  });
