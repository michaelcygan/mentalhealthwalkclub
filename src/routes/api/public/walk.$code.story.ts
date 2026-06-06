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

/**
 * IG Story share card — 1080x1920 templated SVG. Pure layout, no AI imagery.
 */
export const Route = createFileRoute("/api/public/walk/$code/story")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const code = CodeSchema.safeParse(params.code);
        if (!code.success) return new Response("bad code", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: ev } = await supabaseAdmin
          .from("events")
          .select("title,city,venue_name,starts_at,vibe,attendee_count,meeting_point")
          .eq("slug", code.data)
          .in("visibility", ["public", "link_only", "group"])
          .eq("status", "published")
          .maybeSingle();

        const title = ev?.title ?? "A walk";
        const where = [ev?.venue_name, ev?.city].filter(Boolean).join(" · ") || "Somewhere outside";
        const vibe = ev?.vibe ?? "quiet walk";
        const when = ev?.starts_at
          ? new Date(ev.starts_at).toLocaleString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })
          : "";
        const count = ev?.attendee_count ?? 0;
        const meet = ev?.meeting_point ?? "";

        const titleLines = wrap(title, 18, 3);
        const titleBaseY = 720;
        const titleLineHeight = 124;

        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f5f1e8"/>
      <stop offset="0.55" stop-color="#e8d9c0"/>
      <stop offset="1" stop-color="#c4b08a"/>
    </linearGradient>
    <linearGradient id="hillsA" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4a6741" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#2d4a2b"/>
    </linearGradient>
    <linearGradient id="hillsB" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1f3520" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#102010"/>
    </linearGradient>
    <pattern id="grain" x="0" y="0" width="3" height="3" patternUnits="userSpaceOnUse">
      <rect width="3" height="3" fill="transparent"/>
      <circle cx="1" cy="1" r="0.4" fill="#000" opacity="0.04"/>
    </pattern>
  </defs>

  <rect width="1080" height="1920" fill="url(#bg)"/>

  <!-- Sun -->
  <circle cx="820" cy="320" r="120" fill="#fef0c2" opacity="0.85"/>
  <circle cx="820" cy="320" r="160" fill="#fef0c2" opacity="0.18"/>

  <!-- Distant hills -->
  <path d="M0 1180 Q 200 1050 420 1110 T 820 1090 T 1080 1130 L 1080 1920 L 0 1920 Z" fill="url(#hillsA)"/>
  <!-- Foreground hills -->
  <path d="M0 1340 Q 250 1230 540 1280 T 1080 1290 L 1080 1920 L 0 1920 Z" fill="url(#hillsB)"/>

  <!-- Walking-feet glyph (simple) -->
  <g transform="translate(80 1740)" fill="#f5f1e8" opacity="0.92">
    <ellipse cx="14" cy="10" rx="11" ry="16"/>
    <circle cx="6" cy="-9" r="5"/>
    <circle cx="14" cy="-13" r="5"/>
    <circle cx="22" cy="-9" r="5"/>
    <ellipse cx="58" cy="22" rx="11" ry="16"/>
    <circle cx="50" cy="3" r="5"/>
    <circle cx="58" cy="-1" r="5"/>
    <circle cx="66" cy="3" r="5"/>
  </g>

  <!-- Grain wash -->
  <rect width="1080" height="1920" fill="url(#grain)"/>

  <!-- Brand mark -->
  <text x="80" y="180" font-family="Georgia, serif" font-size="26" fill="#3a3a3a" letter-spacing="5" font-weight="600">MENTAL HEALTH WALK CLUB</text>
  <line x1="80" y1="208" x2="240" y2="208" stroke="#3a3a3a" stroke-width="2"/>

  <!-- "You're invited" eyebrow -->
  <text x="80" y="500" font-family="Georgia, serif" font-size="38" fill="#5b4a30" font-style="italic">you're invited</text>

  <!-- Title -->
  ${titleLines
    .map(
      (line, i) =>
        `<text x="80" y="${titleBaseY + i * titleLineHeight}" font-family="Georgia, serif" font-size="108" fill="#1b1b1b" font-weight="500">${esc(line)}</text>`
    )
    .join("\n  ")}

  <!-- When -->
  <text x="80" y="${titleBaseY + titleLines.length * titleLineHeight + 60}" font-family="Inter, sans-serif" font-size="40" fill="#2d2d2d" font-weight="600">${esc(when)}</text>

  <!-- Where -->
  <text x="80" y="${titleBaseY + titleLines.length * titleLineHeight + 116}" font-family="Inter, sans-serif" font-size="34" fill="#4a4a4a">${esc(where)}</text>

  <!-- Meeting point -->
  ${
    meet
      ? `<text x="80" y="${titleBaseY + titleLines.length * titleLineHeight + 168}" font-family="Inter, sans-serif" font-size="26" fill="#5b5b5b" font-style="italic">meet · ${esc(meet.slice(0, 60))}</text>`
      : ""
  }

  <!-- Vibe pill -->
  <g transform="translate(80 ${titleBaseY + titleLines.length * titleLineHeight + 220})">
    <rect x="0" y="0" rx="28" ry="28" width="${Math.min(900, 80 + vibe.length * 16)}" height="56" fill="#1b3520"/>
    <text x="30" y="38" font-family="Inter, sans-serif" font-size="24" fill="#f5f1e8" font-weight="500">${esc(vibe.slice(0, 50))}</text>
  </g>

  <!-- Footer: count + RSVP -->
  <g transform="translate(80 1820)">
    <text x="0" y="0" font-family="Inter, sans-serif" font-size="28" fill="#f5f1e8" font-weight="600">${
      count > 0 ? `${count} walker${count === 1 ? "" : "s"} going` : "be the first to RSVP"
    }</text>
    <text x="0" y="40" font-family="Inter, sans-serif" font-size="22" fill="#f5f1e8" opacity="0.85">RSVP at mentalhealthwalkclub.com/w/${esc(code.data)}</text>
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
