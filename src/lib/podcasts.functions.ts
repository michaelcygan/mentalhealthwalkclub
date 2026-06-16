import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncFeedById } from "./podcasts.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Response("Forbidden", { status: 403 });
}

/** Admin: trigger RSS sync for one feed. */
export const syncPodcastFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { feedId: string }) => z.object({ feedId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return syncFeedById(data.feedId);
  });

/** Admin: create a new feed (then immediately sync to populate metadata). */
export const createPodcastFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      rss_url: z.string().url().max(500),
      title: z.string().min(1).max(200),
      publisher: z.string().max(200).optional(),
      category: z.enum(["calm_down", "think_clearly", "feel_connected", "walk_with_hope", "body_brain", "relationships"]),
      credibility: z.enum(["institutional", "academic", "public_media", "science", "lifestyle"]).default("lifestyle"),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("podcast_feeds")
      .insert({
        rss_url: data.rss_url,
        title: data.title,
        publisher: data.publisher,
        category: data.category,
        credibility: data.credibility,
        is_active: false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    try { await syncFeedById(row.id); } catch { /* surface via last_sync_error */ }
    return { id: row.id };
  });

import { z as _z } from "zod";
const RecentInput = _z.object({ limit: _z.number().int().min(1).max(24).default(6) });

export interface PodcastEpisodeCard {
  id: string;
  title: string;
  image_url: string | null;
  duration_seconds: number;
  publisher: string | null;
  published_at: string | null;
  audio_url: string | null;
  episode_url: string | null;
}

/** Public-safe: latest active podcast episodes across active feeds. */
export const recentPodcastEpisodes = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => RecentInput.parse(d ?? {}))
  .handler(async ({ data }): Promise<PodcastEpisodeCard[]> => {
    // Over-fetch so we can dedupe cross-feed syndications (e.g. NPR Life Kit
    // + Life Kit: Health publish identical episodes with different GUIDs).
    const { data: rows } = await supabaseAdmin
      .from("podcast_episodes")
      .select("id,title,image_url,duration_seconds,published_at,is_active,audio_url,episode_url,podcast_feeds!inner(publisher,is_active)")
      .eq("is_active", true)
      .eq("podcast_feeds.is_active", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(data.limit * 4);
    const seen = new Set<string>();
    const out: PodcastEpisodeCard[] = [];
    for (const r of rows ?? []) {
      const feed = (r as unknown as { podcast_feeds: { publisher: string | null } }).podcast_feeds;
      const publisher = feed?.publisher ?? null;
      const title = (r.title as string) ?? "";
      const key = `${(publisher ?? "").toLowerCase()}::${title.toLowerCase().replace(/\s+/g, " ").trim()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: r.id as string,
        title,
        image_url: (r.image_url as string | null) ?? null,
        duration_seconds: (r.duration_seconds as number) ?? 0,
        publisher,
        published_at: (r.published_at as string | null) ?? null,
        audio_url: (r.audio_url as string | null) ?? null,
        episode_url: (r.episode_url as string | null) ?? null,
      });
      if (out.length >= data.limit) break;
    }
    return out;
  });

export interface PodcastShowCard {
  id: string;
  title: string;
  publisher: string | null;
  image_url: string | null;
  episode_count: number;
  latest_published_at: string | null;
}

/** Public-safe: list of active podcast shows for the homepage grid. */
export const listPodcastShows = createServerFn({ method: "GET" })
  .handler(async (): Promise<PodcastShowCard[]> => {
    const { data: feeds } = await supabaseAdmin
      .from("podcast_feeds")
      .select("id,title,publisher,image_url")
      .eq("is_active", true);
    if (!feeds?.length) return [];

    // Grab latest episode per feed for ordering + cover fallback
    const { data: eps } = await supabaseAdmin
      .from("podcast_episodes")
      .select("feed_id,image_url,published_at")
      .eq("is_active", true)
      .in("feed_id", feeds.map((f) => f.id))
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(2000);

    const byFeed = new Map<string, { latest: string | null; image: string | null; count: number }>();
    for (const e of eps ?? []) {
      const fid = e.feed_id as string;
      const cur = byFeed.get(fid) ?? { latest: null, image: null, count: 0 };
      cur.count += 1;
      if (!cur.latest && e.published_at) {
        cur.latest = e.published_at as string;
        cur.image = (e.image_url as string | null) ?? cur.image;
      }
      byFeed.set(fid, cur);
    }

    const out: PodcastShowCard[] = feeds.map((f) => {
      const agg = byFeed.get(f.id as string);
      return {
        id: f.id as string,
        title: (f.title as string) ?? "Untitled",
        publisher: (f.publisher as string | null) ?? null,
        image_url: (f.image_url as string | null) ?? agg?.image ?? null,
        episode_count: agg?.count ?? 0,
        latest_published_at: agg?.latest ?? null,
      };
    });
    out.sort((a, b) => {
      const ta = a.latest_published_at ? Date.parse(a.latest_published_at) : 0;
      const tb = b.latest_published_at ? Date.parse(b.latest_published_at) : 0;
      return tb - ta;
    });
    return out;
  });

