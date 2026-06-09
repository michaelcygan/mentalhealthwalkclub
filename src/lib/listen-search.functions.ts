import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SearchKind = "podcast" | "ambient" | "guided" | "blog";

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  cover: string | null;
  link: string | null;
  duration_seconds: number | null;
  mood_tags: string[];
}

const SearchInput = z.object({
  q: z.string().trim().max(120).default(""),
  kinds: z.array(z.enum(["podcast", "ambient", "guided", "blog"])).max(4).optional(),
  moods: z.array(z.string().min(1).max(40)).max(8).optional(),
  limit: z.number().int().min(1).max(40).default(20),
});

function wantKind(kinds: SearchKind[] | undefined, k: SearchKind) {
  return !kinds || kinds.length === 0 || kinds.includes(k);
}

function moodOverlap(itemTags: string[] | null | undefined, moods: string[] | undefined) {
  if (!moods || moods.length === 0) return true;
  if (!itemTags || itemTags.length === 0) return false;
  const setMoods = new Set(moods.map((m) => m.toLowerCase()));
  return itemTags.some((t) => setMoods.has((t ?? "").toLowerCase()));
}

export const searchListen = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SearchInput.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<{ hits: SearchHit[]; total: number }> => {
    const { supabase, userId } = context;
    const { q, kinds, moods, limit } = data;
    const like = q ? `%${q}%` : null;
    const moodTagsFilter = moods && moods.length ? `{${moods.map((m) => `"${m.replace(/"/g, "")}"`).join(",")}}` : null;

    const podcastsQ = wantKind(kinds, "podcast")
      ? supabase
          .from("podcast_episodes")
          .select("id,title,image_url,duration_seconds,episode_url,mood_tags,podcast_feeds!inner(title,publisher,is_active)")
          .eq("is_active", true)
          .eq("podcast_feeds.is_active", true)
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(limit)
      : Promise.resolve({ data: [] as unknown[], error: null });

    const ambientQ = wantKind(kinds, "ambient")
      ? supabase
          .from("ambient_tracks")
          .select("id,title,artist,cover_path,duration_seconds,mood_tags,genre")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .limit(limit)
      : Promise.resolve({ data: [] as unknown[], error: null });

    const guidedQ = wantKind(kinds, "guided")
      ? supabase
          .from("guided_tracks")
          .select("id,title,host,cover_url,duration_seconds,mood_tags,category")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .limit(limit)
      : Promise.resolve({ data: [] as unknown[], error: null });

    const blogQ = wantKind(kinds, "blog")
      ? supabase
          .from("blog_posts")
          .select("id,title,summary,link,image_url,blog_feeds!inner(publisher,is_active)")
          .eq("blog_feeds.is_active", true)
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(limit)
      : Promise.resolve({ data: [] as unknown[], error: null });

    // Add q ilike filters where present
    const [pods, amb, gd, bl] = await Promise.all([
      q && wantKind(kinds, "podcast")
        ? supabase
            .from("podcast_episodes")
            .select("id,title,image_url,duration_seconds,episode_url,mood_tags,podcast_feeds!inner(title,publisher,is_active)")
            .eq("is_active", true)
            .eq("podcast_feeds.is_active", true)
            .or(`title.ilike.${like},podcast_feeds.title.ilike.${like},podcast_feeds.publisher.ilike.${like}`)
            .limit(limit)
        : podcastsQ,
      q && wantKind(kinds, "ambient")
        ? supabase
            .from("ambient_tracks")
            .select("id,title,artist,cover_path,duration_seconds,mood_tags,genre")
            .eq("is_active", true)
            .or(`title.ilike.${like},artist.ilike.${like},genre.ilike.${like}`)
            .limit(limit)
        : ambientQ,
      q && wantKind(kinds, "guided")
        ? supabase
            .from("guided_tracks")
            .select("id,title,host,cover_url,duration_seconds,mood_tags,category")
            .eq("is_active", true)
            .or(`title.ilike.${like},host.ilike.${like},category.ilike.${like}`)
            .limit(limit)
        : guidedQ,
      q && wantKind(kinds, "blog")
        ? supabase
            .from("blog_posts")
            .select("id,title,summary,link,image_url,blog_feeds!inner(publisher,is_active)")
            .eq("blog_feeds.is_active", true)
            .or(`title.ilike.${like},summary.ilike.${like},blog_feeds.publisher.ilike.${like}`)
            .limit(limit)
        : blogQ,
    ]);

    const hits: SearchHit[] = [];

    for (const row of (pods.data ?? []) as Array<{ id: string; title: string; image_url: string | null; duration_seconds: number | null; episode_url: string | null; mood_tags: string[] | null; podcast_feeds: { title: string | null; publisher: string | null } }>) {
      if (!moodOverlap(row.mood_tags, moods)) continue;
      hits.push({
        kind: "podcast",
        id: row.id,
        title: row.title,
        subtitle: row.podcast_feeds?.publisher ?? row.podcast_feeds?.title ?? null,
        cover: row.image_url,
        link: row.episode_url,
        duration_seconds: row.duration_seconds,
        mood_tags: row.mood_tags ?? [],
      });
    }
    for (const row of (amb.data ?? []) as Array<{ id: string; title: string; artist: string | null; cover_path: string | null; duration_seconds: number | null; mood_tags: string[] | null; genre: string | null }>) {
      if (!moodOverlap(row.mood_tags, moods)) continue;
      hits.push({
        kind: "ambient",
        id: row.id,
        title: row.title,
        subtitle: row.artist ?? row.genre,
        cover: row.cover_path,
        link: null,
        duration_seconds: row.duration_seconds,
        mood_tags: row.mood_tags ?? [],
      });
    }
    for (const row of (gd.data ?? []) as Array<{ id: string; title: string; host: string | null; cover_url: string | null; duration_seconds: number | null; mood_tags: string[] | null; category: string | null }>) {
      if (!moodOverlap(row.mood_tags, moods)) continue;
      hits.push({
        kind: "guided",
        id: row.id,
        title: row.title,
        subtitle: row.host ?? row.category,
        cover: row.cover_url,
        link: null,
        duration_seconds: row.duration_seconds,
        mood_tags: row.mood_tags ?? [],
      });
    }
    for (const row of (bl.data ?? []) as Array<{ id: string; title: string; summary: string | null; link: string; image_url: string | null; blog_feeds: { publisher: string | null } }>) {
      hits.push({
        kind: "blog",
        id: row.id,
        title: row.title,
        subtitle: row.blog_feeds?.publisher ?? null,
        cover: row.image_url,
        link: row.link,
        duration_seconds: null,
        mood_tags: [],
      });
    }

    // Fire-and-forget search log (skip empty queries to keep it clean)
    if (q) {
      await supabase.from("listen_search_log").insert({ user_id: userId, q, result_count: hits.length });
    }
    // Avoid unused var if no q was passed
    void moodTagsFilter;

    return { hits, total: hits.length };
  });

