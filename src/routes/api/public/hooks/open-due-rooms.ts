import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { openScheduledRoomImpl } from "@/server/audio.functions";

export const Route = createFileRoute("/api/public/hooks/open-due-rooms")({
  server: {
    handlers: {
      POST: async () => {
        const nowIso = new Date(Date.now() + 60_000).toISOString(); // open up to 1 min ahead
        const { data: events } = await supabaseAdmin
          .from("events")
          .select("id,audio_room_id,starts_at")
          .eq("event_type", "audio_walk")
          .eq("status", "published")
          .not("audio_room_id", "is", null)
          .lte("starts_at", nowIso);

        let opened = 0;
        for (const ev of events ?? []) {
          try {
            const r = await openScheduledRoomImpl(supabaseAdmin, ev.id);
            if (!r.alreadyOpen) opened++;
          } catch (e) {
            console.error("open-due-rooms failed for", ev.id, e);
          }
        }
        return Response.json({ ok: true, scanned: events?.length ?? 0, opened });
      },
    },
  },
});
