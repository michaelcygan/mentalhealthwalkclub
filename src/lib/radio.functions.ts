import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ============================================================
   Types
   ============================================================ */

export type RadioSourceType = "upload" | "external_url" | "podcast_episode";
export type PlaybackMode = "ordered" | "shuffle";

export interface StationCard {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  cover_url: string | null;
  cover_signed: string | null;
  sort: number;
  playback_mode: PlaybackMode;
  loop_enabled: boolean;
  is_default: boolean;
}

export interface RadioItem {
  id: string;
  station_id: string;
  source_type: RadioSourceType;
  storage_key: string | null;
  external_url: string | null;
  podcast_episode_id: string | null;
  title: string;
  artist: string | null;
  duration_s: number | null;
  sort: number;
  repeat_count: number;
  is_active: boolean;
}

export interface ResolvedRadioItem {
  id: string;
  stationId: string;
  sourceType: RadioSourceType;
  title: string;
  artist: string | null;
  durationSeconds: number | null;
  audioUrl: string;
  sourcePageUrl: string | null;
  imageUrl: string | null;
}

/* ============================================================
   Public listener functions
   ============================================================ */

export const listStations = createServerFn({ method: "GET" }).handler(async () => {
  const { serverClient, signCover } = await import("@/lib/radio.server");
  const supabase = serverClient();
  const { data, error } = await supabase
    .from("radio_stations")
    .select("id,slug,title,subtitle,cover_url,sort,playback_mode,loop_enabled,is_default")
    .eq("is_active", true)
    .order("sort", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const stations: StationCard[] = await Promise.all(
    rows.map(async (s) => ({
      id: s.id,
      slug: s.slug,
      title: s.title,
      subtitle: s.subtitle,
      cover_url: s.cover_url,
      sort: s.sort,
      playback_mode: (s.playback_mode ?? "shuffle") as PlaybackMode,
      loop_enabled: s.loop_enabled ?? true,
      is_default: s.is_default ?? false,
      cover_signed: await signCover(supabase, s.cover_url),
    })),
  );
  return stations;
});

export const getStation = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { serverClient, signCover } = await import("@/lib/radio.server");
    const supabase = serverClient();
    const { data: st, error } = await supabase
      .from("radio_stations")
      .select("id,slug,title,subtitle,cover_url,sort,playback_mode,loop_enabled,is_default")
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!st) return null;
    const { data: tracks } = await supabase
      .from("radio_tracks")
      .select("id,station_id,source_type,storage_key,external_url,podcast_episode_id,title,artist,duration_s,sort,repeat_count,is_active")
      .eq("station_id", st.id)
      .eq("is_active", true)
      .order("sort", { ascending: true });
    const station: StationCard = {
      id: st.id,
      slug: st.slug,
      title: st.title,
      subtitle: st.subtitle,
      cover_url: st.cover_url,
      sort: st.sort,
      playback_mode: (st.playback_mode ?? "shuffle") as PlaybackMode,
      loop_enabled: st.loop_enabled ?? true,
      is_default: st.is_default ?? false,
      cover_signed: await signCover(supabase, st.cover_url),
    };
    return {
      station,
      items: (tracks ?? []).map((t) => ({
        ...t,
        source_type: (t.source_type ?? "upload") as RadioSourceType,
        repeat_count: t.repeat_count ?? 1,
      })) as RadioItem[],
    };
  });

/**
 * Central playable-source resolver.
 * Resolves any radio_tracks row to a fresh playable URL regardless of source_type.
 */
