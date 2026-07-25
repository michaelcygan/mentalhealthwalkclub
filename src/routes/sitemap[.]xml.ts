import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const BASE_URL = "https://mentalhealthwalkclub.com";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/groups", changefreq: "daily", priority: "0.9" },
          { path: "/blog", changefreq: "weekly", priority: "0.8" },
          { path: "/impact", changefreq: "monthly", priority: "0.5" },
          { path: "/support", changefreq: "monthly", priority: "0.5" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
        ];

        try {
          const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const supabase = createClient<Database>(process.env.SUPABASE_URL!, key, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: {
              fetch: (input, init) => {
                const h = new Headers(init?.headers);
                if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
                h.set("apikey", key);
                return fetch(input, { ...init, headers: h });
              },
            },
          });

          const { data: posts } = await supabase
            .from("blog_posts")
            .select("slug, updated_at, published_at")
            .eq("status", "published")
            .not("slug", "is", null);
          for (const p of posts ?? []) {
            if (!p.slug) continue;
            entries.push({
              path: `/blog/${p.slug}`,
              lastmod: (p.updated_at ?? p.published_at ?? undefined) as string | undefined,
              changefreq: "monthly",
              priority: "0.7",
            });
          }

          const { data: groups } = await supabase
            .from("groups")
            .select("slug, updated_at")
            .eq("is_public", true)
            .not("slug", "is", null);
          for (const g of groups ?? []) {
            if (!g.slug) continue;
            entries.push({
              path: `/g/${g.slug}`,
              lastmod: (g.updated_at ?? undefined) as string | undefined,
              changefreq: "weekly",
              priority: "0.6",
            });
          }
        } catch {
          // Fall through with static entries only.
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
