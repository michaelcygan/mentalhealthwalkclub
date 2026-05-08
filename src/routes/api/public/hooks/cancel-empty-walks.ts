import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Cancel seed walks 10min before start if no real RSVPs.
// Hosts never RSVP themselves, so attendee_count > 0 means a real user is going.
export const Route = createFileRoute("/api/public/hooks/cancel-empty-walks")({
  server: {
    handlers: {
      POST: async () => {
        const cutoffSoon = new Date(Date.now() + 10 * 60_000).toISOString();
        const cutoffNow = new Date().toISOString();

        const { data: candidates } = await supabaseAdmin
          .from("events")
          .select("id,slug,attendee_count,starts_at")
          .eq("is_seed", true)
          .eq("status", "published")
          .gte("starts_at", cutoffNow)
          .lte("starts_at", cutoffSoon);

        let cancelled = 0;
        for (const ev of candidates ?? []) {
          if ((ev.attendee_count ?? 0) === 0) {
            const { error } = await supabaseAdmin
              .from("events")
              .update({ status: "cancelled" })
              .eq("id", ev.id);
            if (!error) cancelled++;
          }
        }

        return Response.json({
          ok: true,
          scanned: candidates?.length ?? 0,
          cancelled,
        });
      },
    },
  },
});
