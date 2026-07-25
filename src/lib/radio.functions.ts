import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface StationCard {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  cover_url: string | null;
  cover_signed: string | null;
  sort: number;
}

export interface StationTrack {
  id: string;
  title: string;
  artist: string | null;
  duration_s: number | null;
  sort: number;
}

const COVER_TTL = 60 * 60 * 24; // 1 day
const TRACK_TTL = 60 * 60 * 2; // 2 hours (session-length)

function serverClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

async function signCover(supabase: ReturnType<typeof serverClient>, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("radio-covers").createSignedUrl(path, COVER_TTL);
  return data?.signedUrl ?? null;
}

export const listStations = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = serverClient();
  const { data, error } = await supabase
    .from("radio_stations")
    .select("id,slug,title,subtitle,cover_url,sort")
    .eq("is_active", true)
    .order("sort", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const stations: StationCard[] = await Promise.all(
    rows.map(async (s) => ({
      ...s,
      cover_signed: await signCover(supabase, s.cover_url),
    })),
  );
  return stations;
});

export const getStation = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: st, error } = await supabase
      .from("radio_stations")
      .select("id,slug,title,subtitle,cover_url,sort")
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!st) return null;
    const { data: tracks } = await supabase
      .from("radio_tracks")
      .select("id,title,artist,duration_s,sort")
      .eq("station_id", st.id)
      .eq("is_active", true)
      .order("sort", { ascending: true });
    return {
      station: { ...st, cover_signed: await signCover(supabase, st.cover_url) } as StationCard,
      tracks: (tracks ?? []) as StationTrack[],
    };
  });

export const signTrackUrl = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ trackId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: track, error } = await supabase
      .from("radio_tracks")
      .select("storage_key,is_active")
      .eq("id", data.trackId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!track || !track.is_active) throw new Error("Track not found");
    const { data: signed, error: sErr } = await supabase.storage
      .from("radio-tracks")
      .createSignedUrl(track.storage_key, TRACK_TTL);
    if (sErr || !signed) throw new Error(sErr?.message ?? "Sign failed");
    return { url: signed.signedUrl };
  });

// --- Admin --------------------------------------------------------------

async function assertAdmin(context: { supabase: ReturnType<typeof serverClient>; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

export const adminListStations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
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
    await assertAdmin(context);
    const { data: st } = await context.supabase.from("radio_stations").select("*").eq("id", data.id).maybeSingle();
    const { data: tracks } = await context.supabase
      .from("radio_tracks")
      .select("*")
      .eq("station_id", data.id)
      .order("sort", { ascending: true });
    let coverSigned: string | null = null;
    if (st?.cover_url) {
      const { data: s } = await context.supabase.storage.from("radio-covers").createSignedUrl(st.cover_url, COVER_TTL);
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
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload = {
      slug: data.slug,
      title: data.title,
      subtitle: data.subtitle ?? null,
      cover_url: data.cover_url ?? null,
      is_active: data.is_active ?? true,
      sort: data.sort ?? 0,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("radio_stations")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase.from("radio_stations").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminDeleteStation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("radio_stations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

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
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload = {
      station_id: data.station_id,
      storage_key: data.storage_key,
      title: data.title,
      artist: data.artist ?? null,
      duration_s: data.duration_s ?? null,
      sort: data.sort ?? 0,
      is_active: data.is_active ?? true,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("radio_tracks")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase.from("radio_tracks").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminDeleteTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: t } = await context.supabase.from("radio_tracks").select("storage_key").eq("id", data.id).maybeSingle();
    if (t?.storage_key) {
      await context.supabase.storage.from("radio-tracks").remove([t.storage_key]);
    }
    const { error } = await context.supabase.from("radio_tracks").delete().eq("id", data.id);
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
    await assertAdmin(context);
    const { data: signed, error } = await context.supabase.storage
      .from(data.bucket)
      .createSignedUploadUrl(data.path);
    if (error || !signed) throw new Error(error?.message ?? "Sign failed");
    return { url: signed.signedUrl, token: signed.token, path: signed.path };
  });
