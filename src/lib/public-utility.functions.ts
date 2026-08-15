import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

/**
 * Public walk-utility server boundary — no authentication required.
 *
 * Every read here is display-safe: the board comes from the
 * `public_walk_board` SQL function (filters before limiting, excludes
 * hostless seed walks, returns no private profile or guest data), and
 * portals come from `portal_locations` where `is_active`.
 */

/* ---------------------------------------------------------------- client */

function publicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
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
}

/* ------------------------------------------------------------------ board */

export type PublicBoardWalk = {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  timezone: string | null;
  venue_name: string | null;
  city: string | null;
  region: string | null;
  meeting_point: string | null;
  lat: number | null;
  lng: number | null;
  attendee_count: number;
  image_url: string | null;
  cover_override_url: string | null;
  pace: string | null;
  dog_friendly: boolean;
  kid_friendly: boolean;
  vibe: string | null;
  miles: number | null;
};

const BoardInput = z.object({
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  city: z.string().trim().min(1).max(120).nullable().optional(),
  radiusMiles: z.number().min(1).max(100).default(25),
  horizonHours: z.number().int().min(1).max(8760).default(720),
  limit: z.number().int().min(1).max(48).default(24),
  cursorStartsAt: z.string().nullable().optional(),
  cursorId: z.string().uuid().nullable().optional(),
});

export const publicWalkBoard = createServerFn({ method: "GET" })
  .inputValidator((d) => BoardInput.parse(d ?? {}))
  .handler(
    async ({
      data,
    }): Promise<{
      walks: PublicBoardWalk[];
      nextCursor: { startsAt: string; id: string } | null;
    }> => {
      const supabase = publicClient();
      if (!supabase) return { walks: [], nextCursor: null };

      const { data: rows, error } = await supabase.rpc(
        "public_walk_board" as never,
        {
          _lat: data.lat ?? null,
          _lng: data.lng ?? null,
          _city: data.city ?? null,
          _radius_miles: data.radiusMiles,
          _horizon_hours: data.horizonHours,
          _limit: data.limit,
          _cursor_starts_at: data.cursorStartsAt ?? null,
          _cursor_id: data.cursorId ?? null,
        } as never,
      );

      if (error) {
        console.error("publicWalkBoard error", error.message);
        return { walks: [], nextCursor: null };
      }

      const list = ((rows ?? []) as unknown as PublicBoardWalk[]).map((r) => ({
        ...r,
        lat: r.lat != null ? Number(r.lat) : null,
        lng: r.lng != null ? Number(r.lng) : null,
        miles: r.miles != null ? Number(r.miles) : null,
        image_url: r.cover_override_url ?? r.image_url,
      }));

      const last = list.length === data.limit ? list[list.length - 1] : undefined;
      return {
        walks: list,
        nextCursor: last ? { startsAt: last.starts_at, id: last.id } : null,
      };
    },
  );

/* ---------------------------------------------------------------- portals */

export type PortalLocation = {
  id: string;
  slug: string;
  label: string;
  lat: number;
  lng: number;
  radius_miles: number;
  city: string | null;
  region: string | null;
};

export const getPortalBySlug = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().trim().min(1).max(80) }).parse(d))
  .handler(async ({ data }): Promise<{ portal: PortalLocation | null }> => {
    const supabase = publicClient();
    if (!supabase) return { portal: null };
    const { data: row, error } = await supabase
      .from("portal_locations" as never)
      .select("id,slug,label,lat,lng,radius_miles,city,region")
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error) {
      console.error("getPortalBySlug error", error.message);
      return { portal: null };
    }
    if (!row) return { portal: null };
    const p = row as unknown as PortalLocation;
    return {
      portal: {
        ...p,
        lat: Number(p.lat),
        lng: Number(p.lng),
        radius_miles: Number(p.radius_miles),
      },
    };
  });

/* --------------------------------------------------- public place search */

export type PublicAreaSuggestion = {
  label: string;
  city: string | null;
  region: string | null;
  country: string | null;
  lat: number;
  lng: number;
};

/**
 * Narrow public area search used only by the visitor location selector.
 * Bounded query length, capped results, no caching of visitor input.
 */
export const publicAreaSearch = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ query: z.string().trim().min(2).max(80) }).parse(d))
  .handler(async ({ data }): Promise<{ results: PublicAreaSuggestion[] }> => {
    const { photonSearch, displayName } = await import("./geocoding/photon.server");
    let features;
    try {
      features = await photonSearch({ query: data.query, limit: 6 });
    } catch (e) {
      console.warn("publicAreaSearch failed", e);
      return { results: [] };
    }
    const results: PublicAreaSuggestion[] = [];
    for (const f of features) {
      const [lon, lat] = f.geometry.coordinates ?? [];
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const p = f.properties;
      const name = displayName(p);
      const label = [name, p.state, p.country].filter(Boolean).join(", ");
      results.push({
        label,
        city: p.city ?? (p.type === "city" ? name : null) ?? null,
        region: p.state ?? null,
        country: p.country ?? null,
        lat: Number(lat),
        lng: Number(lon),
      });
      if (results.length >= 6) break;
    }
    return { results };
  });
