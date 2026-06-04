import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CodeInput = z.object({ code: z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/) });

export const getWalkByCode = createServerFn({ method: "GET" })
  .inputValidator((d) => CodeInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: event, error } = await supabaseAdmin
      .from("events")
      .select(
        "id,slug,title,description,starts_at,ends_at,timezone,venue_name,address,city,region,state,country,lat,lng,vibe,visibility,host_user_id,attendee_count,image_url,meeting_point,accessibility_notes,event_type"
      )
      .eq("slug", data.code)
      .eq("visibility", "public")
      .eq("status", "published")
      .maybeSingle();

    if (error) {
      console.error("getWalkByCode error", error);
      return { event: null as null | NonNullable<typeof event>, host: null };
    }
    if (!event) return { event: null, host: null };

    let host: { display_name: string | null; avatar_url: string | null } | null = null;
    if (event.host_user_id) {
      const { data: hostRow } = await supabaseAdmin
        .from("profiles")
        .select("display_name,avatar_url")
        .eq("id", event.host_user_id)
        .maybeSingle();
      host = hostRow ?? null;
    }

    return { event, host };
  });

const EventIdInput = z.object({ eventId: z.string().uuid() });

export type EventPhoto = {
  id: string;
  url: string;
  caption: string | null;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export const getEventPhotos = createServerFn({ method: "GET" })
  .inputValidator((d) => EventIdInput.parse(d))
  .handler(async ({ data }): Promise<{ photos: EventPhoto[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("event_photos")
      .select("id,storage_path,caption,user_id,created_at")
      .eq("event_id", data.eventId)
      .order("created_at", { ascending: false })
      .limit(40);

    if (error || !rows?.length) return { photos: [] };

    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id,display_name,avatar_url")
      .in("id", userIds);
    const pmap = new Map((profs ?? []).map((p) => [p.id, p]));

    const photos: EventPhoto[] = [];
    for (const r of rows) {
      const { data: signed } = await supabaseAdmin.storage
        .from("event-photos")
        .createSignedUrl(r.storage_path, 60 * 60);
      if (!signed?.signedUrl) continue;
      const p = pmap.get(r.user_id);
      photos.push({
        id: r.id,
        url: signed.signedUrl,
        caption: r.caption,
        user_id: r.user_id,
        display_name: p?.display_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        created_at: r.created_at,
      });
    }
    return { photos };
  });

const AddPhotoInput = z.object({
  eventId: z.string().uuid(),
  storagePath: z.string().min(1).max(500),
  caption: z.string().max(280).optional().nullable(),
  width: z.number().int().positive().max(20000).optional().nullable(),
  height: z.number().int().positive().max(20000).optional().nullable(),
  bytes: z.number().int().positive().max(50_000_000).optional().nullable(),
});

export const addEventPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AddPhotoInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.storagePath.startsWith(`${userId}/`)) {
      throw new Error("Invalid storage path");
    }
    const { data: row, error } = await supabase
      .from("event_photos")
      .insert({
        event_id: data.eventId,
        user_id: userId,
        storage_path: data.storagePath,
        caption: data.caption ?? null,
        width: data.width ?? null,
        height: data.height ?? null,
        bytes: data.bytes ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

const DeletePhotoInput = z.object({ id: z.string().uuid() });

export const deleteEventPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => DeletePhotoInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("event_photos")
      .select("storage_path,user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row || row.user_id !== userId) throw new Error("Not allowed");
    await supabase.storage.from("event-photos").remove([row.storage_path]);
    const { error } = await supabase.from("event_photos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