export const listMoodChips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { supabase } = context;
    const [pods, amb, gd] = await Promise.all([
      supabase.from("podcast_episodes").select("mood_tags").eq("is_active", true).limit(500),
      supabase.from("ambient_tracks").select("mood_tags").eq("is_active", true).limit(500),
      supabase.from("guided_tracks").select("mood_tags").eq("is_active", true).limit(500),
    ]);
    const tally = new Map<string, number>();
    const eat = (rows: Array<{ mood_tags: string[] | null }> | null) => {
      for (const r of rows ?? []) for (const t of r.mood_tags ?? []) {
        const k = (t ?? "").trim().toLowerCase();
        if (!k) continue;
        tally.set(k, (tally.get(k) ?? 0) + 1);
      }
    };
    eat(pods.data as Array<{ mood_tags: string[] | null }> | null);
    eat(amb.data as Array<{ mood_tags: string[] | null }> | null);
    eat(gd.data as Array<{ mood_tags: string[] | null }> | null);
    return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k]) => k);
  });

export const logListenEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      kind: z.enum(["podcast", "ambient", "guided", "blog"]),
      item_id: z.string().uuid(),
      action: z.enum(["open", "play", "save", "queue"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("listen_events").insert({
      user_id: userId, kind: data.kind, item_id: data.item_id, action: data.action,
    });
    return { ok: true };
  });

