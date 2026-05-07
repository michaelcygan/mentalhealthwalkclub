import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const WEEK_MS = 7 * 86400_000;

// Send "welcome" to all members of a group who joined in the last 7 days.
// Idempotent within the same day per (sender, recipient, group) due to dedupe index.
export const sendGroupWelcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ groupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - WEEK_MS).toISOString();
    const { data: newcomers } = await supabase
      .from("group_memberships")
      .select("user_id,joined_at")
      .eq("group_id", data.groupId)
      .gte("joined_at", since);

    const recipients = (newcomers ?? [])
      .map((r) => r.user_id)
      .filter((id) => id && id !== userId);
    if (recipients.length === 0) return { sent: 0 };

    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from("group_signals")
      .select("recipient_user_id")
      .eq("sender_user_id", userId)
      .eq("group_id", data.groupId)
      .eq("kind", "welcome")
      .gte("created_at", today);
    const already = new Set((existing ?? []).map((x) => x.recipient_user_id));
    const fresh = recipients.filter((r) => !already.has(r));
    if (fresh.length === 0) return { sent: 0 };

    const rows = fresh.map((rid) => ({
      group_id: data.groupId,
      sender_user_id: userId,
      recipient_user_id: rid,
      kind: "welcome" as const,
    }));
    const { error } = await supabase.from("group_signals").insert(rows);
    if (error) throw new Error(error.message);
    return { sent: fresh.length };
  });

// Send kudos to a single recipient for a specific badge.
export const sendKudos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    groupId: z.string().uuid(),
    recipientUserId: z.string().uuid(),
    badgeId: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.recipientUserId === userId) return { sent: 0 };
    const { error } = await supabase
      .from("group_signals")
      .insert({
        group_id: data.groupId,
        sender_user_id: userId,
        recipient_user_id: data.recipientUserId,
        kind: "kudos",
        badge_id: data.badgeId,
      });
    // Unique index will reject same-day duplicates; treat as success.
    if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
    return { sent: 1 };
  });

// Aggregated milestones for a group: badges earned in last 14 days
// from walks tagged to this group. Returns anonymized rows + recipient_user_id
// (kept server-side for sending kudos; recipient identity never shown in UI).
export const getGroupMilestones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ groupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - 14 * 86400_000).toISOString();

    const { data: walks } = await supabase
      .from("walk_sessions")
      .select("id,user_id")
      .eq("group_id", data.groupId)
      .eq("status", "completed")
      .gte("started_at", since);

    const ids = (walks ?? []).map((w) => w.id);
    if (ids.length === 0) return { milestones: [] };

    const { data: badges } = await supabase
      .from("user_badges")
      .select("id,user_id,badge_id,earned_at,walk_session_id")
      .in("walk_session_id", ids)
      .order("earned_at", { ascending: false });

    const byBadge = new Map<string, { badgeId: string; recipients: { userId: string; awardId: string }[] }>();
    (badges ?? []).forEach((b) => {
      const v = byBadge.get(b.badge_id) ?? { badgeId: b.badge_id, recipients: [] };
      if (!v.recipients.find((r) => r.userId === b.user_id)) v.recipients.push({ userId: b.user_id, awardId: b.id });
      byBadge.set(b.badge_id, v);
    });

    const badgeIds = Array.from(byBadge.keys());
    if (badgeIds.length === 0) return { milestones: [] };
    const { data: defs } = await supabase
      .from("badge_definitions")
      .select("id,name,description,icon,key")
      .in("id", badgeIds);

    const milestones = (defs ?? []).map((d) => {
      const v = byBadge.get(d.id)!;
      return { badgeId: d.id, name: d.name, description: d.description, icon: d.icon, key: d.key, recipients: v.recipients };
    });
    return { milestones };
  });

// Inbox for current user — aggregated unread signals.
export const getInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: signals } = await supabase
      .from("group_signals")
      .select("id,group_id,kind,badge_id,created_at,read_at")
      .eq("recipient_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);

    const all = signals ?? [];
    const unread = all.filter((s) => !s.read_at);
    if (unread.length === 0) return { items: [], unread: 0 };

    const groupIds = [...new Set(all.map((s) => s.group_id))];
    const badgeIds = [...new Set(all.map((s) => s.badge_id).filter(Boolean) as string[])];
    const [{ data: groups }, { data: badges }] = await Promise.all([
      supabase.from("groups").select("id,name,slug").in("id", groupIds),
      badgeIds.length ? supabase.from("badge_definitions").select("id,name,icon").in("id", badgeIds) : Promise.resolve({ data: [] as { id: string; name: string; icon: string | null }[] }),
    ]);
    const gMap = new Map((groups ?? []).map((g) => [g.id, g]));
    const bMap = new Map((badges ?? []).map((b) => [b.id, b]));

    // Aggregate by (group, kind, badge)
    type Key = string;
    const agg = new Map<Key, { ids: string[]; group: typeof gMap extends Map<string, infer V> ? V : never; kind: string; badge?: { id: string; name: string; icon: string | null }; count: number; latest: string; unread: number }>();
    all.forEach((s) => {
      const g = gMap.get(s.group_id);
      if (!g) return;
      const key = `${s.group_id}:${s.kind}:${s.badge_id ?? ""}`;
      const cur = agg.get(key) ?? {
        ids: [],
        group: g,
        kind: s.kind,
        badge: s.badge_id ? bMap.get(s.badge_id) : undefined,
        count: 0,
        latest: s.created_at,
        unread: 0,
      };
      cur.ids.push(s.id);
      cur.count += 1;
      if (!s.read_at) cur.unread += 1;
      if (s.created_at > cur.latest) cur.latest = s.created_at;
      agg.set(key, cur);
    });

    const items = Array.from(agg.values())
      .filter((x) => x.unread > 0)
      .sort((a, b) => b.latest.localeCompare(a.latest));
    return { items, unread: unread.length };
  });

export const markInboxRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("group_signals")
      .update({ read_at: new Date().toISOString() })
      .in("id", data.ids)
      .eq("recipient_user_id", userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
