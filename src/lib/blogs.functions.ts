import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LimitInput = z.object({ limit: z.number().int().min(1).max(24).default(6) });

export interface BlogPostCard {
  id: string;
  title: string;
  summary: string | null;
  link: string;
  image_url: string | null;
  publisher: string | null;
  published_at: string | null;
}

/** Public-safe: recent blog posts across active feeds. */
export const recentBlogPosts = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => LimitInput.parse(d ?? {}))
  .handler(async ({ data }): Promise<BlogPostCard[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("blog_posts")
      .select("id,title,summary,link,image_url,published_at,feed_id,blog_feeds!inner(publisher,is_active)")
      .eq("blog_feeds.is_active", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(data.limit);
    return (rows ?? []).map((r) => {
      const feed = (r as unknown as { blog_feeds: { publisher: string | null } }).blog_feeds;
      return {
        id: r.id as string,
        title: r.title as string,
        summary: (r.summary as string | null) ?? null,
        link: r.link as string,
        image_url: (r.image_url as string | null) ?? null,
        publisher: feed?.publisher ?? null,
        published_at: (r.published_at as string | null) ?? null,
      };
    });
  });

// `syncBlogFeedsNow` removed — orphan endpoint with no auth. Admin path lives in
// `blog-feeds.functions.ts` (`syncBlogFeedsAdmin`); cron path lives in
// `routes/api/public/hooks/sync-blog-feeds.ts` with apikey-header auth.
