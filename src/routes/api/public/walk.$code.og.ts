import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CodeSchema = z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/);

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrap(text: string, max: number, lines: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      out.push(cur.trim());
      cur = w;
      if (out.length >= lines - 1) break;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) out.push(cur.length > max ? cur.slice(0, max - 1) + "…" : cur);
  return out.slice(0, lines);
}

export const Route = createFileRoute("/api/public/walk/$code/og")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const code = CodeSchema.safeParse(params.code);
        if (!code.success) return new Response("bad code", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: ev } = await supabaseAdmin
          .from("events")
          .select("title,city,starts_at,vibe,attendee_count")
          .eq("slug", code.data)
          .in("visibility", ["public", "link_only", "group"])
          .eq("status", "published")
          .maybeSingle();

        const title = ev?.title ?? "A walk";
        const city = ev?.city ?? "";
        const vibe = ev?.vibe ?? "quiet walk";
        const when = ev?.starts_at
          ? new Date(ev.starts_at).toLocaleString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })
          : "";
        const count = ev?.attendee_count ?? 0;
        const titleLines = wrap(title, 26, 2);

        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f5f1e8"/>
      <stop offset="0.5" stop-color="#e8d9c0"/>
      <stop offset="1" stop-color="#c4b08a"/>
    </linearGradient>
    <linearGradient id="hills" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4a6741" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#2d4a2b" stop-opacity="0.95"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="980" cy="160" r="70" fill="#fef6dd" opacity="0.85"/>
  <path d="M0 470 Q 200 360 400 420 T 800 410 T 1200 440 L 1200 630 L 0 630 Z" fill="url(#hills)"/>
  <path d="M0 540 Q 250 470 500 510 T 1000 500 T 1200 520 L 1200 630 L 0 630 Z" fill="#1f3520" opacity="0.85"/>

  <text x="80" y="100" font-family="Georgia, serif" font-size="22" fill="#3a3a3a" letter-spacing="3" font-weight="600">MENTAL HEALTH WALK CLUB</text>

  ${titleLines
    .map(
      (line, i) =>
        `<text x="80" y="${230 + i * 78}" font-family="Georgia, serif" font-size="72" fill="#1b1b1b" font-weight="500">${esc(line)}</text>`
    )
    .join("\n  ")}

  <text x="80" y="${230 + titleLines.length * 78 + 30}" font-family="Inter, sans-serif" font-size="28" fill="#4a4a4a">${esc([when, city].filter(Boolean).join(" · "))}</text>
  <text x="80" y="${230 + titleLines.length * 78 + 72}" font-family="Inter, sans-serif" font-size="22" fill="#5b5b5b" font-style="italic">${esc(vibe)}</text>

  <g transform="translate(80 570)">
    <rect x="0" y="0" rx="22" ry="22" width="${count > 0 ? 280 : 200}" height="44" fill="#1b3520" />
    <text x="22" y="29" font-family="Inter, sans-serif" font-size="18" fill="#f5f1e8" font-weight="600">${count > 0 ? `${count} walker${count === 1 ? "" : "s"} going · RSVP` : "RSVP to join"}</text>
  </g>
</svg>`;

        return new Response(svg, {
          status: 200,
          headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "public, max-age=300, s-maxage=600",
          },
        });
      },
    },
  },
});
