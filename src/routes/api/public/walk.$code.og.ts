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
      <stop offset="0" stop-color="#f7f0df"/>
      <stop offset="0.55" stop-color="#ecdcbe"/>
      <stop offset="1" stop-color="#c9b58a"/>
    </linearGradient>
    <linearGradient id="hills" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3f5d3a" stop-opacity="0.92"/>
      <stop offset="1" stop-color="#243a23" stop-opacity="0.98"/>
    </linearGradient>
    <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fff4d0" stop-opacity="1"/>
      <stop offset="0.7" stop-color="#fff4d0" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#fff4d0" stop-opacity="0"/>
    </radialGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.32  0 0 0 0 0.28  0 0 0 0.06 0"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="980" cy="160" r="120" fill="url(#sun)"/>
  <path d="M0 470 Q 200 360 400 420 T 800 410 T 1200 440 L 1200 630 L 0 630 Z" fill="url(#hills)"/>
  <path d="M0 540 Q 250 470 500 510 T 1000 500 T 1200 520 L 1200 630 L 0 630 Z" fill="#1c3320" opacity="0.85"/>
  <rect width="1200" height="630" filter="url(#grain)" opacity="0.55"/>

  <text x="80" y="100" font-family="Fraunces, Georgia, serif" font-size="20" fill="#3a3a3a" letter-spacing="4" font-weight="600">MENTAL HEALTH WALK CLUB</text>
  <line x1="80" y1="118" x2="180" y2="118" stroke="#3a3a3a" stroke-width="1" opacity="0.4"/>

  ${titleLines
    .map(
      (line, i) =>
        `<text x="80" y="${230 + i * 84}" font-family="Fraunces, Georgia, serif" font-size="76" fill="#1b1b1b" font-weight="500" letter-spacing="-1">${esc(line)}</text>`
    )
    .join("\n  ")}

  <text x="80" y="${230 + titleLines.length * 84 + 36}" font-family="Inter, sans-serif" font-size="26" fill="#4a4a4a" font-weight="500">${esc([when, city].filter(Boolean).join(" · "))}</text>
  <text x="80" y="${230 + titleLines.length * 84 + 76}" font-family="Fraunces, Georgia, serif" font-size="24" fill="#5b5b5b" font-style="italic">${esc(vibe)}</text>

  <g transform="translate(80 568)">
    <rect x="0" y="0" rx="24" ry="24" width="${count > 0 ? 320 : 220}" height="50" fill="#1b3520" />
    <text x="26" y="32" font-family="Inter, sans-serif" font-size="18" fill="#f5f1e8" font-weight="600" letter-spacing="0.3">${count > 0 ? `${count} walker${count === 1 ? "" : "s"} going · RSVP` : "RSVP to join"}</text>
  </g>

  <text x="1120" y="600" font-family="Fraunces, Georgia, serif" font-size="16" fill="#3a3a3a" font-style="italic" text-anchor="end" opacity="0.65">you don't have to walk through it alone</text>
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
