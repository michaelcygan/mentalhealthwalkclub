import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Permanently delete the calling user's account and all owned data.
 * Relies on RLS cascade rules — most user-keyed tables either cascade on
 * auth.users delete or are scoped to the user via foreign key.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    if (!userId) throw new Error("Not signed in");

    // Best-effort cleanup of rows that don't have ON DELETE CASCADE on auth.users.
    // We swallow individual errors so a missing table never blocks deletion.
    const tables = [
      "walk_routes",
      "walk_photos",
      "walk_live_pings",
      "walk_sessions",
      "user_badges",
      "user_preferences",
      "goals",
      "blocks",
      "group_signals",
      "group_memberships",
      "event_rsvps",
      "facilitator_visits",
      "facilitator_sessions",
      "facilitator_profiles",
      "billing_events",
      "subscriptions",
      "user_roles",
      "profiles",
    ] as const;

    for (const t of tables) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabaseAdmin.from(t as never) as any).delete().eq("user_id", userId);
      } catch {
        /* ignore */
      }
    }
    // profiles uses id = auth.uid()
    try {
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
    } catch {
      /* ignore */
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
