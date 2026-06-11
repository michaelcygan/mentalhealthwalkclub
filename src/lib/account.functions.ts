import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Permanently delete the calling user's account and all owned data.
 * Per-table deletes run in parallel; failures are surfaced rather than swallowed.
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
    ] as const;

    const results = await Promise.allSettled(
      tables.map((t) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabaseAdmin.from(t as never) as any).delete().eq("user_id", userId),
      ),
    );
    const failures = results
      .map((r, i) => ({ r, t: tables[i] }))
      .filter(({ r }) => r.status === "rejected" || (r.status === "fulfilled" && (r.value as { error?: unknown })?.error));
    if (failures.length) {
      console.error("deleteMyAccount table failures", failures.map((f) => f.t));
    }

    // Profile uses `id` not `user_id`.
    const { error: profErr } = await supabaseAdmin.from("profiles").delete().eq("id", userId);
    if (profErr) console.error("deleteMyAccount profiles failed", profErr.message);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
