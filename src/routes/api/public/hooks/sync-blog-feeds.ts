import { createFileRoute } from "@tanstack/react-router";
import { syncAllActiveBlogFeeds } from "@/lib/blogs.server";

export const Route = createFileRoute("/api/public/hooks/sync-blog-feeds")({
  server: {
    handlers: {
      POST: async () => {
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
