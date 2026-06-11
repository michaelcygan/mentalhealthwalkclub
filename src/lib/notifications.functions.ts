import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NotificationKind =
  | "friend_request"
  | "friend_accepted"
  | "high_five"
  | "walk_rsvp"
  | "walk_broadcast";

export interface NotificationRow {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  actor: { id: string; display_name: string | null; avatar_url: string | null } | null;
}

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } = {}) => ({ limit: Math.min(Math.max(d.limit ?? 20, 1), 50) }))
  .handler(async ({ data, context }): Promise<{ items: NotificationRow[] }> => {
    const { supabase } = context;
    const { data: rows } = await supabase
      .from("notifications")
      .select("id,kind,title,body,link,read_at,created_at,actor_id")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    const actorIds = Array.from(new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean) as string[]));
    const profMap = new Map<string, { id: string; display_name: string | null; avatar_url: string | null }>();
    if (actorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,display_name,avatar_url")
        .in("id", actorIds);
      for (const p of profs ?? []) profMap.set(p.id, p);
    }
    return {
      items: (rows ?? []).map((r) => ({
        id: r.id,
        kind: r.kind as NotificationKind,
        title: r.title,
        body: r.body,
        link: r.link,
        read_at: r.read_at,
        created_at: r.created_at,
        actor: r.actor_id ? profMap.get(r.actor_id) ?? { id: r.actor_id, display_name: null, avatar_url: null } : null,
      })),
    };
  });

export const getUnreadNotificationCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ count: number }> => {
    const { count } = await context.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    return { count: count ?? 0 };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids?: string[]; all?: boolean }) => {
    const schema = z.object({
      ids: z.array(z.string().uuid()).max(50).optional(),
      all: z.boolean().optional(),
    });
    return schema.parse(d);
  })
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    let q = context.supabase.from("notifications").update({ read_at: now }).is("read_at", null);
    if (data.all) {
      // no filter — RLS scopes to caller
    } else if (data.ids?.length) {
      q = context.supabase.from("notifications").update({ read_at: now }).in("id", data.ids);
    } else {
      return { ok: true };
    }
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("notifications").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Called by client after a successful "going" RSVP — notifies the host. */
export const notifyHostOfRsvp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { eventId: string }) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify the caller actually has a "going" RSVP (RLS-scoped).
    const { data: rsvp } = await supabase
      .from("event_rsvps")
      .select("status")
      .eq("event_id", data.eventId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!rsvp || rsvp.status !== "going") return { ok: true, skipped: true as const };

    const { data: ev } = await supabase
      .from("events")
      .select("host_user_id,title,slug")
      .eq("id", data.eventId)
      .maybeSingle();
    if (!ev || !ev.host_user_id || ev.host_user_id === userId) return { ok: true, skipped: true as const };

    const { data: me } = await supabase
      .from("profiles")
      .select("display_name,username")
      .eq("id", userId)
      .maybeSingle();
    const who = me?.display_name ?? me?.username ?? "Someone";
    const title = `${who} is coming to "${ev.title ?? "your walk"}"`;
    const link = ev.slug ? `/w/${ev.slug}` : null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("create_notification", {
      _user_id: ev.host_user_id,
      _actor_id: userId,
      _kind: "walk_rsvp",
      _title: title,
      _body: null,
      _link: link,
      _entity_id: data.eventId,
    });
    return { ok: true };
  });
