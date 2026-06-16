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

export interface ReaderArticle {
  id: string;
  title: string;
  byline: string | null;
  excerpt: string | null;
  content_html: string | null;
  hero_image: string | null;
  source_url: string;
  publisher: string | null;
  published_at: string | null;
}

const PostIdInput = z.object({ post_id: z.string().uuid() });

/** Public-safe: fetch the reader-view of a blog post, parsing on demand and caching. */
export const getReadableArticle = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => PostIdInput.parse(d))
  .handler(async ({ data }): Promise<ReaderArticle> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("blog_posts")
      .select(
        "id,title,summary,link,image_url,published_at,reader_html,reader_excerpt,reader_byline,reader_parsed_at,blog_feeds!inner(publisher)"
      )
      .eq("id", data.post_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Article not found");

    const feed = (row as unknown as { blog_feeds: { publisher: string | null } }).blog_feeds;
    const publisher = feed?.publisher ?? null;

    const parsedAt = row.reader_parsed_at as string | null;
    const stale =
      !parsedAt || Date.now() - Date.parse(parsedAt) > 30 * 24 * 60 * 60 * 1000;

    let contentHtml = (row.reader_html as string | null) ?? null;
    let excerpt = (row.reader_excerpt as string | null) ?? null;
    let byline = (row.reader_byline as string | null) ?? null;
    let hero = (row.image_url as string | null) ?? null;

    if (stale || !contentHtml) {
      try {
        const { parseReadable } = await import("./blogs.server");
        const parsed = await parseReadable(row.link as string);
        contentHtml = parsed.content_html ?? contentHtml;
        excerpt = parsed.excerpt ?? excerpt;
        byline = parsed.byline ?? byline;
        hero = parsed.hero_image ?? hero;
        // Persist for next time (only if we got real content)
        if (parsed.content_html) {
          await supabaseAdmin
            .from("blog_posts")
            .update({
              reader_html: parsed.content_html,
              reader_excerpt: parsed.excerpt,
              reader_byline: parsed.byline,
              reader_parsed_at: new Date().toISOString(),
              image_url: hero ?? row.image_url,
            })
            .eq("id", row.id);
        }
      } catch {
        // Soft fail — return what we have; the route shows an "Open original" CTA.
      }
    }

    return {
      id: row.id as string,
      title: (row.title as string) ?? "Untitled",
      byline,
      excerpt: excerpt ?? (row.summary as string | null) ?? null,
      content_html: contentHtml,
      hero_image: hero,
      source_url: row.link as string,
      publisher,
      published_at: (row.published_at as string | null) ?? null,
    };
  });