export const resolveRadioItem = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<ResolvedRadioItem | null> => {
    const { serverClient, TRACK_TTL } = await import("@/lib/radio.server");
    const supabase = serverClient();
    const { data: row, error } = await supabase
      .from("radio_tracks")
      .select("id,station_id,source_type,storage_key,external_url,podcast_episode_id,title,artist,duration_s,is_active")
      .eq("id", data.itemId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || !row.is_active) return null;

    // Verify station is active
    const { data: st } = await supabase
      .from("radio_stations")
      .select("is_active")
      .eq("id", row.station_id)
      .maybeSingle();
    if (!st?.is_active) return null;

    const sourceType = (row.source_type ?? "upload") as RadioSourceType;
    let audioUrl = "";
    let sourcePageUrl: string | null = null;
    let imageUrl: string | null = null;
    let durationSeconds: number | null = row.duration_s ?? null;
    const artist = row.artist ?? null;

    if (sourceType === "upload") {
      if (!row.storage_key) return null;
      const { data: signed } = await supabase.storage
        .from("radio-tracks")
        .createSignedUrl(row.storage_key, TRACK_TTL);
      if (!signed?.signedUrl) return null;
      audioUrl = signed.signedUrl;
    } else if (sourceType === "external_url") {
      if (!row.external_url) return null;
      audioUrl = row.external_url;
    } else if (sourceType === "podcast_episode") {
      if (!row.podcast_episode_id) return null;
      const { data: ep } = await supabase
        .from("podcast_episodes")
        .select("audio_url,episode_url,image_url,duration_seconds")
        .eq("id", row.podcast_episode_id)
        .maybeSingle();
      if (!ep?.audio_url) return null;
      audioUrl = ep.audio_url;
      sourcePageUrl = ep.episode_url ?? null;
      imageUrl = ep.image_url ?? null;
      if (durationSeconds == null && ep.duration_seconds != null) durationSeconds = ep.duration_seconds;
    }

    return {
      id: row.id,
      stationId: row.station_id,
      sourceType,
      title: row.title,
      artist,
      durationSeconds,
      audioUrl,
      sourcePageUrl,
      imageUrl,
    };
  });

/** Legacy — kept for backward compatibility; upload-only path. */
export const signTrackUrl = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ trackId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { serverClient, TRACK_TTL } = await import("@/lib/radio.server");
    const supabase = serverClient();
    const { data: track, error } = await supabase
      .from("radio_tracks")
      .select("storage_key,is_active,source_type")
      .eq("id", data.trackId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!track || !track.is_active || !track.storage_key) throw new Error("Track not found");
    const { data: signed, error: sErr } = await supabase.storage
      .from("radio-tracks")
      .createSignedUrl(track.storage_key, TRACK_TTL);
    if (sErr || !signed) throw new Error(sErr?.message ?? "Sign failed");
    return { url: signed.signedUrl };
  });

/* ============================================================
   Admin — stations
   ============================================================ */

export const adminListStations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { serverClient, assertAdmin } = await import("@/lib/radio.server");
    const supabase = serverClient();
    await assertAdmin({ supabase, userId: context.userId });
    const { data, error } = await supabase
      .from("radio_stations")
      .select("*")
      .order("sort", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminGetStation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { serverClient, assertAdmin, COVER_TTL } = await import("@/lib/radio.server");
    const supabase = serverClient();
    await assertAdmin({ supabase, userId: context.userId });
    const { data: st } = await supabase.from("radio_stations").select("*").eq("id", data.id).maybeSingle();
    const { data: tracks } = await supabase
      .from("radio_tracks")
      .select(
        "*, podcast_episodes(title, episode_url, image_url, published_at, feed_id, podcast_feeds(title, publisher))",
      )
      .eq("station_id", data.id)
      .order("sort", { ascending: true });
    let coverSigned: string | null = null;
    if (st?.cover_url) {
      const { data: s } = await supabase.storage.from("radio-covers").createSignedUrl(st.cover_url, COVER_TTL);
      coverSigned = s?.signedUrl ?? null;
    }
    return { station: st, tracks: tracks ?? [], coverSigned };
  });

