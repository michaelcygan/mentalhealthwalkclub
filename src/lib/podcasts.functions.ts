import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncFeedById } from "./podcasts.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Response("Forbidden", { status: 403 });
}

/** Admin: trigger RSS sync for one feed. */
export const syncPodcastFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { feedId: string }) => z.object({ feedId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return syncFeedById(data.feedId);
  });

/** Admin: create a new feed (then immediately sync to populate metadata). */
export const createPodcastFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      rss_url: z.string().url().max(500),
      title: z.string().min(1).max(200),
      publisher: z.string().max(200).optional(),
      category: z.enum(["calm_down", "think_clearly", "feel_connected", "walk_with_hope", "body_brain", "relationships"]),
      credibility: z.enum(["institutional", "academic", "public_media", "science", "lifestyle"]).default("lifestyle"),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("podcast_feeds")
      .insert({
        rss_url: data.rss_url,
        title: data.title,
        publisher: data.publisher,
        category: data.category,
        credibility: data.credibility,
        is_active: false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    try { await syncFeedById(row.id); } catch { /* surface via last_sync_error */ }
    return { id: row.id };
  });
