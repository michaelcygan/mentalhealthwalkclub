import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { reshufflePodsImpl } from "@/server/audio.functions";

export const Route = createFileRoute("/api/public/hooks/rotate-pods")({
  server: {
    handlers: {
      POST: async () => {
        const { data: events } = await supabaseAdmin
          .from("events")
          .select("id,breakout_rotate_minutes,last_pod_rotation_at,starts_at,ends_at,audio_room_id")
          .eq("event_type", "audio_walk")
          .eq("status", "published")
          .not("breakout_rotate_minutes", "is", null)
          .not("audio_room_id", "is", null);

        const now = Date.now();
        let rotated = 0;
        for (const ev of events ?? []) {
          const startMs = new Date(ev.starts_at).getTime();
          const endMs = ev.ends_at ? new Date(ev.ends_at).getTime() : startMs + 60 * 60_000;
          if (now < startMs || now > endMs) continue;
          const last = ev.last_pod_rotation_at ? new Date(ev.last_pod_rotation_at).getTime() : startMs;
          const intervalMs = (ev.breakout_rotate_minutes ?? 10) * 60_000;
          if (now - last < intervalMs) continue;
          try {
            const r = await reshufflePodsImpl(supabaseAdmin, ev.id);
            if (r.rotated > 0) rotated++;
          } catch (e) {
            console.error("rotate-pods failed for", ev.id, e);
          }
        }
        return Response.json({ ok: true, scanned: events?.length ?? 0, rotated });
      },
    },
  },
});
