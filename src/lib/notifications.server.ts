import type { Database } from "@/integrations/supabase/types";

type Kind = Database["public"]["Enums"]["notification_kind"];

/** Server-only: fire-and-forget notification create. Never throws. */
export async function emitNotification(args: {
  userId: string;
  actorId: string | null;
  kind: Kind;
  title: string;
  body?: string;
  link?: string;
  entityId: string;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("create_notification", {
      _user_id: args.userId,
      _actor_id: args.actorId ?? args.userId, // dedup guard handles self-skip
      _kind: args.kind,
      _title: args.title.slice(0, 200),
      _body: (args.body ?? "").slice(0, 500),
      _link: args.link ?? "",
      _entity_id: args.entityId,
    });
  } catch (err) {
    console.error("[notifications] emit failed", err);
  }
}