export const adminUpsertStation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
        title: z.string().min(1).max(120),
        subtitle: z.string().max(200).nullable().optional(),
        cover_url: z.string().nullable().optional(),
        is_active: z.boolean().optional(),
        sort: z.number().int().optional(),
        playback_mode: z.enum(["ordered", "shuffle"]).optional(),
        loop_enabled: z.boolean().optional(),
        is_default: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { serverClient, assertAdmin } = await import("@/lib/radio.server");
    const supabase = serverClient();
    await assertAdmin({ supabase, userId: context.userId });
    // Enforce single active default: if setting is_default=true, clear others first.
    if (data.is_default === true) {
      await supabase
        .from("radio_stations")
        .update({ is_default: false })
        .neq("id", data.id ?? "00000000-0000-0000-0000-000000000000");
    }
    const payload = {
      slug: data.slug,
      title: data.title,
      subtitle: data.subtitle ?? null,
      cover_url: data.cover_url ?? null,
      is_active: data.is_active ?? true,
      sort: data.sort ?? 0,
      ...(data.playback_mode !== undefined ? { playback_mode: data.playback_mode } : {}),
      ...(data.loop_enabled !== undefined ? { loop_enabled: data.loop_enabled } : {}),
      ...(data.is_default !== undefined ? { is_default: data.is_default } : {}),
    };

    if (data.id) {
      const { data: row, error } = await supabase
        .from("radio_stations")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabase.from("radio_stations").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminDeleteStation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { serverClient, assertAdmin } = await import("@/lib/radio.server");
    const supabase = serverClient();
    await assertAdmin({ supabase, userId: context.userId });
    const { error } = await supabase.from("radio_stations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================
   Admin — tracks / items
   ============================================================ */

/** Generic track upsert. For uploads (backward-compat path). */
export const adminUpsertTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        station_id: z.string().uuid(),
        storage_key: z.string().min(1),
        title: z.string().min(1).max(200),
        artist: z.string().max(200).nullable().optional(),
        duration_s: z.number().int().nullable().optional(),
        sort: z.number().int().optional(),
        is_active: z.boolean().optional(),
        repeat_count: z.number().int().min(1).max(20).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { serverClient, assertAdmin } = await import("@/lib/radio.server");
    const supabase = serverClient();
    await assertAdmin({ supabase, userId: context.userId });
    const payload = {
      station_id: data.station_id,
      source_type: "upload" as const,
      storage_key: data.storage_key,
      external_url: null,
      podcast_episode_id: null,
      title: data.title,
      artist: data.artist ?? null,
      duration_s: data.duration_s ?? null,
      sort: data.sort ?? 0,
      is_active: data.is_active ?? true,
      repeat_count: data.repeat_count ?? 1,
    };
    if (data.id) {
      const { data: row, error } = await supabase
        .from("radio_tracks")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabase.from("radio_tracks").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Patch an existing item's display metadata (title/artist/repeat/active). Source is immutable. */
export const adminPatchTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        artist: z.string().max(200).nullable().optional(),
        is_active: z.boolean().optional(),
        repeat_count: z.number().int().min(1).max(20).optional(),
        sort: z.number().int().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { serverClient, assertAdmin } = await import("@/lib/radio.server");
    const supabase = serverClient();
    await assertAdmin({ supabase, userId: context.userId });
    const { id, ...patch } = data;
    const { data: row, error } = await supabase
      .from("radio_tracks")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Add a direct external audio URL item. */
export const adminAddExternalUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        station_id: z.string().uuid(),
        external_url: z.string().url(),
        title: z.string().min(1).max(200),
        artist: z.string().max(200).nullable().optional(),
        duration_s: z.number().int().min(0).max(60 * 60 * 24).nullable().optional(),
        repeat_count: z.number().int().min(1).max(20).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { serverClient, assertAdmin } = await import("@/lib/radio.server");
    const { isSafePublicHttpsUrl } = await import("@/lib/url-safety.server");
    const supabase = serverClient();
    await assertAdmin({ supabase, userId: context.userId });

    if (!(await isSafePublicHttpsUrl(data.external_url))) {
      throw new Error("URL must be HTTPS and cannot point to a private or local network.");
    }
    // Next sort at end of station
    const { data: lastRow } = await supabase
      .from("radio_tracks")
      .select("sort")
      .eq("station_id", data.station_id)
      .order("sort", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSort = (lastRow?.sort ?? -1) + 1;

    const { data: row, error } = await supabase
      .from("radio_tracks")
      .insert({
        station_id: data.station_id,
        source_type: "external_url",
        storage_key: null,
        external_url: data.external_url,
        podcast_episode_id: null,
        title: data.title,
        artist: data.artist ?? null,
        duration_s: data.duration_s ?? null,
        sort: nextSort,
        is_active: true,
        repeat_count: data.repeat_count ?? 1,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Bulk-add podcast episodes to a station. Returns added/alreadyPresent/unavailable counts. */
export const adminAddPodcastEpisodesToStation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        stationId: z.string().uuid(),
        episodeIds: z.array(z.string().uuid()).min(1).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { serverClient, assertAdmin } = await import("@/lib/radio.server");
    const supabase = serverClient();
    await assertAdmin({ supabase, userId: context.userId });

    // Validate station
    const { data: station } = await supabase
      .from("radio_stations")
      .select("id")
      .eq("id", data.stationId)
      .maybeSingle();
    if (!station) throw new Error("Station not found");

    // De-duplicate input
    const requested = Array.from(new Set(data.episodeIds));

    // Load episodes with their feed's radio_enabled state
    const { data: episodes } = await supabase
      .from("podcast_episodes")
      .select("id, title, duration_seconds, audio_url, feed_id, podcast_feeds!inner(radio_enabled, publisher, title)")
      .in("id", requested);
    const epMap = new Map<string, {
      id: string; title: string; duration_seconds: number | null; audio_url: string | null;
      publisher: string | null;
    }>();
    for (const ep of episodes ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const feed = (ep as any).podcast_feeds as { radio_enabled: boolean; publisher: string | null; title: string | null };
      if (!feed?.radio_enabled) continue;
      if (!ep.audio_url) continue;
      epMap.set(ep.id, {
        id: ep.id,
        title: ep.title,
        duration_seconds: ep.duration_seconds ?? null,
        audio_url: ep.audio_url,
        publisher: feed.publisher ?? feed.title ?? null,
      });
    }

    // Existing episode refs in the station
    const { data: existing } = await supabase
      .from("radio_tracks")
      .select("podcast_episode_id")
      .eq("station_id", data.stationId)
      .not("podcast_episode_id", "is", null);
    const existingSet = new Set(
      (existing ?? [])
        .map((r) => r.podcast_episode_id)
        .filter((v): v is string => typeof v === "string"),
    );

    // Compute next sort
    const { data: lastRow } = await supabase
      .from("radio_tracks")
      .select("sort")
      .eq("station_id", data.stationId)
      .order("sort", { ascending: false })
      .limit(1)
      .maybeSingle();
    let nextSort = (lastRow?.sort ?? -1) + 1;

    let alreadyPresent = 0;
    let unavailable = 0;
    const rows: Array<Record<string, unknown>> = [];
    for (const id of requested) {
      const ep = epMap.get(id);
      if (!ep) { unavailable += 1; continue; }
      if (existingSet.has(id)) { alreadyPresent += 1; continue; }
      rows.push({
        station_id: data.stationId,
        source_type: "podcast_episode",
        storage_key: null,
        external_url: null,
        podcast_episode_id: ep.id,
        title: ep.title,
        artist: ep.publisher,
        duration_s: ep.duration_seconds,
        sort: nextSort,
        is_active: true,
        repeat_count: 1,
      });
      nextSort += 1;
    }

    let added = 0;
    if (rows.length) {
      const { data: inserted, error } = await supabase.from("radio_tracks").insert(rows).select("id");
      if (error) throw new Error(error.message);
      added = inserted?.length ?? 0;
    }
    return { added, alreadyPresent, unavailable };
  });

/** Bulk reorder items in a station (drag-and-drop). */
export const adminReorderTracks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        stationId: z.string().uuid(),
        orderedIds: z.array(z.string().uuid()).min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { serverClient, assertAdmin } = await import("@/lib/radio.server");
    const supabase = serverClient();
    await assertAdmin({ supabase, userId: context.userId });
    // One update per row; small N in practice.
    let i = 0;
    for (const id of data.orderedIds) {
      const { error } = await supabase
        .from("radio_tracks")
        .update({ sort: i })
        .eq("id", id)
        .eq("station_id", data.stationId);
      if (error) throw new Error(error.message);
      i += 1;
    }
    return { ok: true, count: i };
  });

export const adminDeleteTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { serverClient, assertAdmin } = await import("@/lib/radio.server");
    const supabase = serverClient();
    await assertAdmin({ supabase, userId: context.userId });
    const { data: t } = await supabase
      .from("radio_tracks")
      .select("storage_key,source_type")
      .eq("id", data.id)
      .maybeSingle();
    if (t?.source_type === "upload" && t?.storage_key) {
      await supabase.storage.from("radio-tracks").remove([t.storage_key]);
    }
    const { error } = await supabase.from("radio_tracks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSignUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        bucket: z.enum(["radio-tracks", "radio-covers", "blog-covers"]),
        path: z.string().min(1).max(400),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { serverClient, assertAdmin } = await import("@/lib/radio.server");
    const supabase = serverClient();
    await assertAdmin({ supabase, userId: context.userId });
    const { data: signed, error } = await supabase.storage
      .from(data.bucket)
      .createSignedUploadUrl(data.path);
    if (error || !signed) throw new Error(error?.message ?? "Sign failed");
    return { url: signed.signedUrl, token: signed.token, path: signed.path };
  });

/* ============================================================
   Admin — podcast source management (Radio-scoped)
   ============================================================ */

export const adminListRadioFeeds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { serverClient, assertAdmin } = await import("@/lib/radio.server");
    const supabase = serverClient();
    await assertAdmin({ supabase, userId: context.userId });
    const { data, error } = await supabase
      .from("podcast_feeds")
      .select("id, title, publisher, image_url, rss_url, radio_enabled, is_active, last_synced_at, last_sync_error")
      .order("title", { ascending: true });
    if (error) throw new Error(error.message);

    // Attach episode counts and station-reference counts
    const ids = (data ?? []).map((f) => f.id);
    const counts = new Map<string, { episodes: number; referenced: number }>();
    if (ids.length) {
      const { data: eps } = await supabase
        .from("podcast_episodes")
        .select("id, feed_id")
        .in("feed_id", ids);
      for (const e of eps ?? []) {
        const c = counts.get(e.feed_id) ?? { episodes: 0, referenced: 0 };
        c.episodes += 1;
        counts.set(e.feed_id, c);
      }
      const episodeIds = (eps ?? []).map((e) => e.id);
      if (episodeIds.length) {
        const { data: refs } = await supabase
          .from("radio_tracks")
          .select("podcast_episode_id")
          .in("podcast_episode_id", episodeIds);
        const refSet = new Set((refs ?? []).map((r) => r.podcast_episode_id).filter(Boolean));
        for (const e of eps ?? []) {
          if (refSet.has(e.id)) {
            const c = counts.get(e.feed_id) ?? { episodes: 0, referenced: 0 };
            c.referenced += 1;
            counts.set(e.feed_id, c);
          }
        }
      }
    }
    return (data ?? []).map((f) => ({
      ...f,
      episode_count: counts.get(f.id)?.episodes ?? 0,
      referenced_count: counts.get(f.id)?.referenced ?? 0,
    }));
  });

