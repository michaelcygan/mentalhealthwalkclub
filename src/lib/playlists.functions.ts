import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireUnderCap } from "@/lib/plus-guard.server";

const ItemKind = z.enum(["podcast_episode", "ambient_track", "guided_track"]);

export const listMyPlaylists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: playlists, error } = await supabase
      .from("playlists")
      .select("id,name,mood,is_public,created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (playlists ?? []).map((p) => p.id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: items } = await supabase
        .from("playlist_items")
        .select("playlist_id")
        .in("playlist_id", ids);
      for (const it of items ?? []) counts[it.playlist_id] = (counts[it.playlist_id] ?? 0) + 1;
    }
    return {
      playlists: (playlists ?? []).map((p) => ({ ...p, item_count: counts[p.id] ?? 0 })),
    };
  });

export const createPlaylist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().min(1).max(80),
      mood: z.string().max(40).optional(),
      is_public: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("playlists")
      .insert({ owner_id: userId, name: data.name, mood: data.mood ?? null, is_public: data.is_public })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deletePlaylist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("playlists").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPlaylist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: pl, error } = await supabase
      .from("playlists")
      .select("id,name,mood,is_public,owner_id")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: items } = await supabase
      .from("playlist_items")
      .select("id,position,kind,track_id")
      .eq("playlist_id", data.id)
      .order("position", { ascending: true });

    // Hydrate each item with title/duration based on kind.
    const enriched = await Promise.all(
      (items ?? []).map(async (it) => {
        if (it.kind === "podcast_episode") {
          const { data: r } = await supabase
            .from("podcast_episodes")
            .select("id,title,duration_seconds,image_url")
            .eq("id", it.track_id)
            .maybeSingle();
          return { ...it, meta: r };
        }
        if (it.kind === "ambient_track") {
          const { data: r } = await supabase
            .from("ambient_tracks")
            .select("id,title,artist,duration_seconds,cover_path")
            .eq("id", it.track_id)
            .maybeSingle();
          return { ...it, meta: r };
        }
        const { data: r } = await supabase
          .from("guided_tracks")
          .select("id,title,host,duration_seconds,cover_url")
          .eq("id", it.track_id)
          .maybeSingle();
        return { ...it, meta: r };
      }),
    );
    return { playlist: pl, items: enriched };
  });

export const addPlaylistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      playlist_id: z.string().uuid(),
      kind: ItemKind,
      track_id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: maxRow } = await supabase
      .from("playlist_items")
      .select("position")
      .eq("playlist_id", data.playlist_id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPos = (maxRow?.position ?? -1) + 1;
    const { error } = await supabase.from("playlist_items").insert({
      playlist_id: data.playlist_id,
      kind: data.kind,
      track_id: data.track_id,
      position: nextPos,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePlaylistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("playlist_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderPlaylistItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      playlist_id: z.string().uuid(),
      ids: z.array(z.string().uuid()).max(200),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await Promise.all(
      data.ids.map((id, idx) =>
        supabase.from("playlist_items").update({ position: idx }).eq("id", id).eq("playlist_id", data.playlist_id),
      ),
    );
    return { ok: true };
  });

/** Lightweight track catalog reads for the /listen hub. */
export const listenCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [pods, amb, guided] = await Promise.all([
      supabase
        .from("podcast_episodes")
        .select("id,title,image_url,duration_seconds,walk_fit_score,published_at,is_featured,featured_rank")
        .eq("is_active", true)
        .order("is_featured", { ascending: false })
        .order("featured_rank", { ascending: true, nullsFirst: false })
        .order("walk_fit_score", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(12),
      supabase
        .from("ambient_tracks")
        .select("id,title,artist,cover_path,duration_seconds,mood_tags,is_featured,featured_rank")
        .eq("is_active", true)
        .order("is_featured", { ascending: false })
        .order("featured_rank", { ascending: true, nullsFirst: false })
        .order("sort_order", { ascending: true })
        .limit(12),
      supabase
        .from("guided_tracks")
        .select("id,title,host,cover_url,duration_seconds,category,is_featured,featured_rank")
        .eq("is_active", true)
        .order("is_featured", { ascending: false })
        .order("featured_rank", { ascending: true, nullsFirst: false })
        .order("sort_order", { ascending: true })
        .limit(12),
    ]);
    return {
      podcasts: pods.data ?? [],
      ambient: amb.data ?? [],
      guided: guided.data ?? [],
    };
  });

