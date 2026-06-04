import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CodeInput = z.object({ code: z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/) });

export const getWalkByCode = createServerFn({ method: "GET" })
  .inputValidator((d) => CodeInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: event, error } = await supabaseAdmin
      .from("events")
      .select(
        "id,slug,title,description,starts_at,ends_at,timezone,venue_name,address,city,region,state,country,lat,lng,vibe,visibility,host_user_id,attendee_count,image_url,meeting_point,accessibility_notes,event_type"
      )
      .eq("slug", data.code)
      .eq("visibility", "public")
      .eq("status", "published")
      .maybeSingle();

    if (error) {
      console.error("getWalkByCode error", error);
      return { event: null as null | NonNullable<typeof event>, host: null };
    }
    if (!event) return { event: null, host: null };

    let host: { display_name: string | null; avatar_url: string | null } | null = null;
    if (event.host_user_id) {
      const { data: hostRow } = await supabaseAdmin
        .from("profiles")
        .select("display_name,avatar_url")
        .eq("id", event.host_user_id)
        .maybeSingle();
      host = hostRow ?? null;
    }

    return { event, host };
  });
