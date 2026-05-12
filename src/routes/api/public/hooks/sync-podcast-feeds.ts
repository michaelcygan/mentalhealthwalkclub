import { createFileRoute } from "@tanstack/react-router";
import { syncAllActiveFeeds } from "@/lib/podcasts.server";

/**
 * Cron-friendly endpoint to refresh all active podcast feeds.
 * Authenticate via Supabase anon key in `apikey` header (per platform pattern).
 */
export const Route = createFileRoute("/api/public/hooks/sync-podcast-feeds")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await syncAllActiveFeeds();
          return Response.json({ ...result, ok: true });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