export const adminAddPodcastFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ rssUrl: z.string().url() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { serverClient, assertAdmin } = await import("@/lib/radio.server");
    const { isSafePublicHttpsUrl } = await import("@/lib/url-safety.server");
    const { syncFeedById } = await import("@/lib/podcasts.server");
    const supabase = serverClient();
    await assertAdmin({ supabase, userId: context.userId });

    if (!(await isSafePublicHttpsUrl(data.rssUrl))) {
      throw new Error("RSS URL must be HTTPS and cannot point to a private or local network.");
    }
    // Look up existing feed
    const { data: existing } = await supabase
      .from("podcast_feeds")
      .select("id, radio_enabled")
      .eq("rss_url", data.rssUrl)
      .maybeSingle();

    let feedId: string;
    let alreadyExisted = false;
    if (existing) {
      feedId = existing.id;
      alreadyExisted = true;
      if (!existing.radio_enabled) {
        await supabase.from("podcast_feeds").update({ radio_enabled: true }).eq("id", feedId);
      }
    } else {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: created, error } = await supabaseAdmin
        .from("podcast_feeds")
        .insert({
          rss_url: data.rssUrl,
          is_active: false, // radio-only by default; don't leak into public library
          radio_enabled: true,
          title: null,
          publisher: null,
        })
        .select("id")
        .single();
      if (error || !created) throw new Error(error?.message ?? "Feed create failed");
      feedId = created.id;
    }
    const sync = await syncFeedById(feedId);
    return { feedId, alreadyExisted, ...sync };
  });