export const trendingListen = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(1).max(60).default(7), limit: z.number().int().min(1).max(24).default(8) }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<SearchHit[]> => {
    const { supabase } = context;
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    const { data: rows } = await supabase
      .from("listen_events")
      .select("kind,item_id,user_id,created_at")
      .gte("created_at", since)
      .in("action", ["open", "play", "save"]);
    const counts = new Map<string, { kind: SearchKind; id: string; users: Set<string> }>();
    for (const r of (rows ?? []) as Array<{ kind: SearchKind; item_id: string; user_id: string }>) {
      const key = `${r.kind}:${r.item_id}`;
      const entry = counts.get(key) ?? { kind: r.kind, id: r.item_id, users: new Set<string>() };
      entry.users.add(r.user_id);
      counts.set(key, entry);
    }
    const top = [...counts.values()].sort((a, b) => b.users.size - a.users.size).slice(0, data.limit);
    if (top.length === 0) return [];
    // Hydrate by kind in batches
    const byKind: Record<SearchKind, string[]> = { podcast: [], ambient: [], guided: [], blog: [] };
    for (const t of top) byKind[t.kind].push(t.id);
    const [pods, amb, gd, bl] = await Promise.all([
      byKind.podcast.length
        ? supabase.from("podcast_episodes").select("id,title,image_url,duration_seconds,mood_tags,episode_url").in("id", byKind.podcast)
        : Promise.resolve({ data: [] as unknown[] }),
      byKind.ambient.length
        ? supabase.from("ambient_tracks").select("id,title,artist,cover_path,duration_seconds,mood_tags").in("id", byKind.ambient)
        : Promise.resolve({ data: [] as unknown[] }),
      byKind.guided.length
        ? supabase.from("guided_tracks").select("id,title,host,cover_url,duration_seconds,mood_tags").in("id", byKind.guided)
        : Promise.resolve({ data: [] as unknown[] }),
      byKind.blog.length
        ? supabase.from("blog_posts").select("id,title,image_url,link,blog_feeds(publisher)").in("id", byKind.blog)
        : Promise.resolve({ data: [] as unknown[] }),
    ]);
    const map = new Map<string, SearchHit>();
    for (const r of (pods.data ?? []) as Array<{ id: string; title: string; image_url: string | null; duration_seconds: number | null; mood_tags: string[] | null; episode_url: string | null }>) {
      map.set(`podcast:${r.id}`, { kind: "podcast", id: r.id, title: r.title, subtitle: null, cover: r.image_url, link: r.episode_url, duration_seconds: r.duration_seconds, mood_tags: r.mood_tags ?? [] });
    }
    for (const r of (amb.data ?? []) as Array<{ id: string; title: string; artist: string | null; cover_path: string | null; duration_seconds: number | null; mood_tags: string[] | null }>) {
      map.set(`ambient:${r.id}`, { kind: "ambient", id: r.id, title: r.title, subtitle: r.artist, cover: r.cover_path, link: null, duration_seconds: r.duration_seconds, mood_tags: r.mood_tags ?? [] });
    }
    for (const r of (gd.data ?? []) as Array<{ id: string; title: string; host: string | null; cover_url: string | null; duration_seconds: number | null; mood_tags: string[] | null }>) {
      map.set(`guided:${r.id}`, { kind: "guided", id: r.id, title: r.title, subtitle: r.host, cover: r.cover_url, link: null, duration_seconds: r.duration_seconds, mood_tags: r.mood_tags ?? [] });
    }
    for (const r of (bl.data ?? []) as Array<{ id: string; title: string; image_url: string | null; link: string; blog_feeds: { publisher: string | null } | null }>) {
      map.set(`blog:${r.id}`, { kind: "blog", id: r.id, title: r.title, subtitle: r.blog_feeds?.publisher ?? null, cover: r.image_url, link: r.link, duration_seconds: null, mood_tags: [] });
    }
    return top.map((t) => map.get(`${t.kind}:${t.id}`)).filter(Boolean) as SearchHit[];
  });

export const recentlyAddedListen = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(1).max(60).default(14), limit: z.number().int().min(1).max(24).default(8) }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<SearchHit[]> => {
    const { supabase } = context;
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    const [pods, amb, gd, bl] = await Promise.all([
      supabase.from("podcast_episodes").select("id,title,image_url,duration_seconds,mood_tags,episode_url,published_at").eq("is_active", true).gte("published_at", since).order("published_at", { ascending: false }).limit(data.limit),
      supabase.from("ambient_tracks").select("id,title,artist,cover_path,duration_seconds,mood_tags,created_at").eq("is_active", true).gte("created_at", since).order("created_at", { ascending: false }).limit(data.limit),
      supabase.from("guided_tracks").select("id,title,host,cover_url,duration_seconds,mood_tags,created_at").eq("is_active", true).gte("created_at", since).order("created_at", { ascending: false }).limit(data.limit),
      supabase.from("blog_posts").select("id,title,image_url,link,published_at,blog_feeds!inner(publisher,is_active)").eq("blog_feeds.is_active", true).gte("published_at", since).order("published_at", { ascending: false }).limit(data.limit),
    ]);
    const out: SearchHit[] = [];
    for (const r of (pods.data ?? []) as Array<{ id: string; title: string; image_url: string | null; duration_seconds: number | null; mood_tags: string[] | null; episode_url: string | null; published_at: string | null }>) {
      out.push({ kind: "podcast", id: r.id, title: r.title, subtitle: r.published_at ? new Date(r.published_at).toLocaleDateString() : null, cover: r.image_url, link: r.episode_url, duration_seconds: r.duration_seconds, mood_tags: r.mood_tags ?? [] });
    }
    for (const r of (amb.data ?? []) as Array<{ id: string; title: string; artist: string | null; cover_path: string | null; duration_seconds: number | null; mood_tags: string[] | null }>) {
      out.push({ kind: "ambient", id: r.id, title: r.title, subtitle: r.artist, cover: r.cover_path, link: null, duration_seconds: r.duration_seconds, mood_tags: r.mood_tags ?? [] });
    }
    for (const r of (gd.data ?? []) as Array<{ id: string; title: string; host: string | null; cover_url: string | null; duration_seconds: number | null; mood_tags: string[] | null }>) {
      out.push({ kind: "guided", id: r.id, title: r.title, subtitle: r.host, cover: r.cover_url, link: null, duration_seconds: r.duration_seconds, mood_tags: r.mood_tags ?? [] });
    }
    for (const r of (bl.data ?? []) as Array<{ id: string; title: string; image_url: string | null; link: string; blog_feeds: { publisher: string | null } }>) {
      out.push({ kind: "blog", id: r.id, title: r.title, subtitle: r.blog_feeds?.publisher ?? null, cover: r.image_url, link: r.link, duration_seconds: null, mood_tags: [] });
    }
    return out.slice(0, data.limit);
  });
