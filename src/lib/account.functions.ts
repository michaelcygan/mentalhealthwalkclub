import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Permanently delete the calling user's account and all owned data.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    if (!userId) throw new Error("Not signed in");

    const tables = [
      "walk_photos",
      "walk_sessions",
      "user_badges",
      "user_preferences",
      "goals",
      "blocks",
      "event_rsvps",
      "billing_events",
      "subscriptions",
      "user_roles",
      "profiles",
    ] as const;

    for (const t of tables) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabaseAdmin.from(t as never) as any).delete().eq("user_id", userId);
      } catch { /* ignore */ }
    }
    try {
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
    } catch { /* ignore */ }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
