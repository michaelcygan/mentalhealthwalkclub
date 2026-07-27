import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Place autosuggest + caching for the Plan-a-walk flow.
 *
 * V1 provider: Photon (OpenStreetMap). Called server-side only.
 * Legacy rows keyed by Google place IDs continue to exist as
 * (provider='google', provider_place_id=<old id>) but are not looked
 * up here anymore — new searches always create provider='osm' rows.
 *
 * Distinct from src/lib/places.functions.ts, which aggregates standing-walk
 * meetup locations into a discovery feed.
 */

/* ---------- search ---------- */

const SearchInput = z.object({
  query: z.string().trim().min(3).max(120),
  near: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .optional()
    .nullable(),
});

export type PlaceSuggestion = {
  provider: "osm";
  provider_place_id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  category: string | null;
  osm_type: "node" | "way" | "relation" | null;
  osm_id: string | null;
};

export const searchWalkPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SearchInput.parse(d))
  .handler(async ({ data }): Promise<{ results: PlaceSuggestion[] }> => {
    const {
      photonSearch,
      providerPlaceIdFromFeature,
      buildAddress,
      categoryFromFeature,
      displayName,
    } = await import("./geocoding/photon.server");

    let features;
    try {
      features = await photonSearch({
        query: data.query,
        lat: data.near?.lat,
        lng: data.near?.lng,
        limit: 8,
      });
    } catch (e) {
      console.warn("photon search failed", e);
      return { results: [] };
    }

    const results: PlaceSuggestion[] = [];
    for (const f of features) {
      const providerPlaceId = providerPlaceIdFromFeature(f);
      const [lon, lat] = f.geometry.coordinates ?? [];
      if (!providerPlaceId || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      results.push({
        provider: "osm",
        provider_place_id: providerPlaceId,
        name: displayName(f.properties),
        address: buildAddress(f.properties),
        lat: Number(lat),
        lng: Number(lon),
        category: categoryFromFeature(f.properties),
        osm_type: providerPlaceId.split(":")[0] as "node" | "way" | "relation",
        osm_id: providerPlaceId.split(":")[1] ?? null,
      });
      if (results.length >= 8) break;
    }
    return { results };
  });

/* ---------- get or create cached place ---------- */

const ALLOWED_CATEGORIES = ["park", "trail", "beach", "neighborhood", "city", "cafe"] as const;

const SuggestionInput = z.object({
  suggestion: z.object({
    provider: z.literal("osm"),
    provider_place_id: z.string().min(3).max(64).regex(/^(node|way|relation):\d+$/),
    name: z.string().trim().min(1).max(200),
    address: z.string().trim().max(500).nullable().optional(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    category: z.enum(ALLOWED_CATEGORIES).nullable().optional(),
  }),
});

async function fetchWikiSummary(name: string, city: string | null) {
  const q = encodeURIComponent(city ? `${name} ${city}` : name);
  try {
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&format=json&srlimit=1&origin=*`,
    );
    if (!searchRes.ok) return null;
    const searchJson = (await searchRes.json()) as {
      query?: { search?: Array<{ title: string }> };
    };
    const title = searchJson.query?.search?.[0]?.title;
    if (!title) return null;
    const sumRes = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    );
    if (!sumRes.ok) return null;
    const sumJson = (await sumRes.json()) as {
      extract?: string;
      thumbnail?: { source?: string };
      originalimage?: { source?: string };
      content_urls?: { desktop?: { page?: string } };
    };
    return {
      blurb: sumJson.extract ?? null,
      hero_url: sumJson.originalimage?.source ?? sumJson.thumbnail?.source ?? null,
      page_url: sumJson.content_urls?.desktop?.page ?? null,
    };
  } catch (e) {
    console.warn("wiki summary failed", e);
    return null;
  }
}

const PLACE_SELECT =
  "id,provider,provider_place_id,name,address,lat,lng,category,hero_url,hero_attribution,hero_source,blurb,blurb_source,osm_static_url";

export const getOrCreateWalkPlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SuggestionInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = data.suggestion;

    // 1. cache hit?
    const { data: cached } = await supabaseAdmin
      .from("places")
      .select(PLACE_SELECT)
      .eq("provider", s.provider)
      .eq("provider_place_id", s.provider_place_id)
      .maybeSingle();
    if (cached) return { place: cached };

    // 2. optional Wikipedia enrichment for outdoor / place-y categories
    const wikiCats = new Set(["park", "trail", "neighborhood", "city", "beach"]);
    let hero_url: string | null = null;
    let hero_attribution: string | null = null;
    let hero_source: string | null = null;
    let blurb: string | null = null;
    let blurb_source: string | null = null;

    if (s.category && wikiCats.has(s.category)) {
      const city = s.address?.split(",").map((x) => x.trim())[1] ?? null;
      const wiki = await fetchWikiSummary(s.name, city);
      if (wiki) {
        hero_url = wiki.hero_url;
        hero_attribution = wiki.page_url ? `Wikipedia · ${wiki.page_url}` : "Wikipedia";
        hero_source = "wikipedia";
        blurb = wiki.blurb;
        blurb_source = wiki.page_url;
      }
    }

    const osm_static_url = `https://staticmap.openstreetmap.de/staticmap.php?center=${s.lat},${s.lng}&zoom=14&size=600x300&markers=${s.lat},${s.lng},red-pushpin`;

    const { data: saved, error } = await supabaseAdmin
      .from("places")
      .insert({
        provider: s.provider,
        provider_place_id: s.provider_place_id,
        name: s.name,
        address: s.address ?? null,
        lat: s.lat,
        lng: s.lng,
        category: s.category ?? null,
        hero_url,
        hero_attribution,
        hero_source,
        blurb,
        blurb_source,
        osm_static_url,
      })
      .select(PLACE_SELECT)
      .single();

    if (error) {
      // race: another insert won. fetch existing.
      const { data: again } = await supabaseAdmin
        .from("places")
        .select(PLACE_SELECT)
        .eq("provider", s.provider)
        .eq("provider_place_id", s.provider_place_id)
        .maybeSingle();
      if (again) return { place: again };
      throw new Error(error.message);
    }
    return { place: saved };
  });
