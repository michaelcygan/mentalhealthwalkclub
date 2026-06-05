import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Google Places (New) + Wikipedia lookup for the Plan-a-walk flow.
 * Results are cached in public.places keyed by google_place_id.
 *
 * NOTE: this is distinct from src/lib/places.functions.ts, which aggregates
 * standing-walk meetup locations into a discovery feed.
 */

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

function gatewayHeaders(extra: Record<string, string> = {}) {
  const lovKey = process.env.LOVABLE_API_KEY;
  const gKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovKey || !gKey) {
    throw new Error("Google Maps connector not configured");
  }
  return {
    Authorization: `Bearer ${lovKey}`,
    "X-Connection-Api-Key": gKey,
    "Content-Type": "application/json",
    ...extra,
  };
}

/* ---------- search ---------- */

const SearchInput = z.object({
  query: z.string().trim().min(2).max(120),
  near: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .optional()
    .nullable(),
});

export type PlaceSuggestion = {
  google_place_id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

export const searchWalkPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SearchInput.parse(d))
  .handler(async ({ data }): Promise<{ results: PlaceSuggestion[] }> => {
    const body: Record<string, unknown> = { textQuery: data.query, pageSize: 8 };
    if (data.near) {
      body.locationBias = {
        circle: { center: { latitude: data.near.lat, longitude: data.near.lng }, radius: 50000 },
      };
    }
    const res = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
      method: "POST",
      headers: gatewayHeaders({
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location",
      }),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("places searchText failed", res.status, txt);
      return { results: [] };
    }
    const json = (await res.json()) as {
      places?: Array<{
        id: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
      }>;
    };
    const results: PlaceSuggestion[] = (json.places ?? []).map((p) => ({
      google_place_id: p.id,
      name: p.displayName?.text ?? p.formattedAddress ?? "Unknown",
      address: p.formattedAddress ?? null,
      lat: p.location?.latitude ?? null,
      lng: p.location?.longitude ?? null,
    }));
    return { results };
  });

/* ---------- get or create cached place ---------- */

const GetOrCreateInput = z.object({
  google_place_id: z.string().min(3).max(255),
});

function categoryFromTypes(types: string[] | undefined): string | null {
  if (!types?.length) return null;
  const t = new Set(types.map((x) => x.toLowerCase()));
  if (t.has("park") || t.has("national_park") || t.has("state_park")) return "park";
  if (t.has("hiking_area") || t.has("trail")) return "trail";
  if (t.has("beach")) return "beach";
  if (t.has("neighborhood") || t.has("sublocality")) return "neighborhood";
  if (t.has("locality") || t.has("administrative_area_level_2")) return "city";
  if (t.has("cafe") || t.has("coffee_shop")) return "cafe";
  return null;
}

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

export const getOrCreateWalkPlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => GetOrCreateInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. cache hit?
    const { data: cached } = await supabaseAdmin
      .from("places")
      .select("*")
      .eq("google_place_id", data.google_place_id)
      .maybeSingle();
    if (cached) return { place: cached };

    // 2. fetch place details (Places API New)
    const detailRes = await fetch(
      `${GATEWAY}/places/v1/places/${encodeURIComponent(data.google_place_id)}`,
      {
        method: "GET",
        headers: gatewayHeaders({
          "X-Goog-FieldMask":
            "id,displayName,formattedAddress,location,types,addressComponents,photos",
        }),
      },
    );
    if (!detailRes.ok) {
      const txt = await detailRes.text();
      console.error("places details failed", detailRes.status, txt);
      throw new Error("Could not look up that place.");
    }
    const place = (await detailRes.json()) as {
      id: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      types?: string[];
      addressComponents?: Array<{ longText?: string; types?: string[] }>;
      photos?: Array<{ name: string }>;
    };

    const name = place.displayName?.text ?? "Unnamed place";
    const address = place.formattedAddress ?? null;
    const lat = place.location?.latitude ?? null;
    const lng = place.location?.longitude ?? null;
    const category = categoryFromTypes(place.types);
    const city =
      place.addressComponents?.find((c) => c.types?.includes("locality"))?.longText ?? null;

    // 3. wiki lookup for park/trail/neighborhood/city/beach
    let hero_url: string | null = null;
    let hero_attribution: string | null = null;
    let hero_source: string | null = null;
    let blurb: string | null = null;
    let blurb_source: string | null = null;

    if (category && ["park", "trail", "neighborhood", "city", "beach"].includes(category)) {
      const wiki = await fetchWikiSummary(name, city);
      if (wiki) {
        hero_url = wiki.hero_url;
        hero_attribution = wiki.page_url ? `Wikipedia · ${wiki.page_url}` : "Wikipedia";
        hero_source = "wikipedia";
        blurb = wiki.blurb;
        blurb_source = wiki.page_url;
      }
    }

    // 4. fallback to Google photo
    if (!hero_url && place.photos?.[0]?.name) {
      hero_url = `${GATEWAY}/places/v1/${place.photos[0].name}/media?maxWidthPx=1200&skipHttpRedirect=false`;
      hero_attribution = "Google";
      hero_source = "google";
    }

    const osm_static_url =
      lat != null && lng != null
        ? `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=14&size=600x300&markers=${lat},${lng},red-pushpin`
        : null;

    const { data: saved, error } = await supabaseAdmin
      .from("places")
      .insert({
        google_place_id: data.google_place_id,
        name,
        address,
        lat,
        lng,
        category,
        hero_url,
        hero_attribution,
        hero_source,
        blurb,
        blurb_source,
        osm_static_url,
      })
      .select("*")
      .single();

    if (error) {
      // race: another insert won. fetch existing.
      const { data: again } = await supabaseAdmin
        .from("places")
        .select("*")
        .eq("google_place_id", data.google_place_id)
        .maybeSingle();
      if (again) return { place: again };
      throw new Error(error.message);
    }
    return { place: saved };
  });
