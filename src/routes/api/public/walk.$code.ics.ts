import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CodeSchema = z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/);

function fmt(iso: string): string {
  // → YYYYMMDDTHHMMSSZ
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export const Route = createFileRoute("/api/public/walk/$code/ics")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const code = CodeSchema.safeParse(params.code);
        if (!code.success) return new Response("bad code", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: ev } = await supabaseAdmin
          .from("events")
          .select("id,title,description,starts_at,ends_at,venue_name,address,city,lat,lng,meeting_point")
          .eq("slug", code.data)
          .in("visibility", ["public", "link_only", "group"])
          .eq("status", "published")
          .maybeSingle();
        if (!ev) return new Response("not found", { status: 404 });

        const url = new URL(request.url);
        const link = `${url.origin}/w/${code.data}`;
        const endsAt = ev.ends_at ?? new Date(new Date(ev.starts_at).getTime() + 60 * 60 * 1000).toISOString();
        const location = [ev.venue_name, ev.address, ev.city].filter(Boolean).join(", ");
        const description = [ev.description, ev.meeting_point ? `Meet: ${ev.meeting_point}` : null, link]
          .filter(Boolean)
          .join("\n\n");

        const lines = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//Mental Health Walk Club//Walk//EN",
          "CALSCALE:GREGORIAN",
          "METHOD:PUBLISH",
          "BEGIN:VEVENT",
          `UID:walk-${ev.id}@mentalhealthwalkclub`,
          `DTSTAMP:${fmt(new Date().toISOString())}`,
          `DTSTART:${fmt(ev.starts_at)}`,
          `DTEND:${fmt(endsAt)}`,
          `SUMMARY:${escapeIcs(ev.title)}`,
          location ? `LOCATION:${escapeIcs(location)}` : null,
          `DESCRIPTION:${escapeIcs(description)}`,
          `URL:${link}`,
          ev.lat && ev.lng ? `GEO:${ev.lat};${ev.lng}` : null,
          "END:VEVENT",
          "END:VCALENDAR",
        ].filter(Boolean) as string[];

        return new Response(lines.join("\r\n"), {
          status: 200,
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": `attachment; filename="walk-${code.data}.ics"`,
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
