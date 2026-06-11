import { createFileRoute } from "@tanstack/react-router";
import { syncAllActiveBlogFeeds } from "@/lib/blogs.server";

/**
 * Cron-friendly endpoint to refresh all active blog feeds.
 * Authenticate via Supabase publishable key in `apikey` header.
 */
export const Route = createFileRoute("/api/public/hooks/sync-blog-feeds")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("apikey") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const result = await syncAllActiveBlogFeeds();
          return Response.json({ ...result, ok: true });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
