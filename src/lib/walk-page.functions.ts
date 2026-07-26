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
        "id,slug,title,description,starts_at,ends_at,timezone,venue_name,address,city,lat,lng,vibe,visibility,host_user_id,attendee_count,image_url,cover_override_url,meeting_point,accessibility_notes,event_type,place_id,group_id,circle_id,pace,distance_meters,dog_friendly,kid_friendly"
      )
      .eq("slug", data.code)
      .in("visibility", ["public", "group", "link_only"])
      .eq("status", "published")
      .maybeSingle();

    if (error) {
      console.error("getWalkByCode error", error);
      return { event: null as null | NonNullable<typeof event>, host: null, place: null, group: null, circle: null };
    }
    if (!event) return { event: null, host: null, place: null, group: null, circle: null };

    let host: { display_name: string | null; avatar_url: string | null; username: string | null } | null = null;
    if (event.host_user_id) {
      const { data: hostRow } = await supabaseAdmin
        .from("profiles")
        .select("display_name,avatar_url,username")
        .eq("id", event.host_user_id)
        .maybeSingle();
      host = hostRow ?? null;
    }

    let place: { id: string; name: string; hero_url: string | null; hero_attribution: string | null; blurb: string | null; blurb_source: string | null; category: string | null } | null = null;
    if (event.place_id) {
      const { data: p } = await supabaseAdmin
        .from("places")
        .select("id,name,hero_url,hero_attribution,blurb,blurb_source,category")
        .eq("id", event.place_id)
        .maybeSingle();
      place = p ?? null;
    }

    let group: { id: string; name: string; slug: string } | null = null;
    if (event.group_id) {
      const { data: g } = await supabaseAdmin
        .from("groups")
        .select("id,name,slug")
        .eq("id", event.group_id)
        .maybeSingle();
      group = g ?? null;
    }

    let circle: { id: string; name: string; color: string | null } | null = null;
    if (event.circle_id) {
      const { data: c } = await supabaseAdmin
        .from("circles")
        .select("id,name,color")
        .eq("id", event.circle_id)
        .maybeSingle();
      circle = c ?? null;
    }

    return { event, host, place, group, circle };
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
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => EventIdInput.parse(d))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ photos: EventPhoto[]; access: "member" | "gated"; photoCount: number }> => {
      const { supabase, userId } = context;

      // Verify caller is a walker on this event before signing photo URLs.
      // Photos are private to people who actually joined — public/link_only
      // visibility of the walk page itself does NOT grant photo access.
      const { data: ev } = await supabase
        .from("events")
        .select("id,host_user_id,group_id")
        .eq("id", data.eventId)
        .maybeSingle();
      if (!ev) return { photos: [], access: "gated", photoCount: 0 };

      let allowed = ev.host_user_id === userId;
      if (!allowed && ev.group_id) {
        const { data: m } = await supabase
          .from("group_memberships")
          .select("user_id")
          .eq("group_id", ev.group_id)
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle();
        if (m) allowed = true;
      }
      if (!allowed) {
        const { data: r } = await supabase
          .from("event_rsvps")
          .select("user_id")
          .eq("event_id", ev.id)
          .eq("user_id", userId)
          .maybeSingle();
        if (r) allowed = true;
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      if (!allowed) {
        // Return a count only, so the gated card can hint at activity without
        // leaking any image URLs.
        const { count } = await supabaseAdmin
          .from("event_photos")
          .select("id", { count: "exact", head: true })
          .eq("event_id", data.eventId);
        return { photos: [], access: "gated", photoCount: count ?? 0 };
      }

      const { data: rows, error } = await supabaseAdmin
        .from("event_photos")
        .select("id,storage_path,caption,user_id,created_at")
        .eq("event_id", data.eventId)
        .order("created_at", { ascending: false })
        .limit(40);

      if (error || !rows?.length) return { photos: [], access: "member", photoCount: 0 };

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
      return { photos, access: "member", photoCount: photos.length };
    },
  );

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

/* ---------- recap ---------- */

export const getWalkRecap = createServerFn({ method: "GET" })
  .inputValidator((d) => CodeInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ev } = await supabaseAdmin
      .from("events")
      .select(
        "id,slug,title,starts_at,ends_at,city,vibe,image_url,host_user_id,attendee_count,lat,lng,distance_meters,place_id"
      )
      .eq("slug", data.code)
      .in("visibility", ["public", "link_only", "group"])
      .eq("status", "published")
      .maybeSingle();
    if (!ev) return { event: null, attendees: [], guests: 0, host: null };

    const { data: rsvps } = await supabaseAdmin
      .from("event_rsvps")
      .select("user_id")
      .eq("event_id", ev.id)
      .eq("status", "going");

    const userIds = (rsvps ?? []).map((r) => r.user_id);
    const { data: profs } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id,display_name,avatar_url").in("id", userIds)
      : { data: [] as Array<{ id: string; display_name: string | null; avatar_url: string | null }> };

    const { count: guestCount } = await supabaseAdmin
      .from("event_rsvp_guests")
      .select("id", { count: "exact", head: true })
      .eq("event_id", ev.id)
      .eq("status", "going");

    let host: { display_name: string | null; avatar_url: string | null } | null = null;
    if (ev.host_user_id) {
      const { data: h } = await supabaseAdmin
        .from("profiles")
        .select("display_name,avatar_url")
        .eq("id", ev.host_user_id)
        .maybeSingle();
      host = h ?? null;
    }

    return {
      event: ev,
      attendees: (profs ?? []) as Array<{ id: string; display_name: string | null; avatar_url: string | null }>,
      guests: guestCount ?? 0,
      host,
    };
  });