export const adminSyncFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ feedId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { serverClient, assertAdmin } = await import("@/lib/radio.server");
    const { syncFeedById } = await import("@/lib/podcasts.server");
    const supabase = serverClient();
    await assertAdmin({ supabase, userId: context.userId });
    return await syncFeedById(data.feedId);
  });

export const adminSetFeedRadioEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ feedId: z.string().uuid(), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { serverClient, assertAdmin } = await import("@/lib/radio.server");
    const supabase = serverClient();
    await assertAdmin({ supabase, userId: context.userId });
    const { error } = await supabase
      .from("podcast_feeds")
      .update({ radio_enabled: data.enabled })
      .eq("id", data.feedId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Soft-remove: turn off radio_enabled. If no station references the feed's episodes, delete. */
export const adminRemoveFeedSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ feedId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { serverClient, assertAdmin } = await import("@/lib/radio.server");
    const supabase = serverClient();
    await assertAdmin({ supabase, userId: context.userId });

    const { data: eps } = await supabase
      .from("podcast_episodes")
      .select("id")
      .eq("feed_id", data.feedId);
    const epIds = (eps ?? []).map((e) => e.id);
    let referenced = 0;
    if (epIds.length) {
      const { count } = await supabase
        .from("radio_tracks")
        .select("id", { count: "exact", head: true })
        .in("podcast_episode_id", epIds);
      referenced = count ?? 0;
    }
    if (referenced > 0) {
      await supabase.from("podcast_feeds").update({ radio_enabled: false }).eq("id", data.feedId);
      return { removed: false, referenced, message: "Kept — episodes are used by stations. Disabled as Radio source." };
    }
    // No references: safe to hard-delete
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("podcast_episodes").delete().eq("feed_id", data.feedId);
    await supabaseAdmin.from("podcast_feeds").delete().eq("id", data.feedId);
    return { removed: true, referenced: 0, message: "Feed removed." };
  });

/** Episodes list for the picker. */
export const adminListFeedEpisodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        feedId: z.string().uuid(),
        stationId: z.string().uuid().optional(),
        search: z.string().max(200).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { serverClient, assertAdmin } = await import("@/lib/radio.server");
    const supabase = serverClient();
    await assertAdmin({ supabase, userId: context.userId });

    let q = supabase
      .from("podcast_episodes")
      .select("id, title, published_at, duration_seconds, audio_url, episode_url, image_url")
      .eq("feed_id", data.feedId)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(data.limit);
    if (data.search) q = q.ilike("title", `%${data.search}%`);
    const { data: eps, error } = await q;
    if (error) throw new Error(error.message);

    let existing = new Set<string>();
    if (data.stationId) {
      const { data: refs } = await supabase
        .from("radio_tracks")
        .select("podcast_episode_id")
        .eq("station_id", data.stationId)
        .not("podcast_episode_id", "is", null);
      existing = new Set(
        (refs ?? [])
          .map((r) => r.podcast_episode_id)
          .filter((v): v is string => typeof v === "string"),
      );
    }
    return (eps ?? []).map((e) => ({
      ...e,
      in_station: existing.has(e.id),
    }));
  });
